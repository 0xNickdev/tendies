"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ROBX_TOKEN_ADDRESS, ROBINHOOD_CHAIN, KEEPER_URL } from "./config";
import type { StockSym } from "./stocks";
import type { Direction } from "./mock";
import {
  fetchAccount,
  fetchPerps,
  fetchPositions,
  openPerp,
  closePerp,
  submitChoice,
  type ClosedPerp,
  type Payout,
  type PerpPosition,
  type PerpsInfo,
} from "./keeper";

// Real EIP-1193 wallet connection — works with MetaMask, Rabby, and any
// injected EVM wallet. The ROBX balance is read from the chain; what the
// wallet is owed, its payout choice and its perps come from the keeper.
// Until ROBX_TOKEN_ADDRESS is set in lib/config.ts the token balance is 0.

type Eip1193 = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, cb: (payload: unknown) => void): void;
  removeListener?(event: string, cb: (payload: unknown) => void): void;
};

declare global {
  interface Window {
    ethereum?: Eip1193;
  }
}

type WalletState = {
  connected: boolean;
  address: string;
  chainId: number; // 0 until known
};

type Store = {
  wallet: WalletState;
  wrongNetwork: boolean; // connected but not on Robinhood Chain
  robxBalance: number;
  connecting: boolean; // a wallet request is open (popup, or a paused/locked extension)
  signing: boolean; // a signature request is open in the wallet
  // payout account, served by the keeper
  payoutChoice: StockSym | null; // null = default stock
  accruedUsd: number; // what the treasury owes this wallet, in dollars
  minPayoutUsd: number;
  shareBps: number; // share of circulating supply at the last epoch snapshot
  totalPaid: number;
  streak: number;
  payouts: Payout[];
  // perps, served by the keeper
  positions: PerpPosition[];
  history: ClosedPerp[];
  perps: PerpsInfo | null;
  // actions
  connect: () => void;
  switchNetwork: () => Promise<void>;
  disconnect: () => void;
  refresh: () => Promise<void>;
  setPayoutChoice: (symbol: StockSym) => Promise<{ ok: boolean; error?: string }>;
  openPosition: (p: {
    market: string;
    direction: Direction;
    leverage: number;
    marginUsd: number;
  }) => Promise<{ ok: boolean; error?: string; position?: PerpPosition }>;
  closePosition: (id: string) => Promise<{ ok: boolean; error?: string; position?: ClosedPerp }>;
};

const StoreCtx = createContext<Store | null>(null);

// ERC-20 balanceOf(address) via raw eth_call — no SDK dependency.
async function fetchRobxBalance(
  eth: Eip1193,
  address: string,
): Promise<number> {
  if (!ROBX_TOKEN_ADDRESS) return 0; // token not deployed yet
  try {
    const data =
      "0x70a08231" +
      address.toLowerCase().replace(/^0x/, "").padStart(64, "0");
    const res = (await eth.request({
      method: "eth_call",
      params: [{ to: ROBX_TOKEN_ADDRESS, data }, "latest"],
    })) as string;
    if (!res || res === "0x") return 0;
    return Number(BigInt(res)) / 1e18;
  } catch {
    return 0;
  }
}

// EIP-191 personal_sign — free, not a transaction. MetaMask wants the message
// hex-encoded; the keeper recovers the signer with ethers.verifyMessage.
function personalSign(eth: Eip1193, address: string) {
  return async (message: string): Promise<string> => {
    const hex = "0x" + Array.from(new TextEncoder().encode(message), (b) => b.toString(16).padStart(2, "0")).join("");
    return (await eth.request({ method: "personal_sign", params: [hex, address] })) as string;
  };
}

// Ask the wallet to switch to Robinhood Chain, adding it first if unknown.
async function ensureNetwork(eth: Eip1193): Promise<void> {
  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: ROBINHOOD_CHAIN.chainIdHex }],
    });
  } catch (err) {
    // 4902 = chain not added to the wallet yet → add it, which also switches
    const code = (err as { code?: number })?.code;
    if (code === 4902 || code === -32603) {
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: ROBINHOOD_CHAIN.chainIdHex,
            chainName: ROBINHOOD_CHAIN.chainName,
            rpcUrls: ROBINHOOD_CHAIN.rpcUrls,
            blockExplorerUrls: ROBINHOOD_CHAIN.blockExplorerUrls,
            nativeCurrency: ROBINHOOD_CHAIN.nativeCurrency,
          },
        ],
      });
    } else {
      throw err;
    }
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [wallet, setWallet] = useState<WalletState>({
    connected: false,
    address: "",
    chainId: 0,
  });
  const [robxBalance, setRobx] = useState(0);
  const [connecting, setConnecting] = useState(false);
  const [signing, setSigning] = useState(false);
  const [payoutChoice, setChoice] = useState<StockSym | null>(null);
  const [accruedUsd, setAccrued] = useState(0);
  const [minPayoutUsd, setMinPayout] = useState(0);
  const [shareBps, setShareBps] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);
  const [streak, setStreak] = useState(0);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [positions, setPositions] = useState<PerpPosition[]>([]);
  const [history, setHistory] = useState<ClosedPerp[]>([]);
  const [perps, setPerps] = useState<PerpsInfo | null>(null);

  // Reload the accrued balance and positions - both move on every open,
  // close, funding tick or liquidation, and margin is one side of the other.
  const syncKeeper = useCallback(async (address: string) => {
    if (!KEEPER_URL) return;
    const [account, pos] = await Promise.all([fetchAccount(address), fetchPositions(address)]);
    if (pos) {
      setPositions(pos.open);
      setHistory(pos.history);
    }
    if (account) {
      setChoice((account.choice as StockSym | null) ?? null);
      // accrued is in fee-token units; accruedUsd is the same thing in money.
      setAccrued(account.accruedUsd ?? 0);
      setMinPayout(account.minPayoutUsd);
      setShareBps(account.shareBps ?? 0);
      setTotalPaid(account.totalPaidUsd ?? 0);
      setStreak(account.streak ?? 0);
      setPayouts(account.payouts ?? []);
    }
  }, []);

  const resetAccount = useCallback(() => {
    setChoice(null);
    setAccrued(0);
    setShareBps(0);
    setTotalPaid(0);
    setStreak(0);
    setPayouts([]);
    setPositions([]);
    setHistory([]);
  }, []);

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

  const readChainId = useCallback(async (eth: Eip1193): Promise<number> => {
    try {
      const hex = (await eth.request({ method: "eth_chainId" })) as string;
      return parseInt(hex, 16);
    } catch {
      return 0;
    }
  }, []);

  const connect = useCallback(async () => {
    const eth = window.ethereum;
    if (!eth) {
      window.open("https://metamask.io/download/", "_blank", "noopener");
      return;
    }
    setConnecting(true);
    // A paused or locked extension never answers; give up after a while so
    // the button does not sit on "Opening wallet…" forever.
    const giveUp = setTimeout(() => setConnecting(false), 25_000);
    try {
      const accounts = (await eth.request({
        method: "eth_requestAccounts",
      })) as string[];
      const address = accounts?.[0];
      if (!address) return;

      // put the wallet on Robinhood Chain before reading anything
      let chainId = await readChainId(eth);
      if (chainId !== ROBINHOOD_CHAIN.chainId) {
        try {
          await ensureNetwork(eth);
          chainId = await readChainId(eth);
        } catch {
          /* user declined the switch — connect anyway, show Wrong network */
        }
      }

      setWallet({ connected: true, address, chainId });
      setRobx(await fetchRobxBalance(eth, address));
      await syncKeeper(address);
    } catch {
      /* user rejected the request */
    } finally {
      clearTimeout(giveUp);
      setConnecting(false);
    }
  }, [readChainId, syncKeeper]);

  // Re-read balance, accrued rewards and positions - after an action, and on
  // a timer while connected so the Treasury tab follows each epoch and the
  // perps follow each mark.
  const refresh = useCallback(async () => {
    const eth = window.ethereum;
    if (!eth || !wallet.address) return;
    setRobx(await fetchRobxBalance(eth, wallet.address));
    await syncKeeper(wallet.address);
  }, [wallet.address, syncKeeper]);

  useEffect(() => {
    if (!wallet.connected) return;
    const t = setInterval(() => void refresh(), 60_000);
    return () => clearInterval(t);
  }, [wallet.connected, refresh]);

  // Ask the wallet to sign the choice, then hand it to the keeper. Signing is
  // free — it is not a transaction.
  const setPayoutChoice = useCallback(
    async (symbol: StockSym) => {
      const eth = window.ethereum;
      if (!eth || !wallet.address) return { ok: false, error: "Connect a wallet first" };
      setSigning(true);
      try {
        const result = await submitChoice(wallet.address, symbol, personalSign(eth, wallet.address));
        if (result.ok) setChoice(symbol);
        return result;
      } finally {
        setSigning(false);
      }
    },
    [wallet.address],
  );

  const switchNetwork = useCallback(async () => {
    const eth = window.ethereum;
    if (!eth) return;
    try {
      await ensureNetwork(eth);
      const chainId = await readChainId(eth);
      setWallet((w) => ({ ...w, chainId }));
    } catch {
      /* user declined */
    }
  }, [readChainId]);

  const disconnect = useCallback(() => {
    setWallet({ connected: false, address: "", chainId: 0 });
    setRobx(0);
    resetAccount();
  }, [resetAccount]);

  // follow account & network switches in MetaMask / Rabby
  useEffect(() => {
    const eth = window.ethereum;
    if (!eth?.on) return;
    const onAccounts = async (payload: unknown) => {
      const address = (payload as string[])?.[0];
      if (!address) {
        disconnect();
        return;
      }
      const chainId = await readChainId(eth);
      setWallet((w) => ({ ...w, connected: true, address, chainId }));
      setRobx(await fetchRobxBalance(eth, address));
      resetAccount();
      await syncKeeper(address);
    };
    const onChain = (payload: unknown) => {
      const chainId = parseInt(payload as string, 16);
      setWallet((w) => ({ ...w, chainId }));
    };
    eth.on("accountsChanged", onAccounts);
    eth.on("chainChanged", onChain);
    return () => {
      eth.removeListener?.("accountsChanged", onAccounts);
      eth.removeListener?.("chainChanged", onChain);
    };
  }, [disconnect, readChainId, resetAccount, syncKeeper]);

  const wrongNetwork =
    wallet.connected && wallet.chainId !== ROBINHOOD_CHAIN.chainId;

  // Both go through the wallet's personal_sign - free, not a transaction - and
  // the keeper answers with the position as it now stands. The accrued
  // balance moved, so it is re-read straight after.
  const openPosition = useCallback(
    async (p: { market: string; direction: Direction; leverage: number; marginUsd: number }) => {
      const eth = window.ethereum;
      if (!eth || !wallet.address) return { ok: false, error: "Connect a wallet first" };
      setSigning(true);
      try {
        const result = await openPerp(
          wallet.address,
          { market: p.market, side: p.direction, leverage: p.leverage, marginUsd: p.marginUsd },
          personalSign(eth, wallet.address),
        );
        if (result.ok) await syncKeeper(wallet.address);
        return result;
      } finally {
        setSigning(false);
      }
    },
    [wallet.address, syncKeeper],
  );

  const closePosition = useCallback(
    async (id: string) => {
      const eth = window.ethereum;
      if (!eth || !wallet.address) return { ok: false, error: "Connect a wallet first" };
      setSigning(true);
      try {
        const result = await closePerp(wallet.address, id, personalSign(eth, wallet.address));
        if (result.ok) await syncKeeper(wallet.address);
        return result;
      } finally {
        setSigning(false);
      }
    },
    [wallet.address, syncKeeper],
  );

  const value = useMemo<Store>(
    () => ({
      wallet,
      wrongNetwork,
      robxBalance,
      connecting,
      signing,
      payoutChoice,
      accruedUsd,
      minPayoutUsd,
      shareBps,
      totalPaid,
      streak,
      payouts,
      positions,
      history,
      perps,
      connect,
      switchNetwork,
      disconnect,
      refresh,
      setPayoutChoice,
      openPosition,
      closePosition,
    }),
    [
      wallet,
      wrongNetwork,
      robxBalance,
      connecting,
      signing,
      payoutChoice,
      accruedUsd,
      minPayoutUsd,
      shareBps,
      totalPaid,
      streak,
      payouts,
      positions,
      history,
      perps,
      connect,
      switchNetwork,
      disconnect,
      refresh,
      setPayoutChoice,
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
