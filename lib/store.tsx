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
import { ROBX_TOKEN_ADDRESS, DISTRIBUTOR_ADDRESS, ROBINHOOD_CHAIN } from "./config";
import { PAYOUT_STOCKS, type StockSym } from "./stocks";

// Real EIP-1193 wallet connection — works with MetaMask, Rabby, and any
// injected EVM wallet. Balances are read from the chain; until the ROBX
// contract address is set in lib/config.ts the token balance is 0.

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
  claimUsdc: number; // pendingUsdc(owner) on the RewardDistributor, in dollars
  payoutChoice: StockSym | null; // rewardChoice(owner) mapped to a symbol; null = default
  txPending: boolean;
  walletUsdc: number;
  shareBps: number;
  positions: Position[];
  history: ClosedPosition[];
  // actions
  connect: () => void;
  switchNetwork: () => Promise<void>;
  disconnect: () => void;
  refresh: () => Promise<void>;
  setPayoutChoice: (symbol: StockSym) => Promise<{ ok: boolean; error?: string; hash?: string }>;
  claim: () => Promise<{ ok: boolean; error?: string; hash?: string }>;
  buyToken: (usdc: number) => void;
  sellToken: (robx: number) => void;
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

// Ask the wallet to switch to Robinhood Chain, adding it first if unknown.
// ── RewardDistributor reads/writes, raw ABI-encoded so no SDK is needed ──
const pad = (hex: string) => hex.toLowerCase().replace(/^0x/, "").padStart(64, "0");
// keccak256 selectors, generated with ethers.id() in keeper/ - see README.
const SEL = {
  pendingUsdc: "0x5def5f5e", // pendingUsdc(address)
  rewardChoice: "0xf2568897", // rewardChoice(address)
  setRewardChoice: "0xe430823e", // setRewardChoice(address)
  claim: "0x4e71d92d", // claim()
};

async function call(eth: Eip1193, to: string, data: string): Promise<string> {
  const res = (await eth.request({ method: "eth_call", params: [{ to, data }, "latest"] })) as string;
  return res ?? "0x";
}

// USDG has 6 decimals - pendingUsdc is in those units.
async function fetchPending(eth: Eip1193, address: string): Promise<number> {
  if (!DISTRIBUTOR_ADDRESS) return 0;
  try {
    const res = await call(eth, DISTRIBUTOR_ADDRESS, SEL.pendingUsdc + pad(address));
    return res === "0x" ? 0 : Number(BigInt(res)) / 1e6;
  } catch {
    return 0;
  }
}

async function fetchChoice(eth: Eip1193, address: string): Promise<StockSym | null> {
  if (!DISTRIBUTOR_ADDRESS) return null;
  try {
    const res = await call(eth, DISTRIBUTOR_ADDRESS, SEL.rewardChoice + pad(address));
    if (res === "0x" || res.length < 66) return null;
    const token = ("0x" + res.slice(-40)).toLowerCase();
    if (/^0x0+$/.test(token)) return null;
    return PAYOUT_STOCKS.find((s) => s.address.toLowerCase() === token)?.symbol ?? null;
  } catch {
    return null;
  }
}

async function sendTx(eth: Eip1193, from: string, to: string, data: string): Promise<string> {
  return (await eth.request({
    method: "eth_sendTransaction",
    params: [{ from, to, data }],
  })) as string;
}

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
  const [claimUsdc, setClaim] = useState(0);
  const [connecting, setConnecting] = useState(false);
  const [payoutChoice, setChoice] = useState<StockSym | null>(null);
  const [txPending, setTxPending] = useState(false);
  const [walletUsdc, setWalletUsdc] = useState(0);
  const [shareBps] = useState(0);
  const [positions, setPositions] = useState<Position[]>([]);
  const [history, setHistory] = useState<ClosedPosition[]>([]);

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
      setClaim(await fetchPending(eth, address));
      setChoice(await fetchChoice(eth, address));
    } catch {
      /* user rejected the request */
    } finally {
      clearTimeout(giveUp);
      setConnecting(false);
    }
  }, [readChainId]);

  // Re-read balance, pending rewards and choice - after a tx, and on a timer
  // while connected so the Treasury tab follows each epoch.
  const refresh = useCallback(async () => {
    const eth = window.ethereum;
    if (!eth || !wallet.address) return;
    setRobx(await fetchRobxBalance(eth, wallet.address));
    setClaim(await fetchPending(eth, wallet.address));
    setChoice(await fetchChoice(eth, wallet.address));
  }, [wallet.address]);

  useEffect(() => {
    if (!wallet.connected) return;
    const t = setInterval(() => void refresh(), 60_000);
    return () => clearInterval(t);
  }, [wallet.connected, refresh]);

  // setRewardChoice(token) - one wallet transaction; address(0) means default.
  const setPayoutChoice = useCallback(
    async (symbol: StockSym) => {
      const eth = window.ethereum;
      if (!eth || !wallet.address) return { ok: false, error: "Connect a wallet first" };
      if (!DISTRIBUTOR_ADDRESS) return { ok: false, error: "Treasury contract is not deployed yet" };
      const stock = PAYOUT_STOCKS.find((s) => s.symbol === symbol);
      if (!stock) return { ok: false, error: "Unknown stock" };
      setTxPending(true);
      try {
        const hash = await sendTx(eth, wallet.address, DISTRIBUTOR_ADDRESS, SEL.setRewardChoice + pad(stock.address));
        setChoice(symbol);
        return { ok: true, hash };
      } catch (e) {
        return { ok: false, error: (e as { message?: string })?.message?.split("\n")[0] ?? "Rejected in wallet" };
      } finally {
        setTxPending(false);
      }
    },
    [wallet.address],
  );

  // claim() - swaps your pending USDG into the chosen stock and sends it.
  const claim = useCallback(async () => {
    const eth = window.ethereum;
    if (!eth || !wallet.address) return { ok: false, error: "Connect a wallet first" };
    if (!DISTRIBUTOR_ADDRESS) return { ok: false, error: "Treasury contract is not deployed yet" };
    setTxPending(true);
    try {
      const hash = await sendTx(eth, wallet.address, DISTRIBUTOR_ADDRESS, SEL.claim);
      setClaim(0);
      return { ok: true, hash };
    } catch (e) {
      return { ok: false, error: (e as { message?: string })?.message?.split("\n")[0] ?? "Rejected in wallet" };
    } finally {
      setTxPending(false);
    }
  }, [wallet.address]);

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
  }, []);

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
  }, [disconnect, readChainId]);

  const wrongNetwork =
    wallet.connected && wallet.chainId !== ROBINHOOD_CHAIN.chainId;

  // Trade is gated behind FEATURES.tradeLive — these stay inert until launch.
  const buyToken = useCallback((usdc: number) => {
    if (usdc <= 0 || TREASURY.tokenPriceUsd <= 0) return;
    const taxed = usdc * (1 - TREASURY.taxRateBps / 10_000);
    const tokens = taxed / TREASURY.tokenPriceUsd;
    setWalletUsdc((b) => Math.max(0, b - usdc));
    setRobx((b) => b + tokens);
    setClaim((c) => c + usdc * (TREASURY.taxRateBps / 10_000) * 0.4);
  }, []);

  const sellToken = useCallback((robx: number) => {
    if (robx <= 0 || TREASURY.tokenPriceUsd <= 0) return;
    const gross = robx * TREASURY.tokenPriceUsd;
    const taxed = gross * (1 - TREASURY.taxRateBps / 10_000);
    setRobx((b) => Math.max(0, b - robx));
    setWalletUsdc((b) => b + taxed);
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
      wrongNetwork,
      robxBalance,
      claimUsdc,
      connecting,
      payoutChoice,
      txPending,
      refresh,
      setPayoutChoice,
      claim,
      walletUsdc,
      shareBps,
      positions,
      history,
      connect,
      switchNetwork,
      disconnect,
      buyToken,
      sellToken,
      openPosition,
      closePosition,
    }),
    [
      wallet,
      wrongNetwork,
      robxBalance,
      claimUsdc,
      connecting,
      payoutChoice,
      txPending,
      refresh,
      setPayoutChoice,
      claim,
      payoutChoice,
      txPending,
      refresh,
      setPayoutChoice,
      claim,
      walletUsdc,
      shareBps,
      positions,
      history,
      connect,
      switchNetwork,
      disconnect,
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
