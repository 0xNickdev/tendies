// Shared stock/reward configuration for Tendies.
// Rewards are paid in xStocks — Backed Finance's 1:1-collateralised equity
// tokens on Solana (SPL, "x" suffix). The holder picks which one to receive.

export type StockSym = "TSLA" | "NVDA" | "SPCX";

export const DISTRIBUTION_MINUTES = 30; // treasury pays out every 30 min

export type PayoutStock = {
  symbol: StockSym;
  name: string;
  token: string; // xStock ticker on Solana
  mint: string; // SPL mint - ⟵ PASTE FROM xstocks.com / Solscan before launch
  seedPrice: number; // fallback when the price API is unreachable
};

// xStocks payout lineup. Each mint was verified on-chain before being written
// here: name, owning program and decimals all read back from the cluster.
//
// These are Token-2022 mints with 8 decimals, not classic SPL - the keeper
// asks the chain which program owns each mint rather than assuming, because
// the associated-token address differs between the two.
export const PAYOUT_STOCKS: PayoutStock[] = [
  {
    symbol: "TSLA",
    name: "Tesla",
    token: "TSLAx",
    mint: "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB",
    seedPrice: 399.5,
  },
  {
    symbol: "NVDA",
    name: "NVIDIA",
    token: "NVDAx",
    mint: "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh",
    seedPrice: 196.8,
  },
  {
    symbol: "SPCX",
    name: "SpaceX",
    token: "SPCXx",
    mint: "Xs3oZwbHvqis4NYcf4YKWmEia2eC84wSiVrcYcTqpH8",
    seedPrice: 145.0, // now public on Nasdaq (IPO Jun 2026)
  },
];

// Basket shown in the landing live ticker (payout stocks first).
export const TICKER_SYMBOLS = [
  "TSLA",
  "NVDA",
  "SPCX",
  "AAPL",
  "META",
  "GME",
  "PLTR",
  "COIN",
];

export const SEED_PRICES: Record<string, number> = {
  META: 720.0,
  TSLA: 399.5,
  SPCX: 145.0,
  NVDA: 196.8,
  AAPL: 305.6,
  GME: 22.9,
  PLTR: 130.5,
  COIN: 168.3,
};

// ─── Market listing (landing discovery grid) ──────────────────────────────
// Every ticker we surface, tagged by what you can actually do with it here.
export type MarketClass = "payout" | "perps" | "nasdaq";

export type Market = {
  symbol: string;
  name: string;
  token?: string; // tokenized-equity ticker, when it is a payout asset
  classes: MarketClass[];
};

export const MARKETS: Market[] = [
  { symbol: "TSLA", name: "Tesla", token: "TSLAx", classes: ["payout", "perps", "nasdaq"] },
  { symbol: "NVDA", name: "NVIDIA", token: "NVDAx", classes: ["payout", "perps", "nasdaq"] },
  { symbol: "SPCX", name: "SpaceX", token: "SPCXx", classes: ["payout", "perps", "nasdaq"] },
  { symbol: "AAPL", name: "Apple", classes: ["nasdaq"] },
  { symbol: "META", name: "Meta Platforms", classes: ["nasdaq"] },
  { symbol: "GME", name: "GameStop", classes: ["nasdaq"] },
  { symbol: "PLTR", name: "Palantir", classes: ["nasdaq"] },
  { symbol: "COIN", name: "Coinbase", classes: ["nasdaq"] },
];

export type Quote = {
  symbol: string;
  price: number;
  changePct: number;
  live: boolean; // false → seed fallback
};
