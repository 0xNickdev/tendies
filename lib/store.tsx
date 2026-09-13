"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { TREASURY, type Direction } from "./mock";
import { TENDIE_MINT, SOLANA, KEEPER_URL } from "./config";
import {
  fetchAccount,
  fetchPerps,
  fetchPositions,
  openPerp,
  closePerp,
  submitChoice,
  symbolForToken,
  type ClosedPerp,
  type Payout,
  type PerpPosition,
  type PerpsInfo,
} from "./keeper";
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
  // perps, served by the keeper
  positions: PerpPosition[];
  history: ClosedPerp[];
  perps: PerpsInfo | null;
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
    market: string;
    direction: Direction;
    leverage: number;
    marginUsd: number;
  }) => Promise<{ ok: boolean; error?: string; position?: PerpPosition }>;
  closePosition: (id: string) => Promise<{ ok: boolean; error?: string; position?: ClosedPerp }>;
};

const StoreCtx = createContext<Store | null>(null);

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
  const [positions, setPositions] = useState<PerpPosition[]>([]);
  const [history, setHistory] = useState<ClosedPerp[]>([]);
  const [perps, setPerps] = useState<PerpsInfo | null>(null);
  const [payoutChoice, setChoice] = useState<StockSym | null>(null);
  const [accruedUsd, setAccrued] = useState(0);
  const [minPayoutUsd, setMinPayout] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);
  const [streak, setStreak] = useState(0);
  const [payouts, setPayouts] = useState<Payout[]>([]);

  // Reload the accrued balance and positions - both move on every open,
  // close, funding tick or liquidation, and margin is one side of the other.
  const syncKeeper = useCallback(async (address: string) => {
    const [account, pos] = await Promise.all([fetchAccount(address), fetchPositions(address)]);
    if (pos) {
      setPositions(pos.open);
      setHistory(pos.history);
    }
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

  const adopt = useCallback(
    async (address: string) => {
      setWallet({ connected: true, address });
      setWalletMissing(false);
      setTendie(await fetchTendieBalance(address));
      await syncKeeper(address);
    },
    [syncKeeper],
  );

  // Marks, limits and funding terms - public, refreshed on the mark cadence.
  useEffect(() => {
    if (!KEEPER_URL) return;
    let cancelled = false;
    const load = async () => {
      const info = await fetchPerps();
      if (!cancelled && info) setPerps(info);
    };
    void load();
    const t = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  // Positions are marked every few minutes on the keeper; follow along.
  useEffect(() => {
    if (!KEEPER_URL || !wallet.address) return;
    const t = setInterval(() => void syncKeeper(wallet.address), 60_000);
    return () => clearInterval(t);
  }, [wallet.address, syncKeeper]);

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
    setPositions([]);
    setHistory([]);
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

  // Both go through the wallet's signMessage - free, not a transaction - and
  // the keeper answers with the position as it now stands. The accrued
  // balance moved too, so resync rather than guess at it.
  const openPosition = useCallback(
    async (p: { market: string; direction: Direction; leverage: number; marginUsd: number }) => {
      const provider = getProvider();
      if (!provider?.signMessage || !wallet.address) {
        return { ok: false, error: "Connect a wallet that can sign messages" };
      }
      const result = await openPerp(
        wallet.address,
        { market: p.market, side: p.direction, leverage: p.leverage, marginUsd: p.marginUsd },
        provider.signMessage.bind(provider),
      );
      if (result.ok) void syncKeeper(wallet.address);
      return result;
    },
    [wallet.address, syncKeeper],
  );

  const closePosition = useCallback(
    async (id: string) => {
      const provider = getProvider();
      if (!provider?.signMessage || !wallet.address) {
        return { ok: false, error: "Connect a wallet that can sign messages" };
      }
      const result = await closePerp(wallet.address, id, provider.signMessage.bind(provider));
      if (result.ok) void syncKeeper(wallet.address);
      return result;
    },
    [wallet.address, syncKeeper],
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
      perps,
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
      perps,
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
