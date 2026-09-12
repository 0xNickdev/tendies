"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  TREASURY,
  type ClosedPosition,
  type Direction,
  type Position,
} from "./mock";
import { TENDIE_MINT, SOLANA } from "./config";
import { fetchAccount, submitChoice, symbolForToken, type Payout } from "./keeper";
import type { StockSym } from "./stocks";

// Real Solana wallet connection — Phantom, Solflare and any provider that
// injects the same interface. The TENDIE balance is read straight from the
// cluster; until TENDIE_MINT is set in lib/config.ts it stays 0.

type SolanaProvider = {
  isPhantom?: boolean;
  isSolflare?: boolean;
  publicKey?: { toString(): string } | null;
  connect(opts?: { onlyIfTrusted?: boolean }): Promise<{
    publicKey: { toString(): string };
  }>;
  disconnect(): Promise<void>;
  signMessage?(message: Uint8Array, encoding?: string): Promise<{ signature: Uint8Array }>;
  on?(event: string, cb: (payload: unknown) => void): void;
  off?(event: string, cb: (payload: unknown) => void): void;
  removeListener?(event: string, cb: (payload: unknown) => void): void;
};

declare global {
  interface Window {
    solana?: SolanaProvider;
    solflare?: SolanaProvider;
    phantom?: { solana?: SolanaProvider };
  }
}

function getProvider(): SolanaProvider | undefined {
  if (typeof window === "undefined") return undefined;
  return window.phantom?.solana ?? window.solana ?? window.solflare;
}

type WalletState = {
  connected: boolean;
  address: string;
};

type Store = {
  wallet: WalletState;
  walletMissing: boolean; // no Solana wallet injected in this browser
  tendieBalance: number;
  claimUsd: number; // the accrued claim in dollars, not in any stablecoin
  walletQuote: number; // balance of the quote asset (OPENAI)
  shareBps: number;
  positions: Position[];
  history: ClosedPosition[];
  // payout account, served by the keeper
  payoutChoice: StockSym | null;
  accruedUsd: number;
  minPayoutUsd: number;
  totalPaid: number;
  streak: number;
  payouts: Payout[];
  // actions
  connect: () => void;
  disconnect: () => void;
  setPayoutChoice: (symbol: StockSym) => Promise<{ ok: boolean; error?: string }>;
  buyToken: (usdc: number) => void;
  sellToken: (tendie: number) => void;
  openPosition: (p: {
    direction: Direction;
    leverage: number;
    marginUsdc: number;
    entryPrice: number;
  }) => void;
  closePosition: (id: string) => void;
};

const StoreCtx = createContext<Store | null>(null);

let idCounter = 9000;
const nextId = () => `pos_${idCounter++}`;

// SPL balance via a plain getTokenAccountsByOwner RPC call — no SDK needed.
// An owner can hold the same mint across several token accounts, so sum them.
async function fetchTendieBalance(owner: string): Promise<number> {
  if (!TENDIE_MINT) return 0; // token not launched yet
  try {
    const res = await fetch(SOLANA.rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTokenAccountsByOwner",
        params: [
          owner,
          { mint: TENDIE_MINT },
          { encoding: "jsonParsed", commitment: "confirmed" },
        ],
      }),
    });
    const json = await res.json();
    const accounts = json?.result?.value;
    if (!Array.isArray(accounts)) return 0;
    return accounts.reduce((sum: number, acc: unknown) => {
      const amount = (acc as {
        account?: {
          data?: { parsed?: { info?: { tokenAmount?: { uiAmount?: number } } } };
        };
      })?.account?.data?.parsed?.info?.tokenAmount?.uiAmount;
      return sum + (typeof amount === "number" ? amount : 0);
    }, 0);
  } catch {
    return 0;
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [wallet, setWallet] = useState<WalletState>({
    connected: false,
    address: "",
  });
  const [walletMissing, setWalletMissing] = useState(false);
  const [tendieBalance, setTendie] = useState(0);
  const [claimUsd, setClaim] = useState(0);
  const [walletQuote, setWalletQuote] = useState(0);
  const [shareBps, setShareBps] = useState(0);
  const [positions, setPositions] = useState<Position[]>([]);
  const [history, setHistory] = useState<ClosedPosition[]>([]);
  const [payoutChoice, setChoice] = useState<StockSym | null>(null);
  const [accruedUsd, setAccrued] = useState(0);
  const [minPayoutUsd, setMinPayout] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);
  const [streak, setStreak] = useState(0);
  const [payouts, setPayouts] = useState<Payout[]>([]);

  const adopt = useCallback(async (address: string) => {
    setWallet({ connected: true, address });
    setWalletMissing(false);
    setTendie(await fetchTendieBalance(address));

    // what the keeper has accrued for this wallet, and its payout pick
    const account = await fetchAccount(address);
    if (account) {
      setChoice(symbolForToken(account.choice));
      // accrued is in fee-token units; accruedUsd is the same thing in money.
      setAccrued(account.accruedUsd ?? account.accrued);
      setMinPayout(account.minPayoutUsd);
      setShareBps(account.shareBps ?? 0);
      setTotalPaid(account.totalPaidUsd ?? account.totalPaid ?? 0);
      setStreak(account.streak ?? 0);
      setPayouts(account.payouts ?? []);
    }
  }, []);

  // Ask the wallet to sign the choice, then hand it to the keeper. Signing is
  // free — it is not a transaction.
  const setPayoutChoice = useCallback(
    async (symbol: StockSym) => {
      const provider = getProvider();
      if (!provider?.signMessage || !wallet.address) {
        return { ok: false, error: "Connect a wallet that can sign messages" };
      }
      const result = await submitChoice(
        wallet.address,
        symbol,
        provider.signMessage.bind(provider),
      );
      if (result.ok) setChoice(symbol);
      return result;
    },
    [wallet.address],
  );

  const connect = useCallback(async () => {
    const provider = getProvider();
    if (!provider) {
      setWalletMissing(true);
      return;
    }
    try {
      const { publicKey } = await provider.connect();
      const address = publicKey?.toString();
      if (address) await adopt(address);
    } catch {
      /* user rejected the request */
    }
  }, [adopt]);

  const disconnect = useCallback(() => {
    void getProvider()?.disconnect().catch(() => {});
    setWallet({ connected: false, address: "" });
    setTendie(0);
    setChoice(null);
    setAccrued(0);
    setShareBps(0);
    setTotalPaid(0);
    setStreak(0);
    setPayouts([]);
  }, []);

  // Silently restore a previously approved connection, then follow account
  // switches inside Phantom / Solflare.
  useEffect(() => {
    const provider = getProvider();
    if (!provider) return;

    provider
      .connect({ onlyIfTrusted: true })
      .then(({ publicKey }) => {
        const address = publicKey?.toString();
        if (address) void adopt(address);
      })
      .catch(() => {
        /* not trusted yet — the user has to click Connect */
      });

    const onAccountChanged = (payload: unknown) => {
      const key = payload as { toString(): string } | null;
      const address = key?.toString();
      if (address) {
        void adopt(address);
      } else {
        setWallet({ connected: false, address: "" });
        setTendie(0);
      }
    };
    provider.on?.("accountChanged", onAccountChanged);
    return () => {
      provider.off?.("accountChanged", onAccountChanged);
      provider.removeListener?.("accountChanged", onAccountChanged);
    };
  }, [adopt]);

  // Trade is gated behind FEATURES.tradeLive — these stay inert until launch.
  const buyToken = useCallback((quote: number) => {
    if (quote <= 0 || TREASURY.tokenPriceUsd <= 0) return;
    // The trader loses the whole pool fee; only our slice reaches the treasury.
    const net = quote * (1 - TREASURY.poolFeeBps / 10_000);
    const tokens = net / TREASURY.tokenPriceUsd;
    setWalletQuote((b) => Math.max(0, b - quote));
    setTendie((b) => b + tokens);
    setClaim((c) => c + quote * (TREASURY.treasuryFeeBps / 10_000));
  }, []);

  const sellToken = useCallback((tendie: number) => {
    if (tendie <= 0 || TREASURY.tokenPriceUsd <= 0) return;
    const gross = tendie * TREASURY.tokenPriceUsd;
    const net = gross * (1 - TREASURY.poolFeeBps / 10_000);
    setTendie((b) => Math.max(0, b - tendie));
    setWalletQuote((b) => b + net);
  }, []);

  const openPosition = useCallback(
    (p: {
      direction: Direction;
      leverage: number;
      marginUsdc: number;
      entryPrice: number;
    }) => {
      const sizeUsd = p.marginUsdc * p.leverage;
      const entry = p.entryPrice; // live oracle price from the caller
      // liquidation when loss ≈ margin: move of (1/leverage) against you
      const move = entry / p.leverage;
      const liq =
        p.direction === "long" ? entry - move * 0.95 : entry + move * 0.95;
      setClaim((c) => Math.max(0, c - p.marginUsdc));
      setPositions((list) => [
        {
          id: nextId(),
          direction: p.direction,
          leverage: p.leverage,
          marginUsdc: p.marginUsdc,
          entryPrice: entry,
          sizeUsd,
          liqPrice: Math.round(liq * 10) / 10,
          openedAt: new Date().toISOString(),
        },
        ...list,
      ]);
    },
    [],
  );

  const closePosition = useCallback(
    (id: string) => {
      setPositions((list) => {
        const pos = list.find((p) => p.id === id);
        if (pos) {
          // real settlement price comes from the oracle at launch; the
          // preview settles flat (entry == exit) so no fabricated PnL
          const mark = pos.entryPrice;
          const dir = pos.direction === "long" ? 1 : -1;
          const pnl =
            ((mark - pos.entryPrice) / pos.entryPrice) * pos.sizeUsd * dir;
          setClaim((c) => c + pos.marginUsdc + pnl);
          setHistory((h) => [
            {
              id: pos.id,
              direction: pos.direction,
              leverage: pos.leverage,
              marginUsdc: pos.marginUsdc,
              entryPrice: pos.entryPrice,
              exitPrice: mark,
              pnlUsd: pnl,
              settledAt: new Date().toISOString(),
            },
            ...h,
          ]);
        }
        return list.filter((p) => p.id !== id);
      });
    },
    [],
  );

  const value = useMemo<Store>(
    () => ({
      wallet,
      walletMissing,
      tendieBalance,
      claimUsd,
      walletQuote,
      shareBps,
      positions,
      history,
      payoutChoice,
      accruedUsd,
      minPayoutUsd,
      totalPaid,
      streak,
      payouts,
      connect,
      disconnect,
      setPayoutChoice,
      buyToken,
      sellToken,
      openPosition,
      closePosition,
    }),
    [
      wallet,
      walletMissing,
      tendieBalance,
      claimUsd,
      walletQuote,
      shareBps,
      positions,
      history,
      payoutChoice,
      accruedUsd,
      minPayoutUsd,
      totalPaid,
      streak,
      payouts,
      connect,
      disconnect,
      setPayoutChoice,
      buyToken,
      sellToken,
      openPosition,
      closePosition,
    ],
  );

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
