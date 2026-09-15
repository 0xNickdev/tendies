// Shared stock/reward configuration for RobinX.
// Rewards are paid in tokenized equities (Robinhood stock tokens on
// Robinhood Chain) — the holder picks which stock to receive.

export type StockSym = "TSLA" | "NVDA" | "SPCX";

export const DISTRIBUTION_MINUTES = 30; // treasury pays out every 30 min

export type PayoutStock = {
  symbol: StockSym;
  name: string;
  token: string; // tokenized-equity ticker on Robinhood Chain
  address: string; // canonical Robinhood Stock Token contract (chain id 4663)
  seedPrice: number; // fallback when the price API is unreachable
  priceSource: PriceSource;
};

// Every payout stock is Nasdaq-listed; the type stays so a DEX-priced asset
// could be added without touching the price routes.
export type PriceSource = "nasdaq" | "dex";

// Canonical Robinhood Stock Tokens — verified on-chain 2026-07-09.
export const PAYOUT_STOCKS: PayoutStock[] = [
  {
    symbol: "TSLA",
    name: "Tesla",
    token: "tTSLA",
    address: "0x322F0929c4625eD5bAd873c95208D54E1c003b2d",
    seedPrice: 399.5,
    priceSource: "nasdaq",
  },
  {
    symbol: "NVDA",
    name: "NVIDIA",
    token: "tNVDA",
    address: "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC",
    seedPrice: 196.8,
    priceSource: "nasdaq",
  },
  {
    symbol: "SPCX",
    name: "SpaceX",
    token: "tSPCX",
    address: "0x4a0E65A3EcceC6dBe60AE065F2e7bb85Fae35eEa",
    seedPrice: 145.0, // now public on Nasdaq (IPO Jun 2026)
    priceSource: "nasdaq",
  },
];

// Default payout for holders who never picked.
export const DEFAULT_STOCK = PAYOUT_STOCKS[0];

export const feedLabel = (_symbol: string) => "Live · Nasdaq feed";

// ─── Market listing (landing discovery grid) ──────────────────────────────
export type MarketClass = "payout" | "perps" | "nasdaq";

export type Market = {
  symbol: string;
  name: string;
  token?: string;
  classes: MarketClass[];
};

export const MARKETS: Market[] = [
  { symbol: "TSLA", name: "Tesla", token: "tTSLA", classes: ["payout", "perps", "nasdaq"] },
  { symbol: "NVDA", name: "NVIDIA", token: "tNVDA", classes: ["payout", "perps", "nasdaq"] },
  { symbol: "SPCX", name: "SpaceX", token: "tSPCX", classes: ["payout", "perps", "nasdaq"] },
  { symbol: "AAPL", name: "Apple", classes: ["nasdaq"] },
  { symbol: "META", name: "Meta Platforms", classes: ["nasdaq"] },
  { symbol: "GME", name: "GameStop", classes: ["nasdaq"] },
  { symbol: "PLTR", name: "Palantir", classes: ["nasdaq"] },
  { symbol: "COIN", name: "Coinbase", classes: ["nasdaq"] },
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

export type Quote = {
  symbol: string;
  price: number;
  changePct: number;
  live: boolean; // false → seed fallback
};
