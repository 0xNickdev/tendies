// Protocol configuration & shared types for the Tendies terminal.
// No mock market data — live prices come from /api/prices, balances from the
// connected wallet, and positions from the chain once perps go live.

// Feature flags — what's live vs. on the roadmap (see landing Roadmap section)
export const FEATURES = {
  tradeLive: false, // unlocks with the TENDIE token launch (see lib/config.ts)
  perpsLive: false, // Phase 02 — terminal shows a preview, trading is "Soon"
  autoTradingLive: false, // Phase 03 — strategy vaults / auto-trading
};

// Token economics (design constants). Live figures (treasury size, APR, spot
// price) stay 0 → the UI shows "TBA" until the token launches and real data
// is wired in.
export const TREASURY = {
  totalUsdc: 0,
  taxRateBps: 400, // 4% buy/sell tax → treasury
  tokenPriceUsd: 0,
  tokenSymbol: "TENDIE",
  // Where the 4% comes from: the stonkfun launchpad's creator fee share on
  // trading volume. If we ever mint TENDIE ourselves it becomes a Token-2022
  // transfer fee instead — same number, same destination.
  feeSource: "stonkfun creator fee",
  totalSupply: 100_000_000,
  decimals: 6, // SPL mint decimals
  apr: 0,
};

export type Direction = "long" | "short";

export type Position = {
  id: string;
  direction: Direction;
  leverage: number;
  marginUsdc: number;
  entryPrice: number;
  sizeUsd: number;
  liqPrice: number;
  openedAt: string;
};

// Positions come from the chain once perps are live (Phase 02).
export const OPEN_POSITIONS: Position[] = [];

export type ClosedPosition = {
  id: string;
  direction: Direction;
  leverage: number;
  marginUsdc: number;
  entryPrice: number;
  exitPrice: number;
  pnlUsd: number;
  settledAt: string;
};

export const CLOSED_POSITIONS: ClosedPosition[] = [];

// Solana mainnet-beta — TENDIE launches on the stonkfun launchpad.
export const NETWORK = {
  name: "Solana",
  cluster: "mainnet-beta",
  symbol: "SOL",
  launchpad: "stonkfun",
  explorer: "https://solscan.io",
};
