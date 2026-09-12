// Shared stock/reward configuration for Tendies.
// Rewards are paid in tokenized equities on Solana: OpenAI via PreStocks
// (pre-IPO exposure through an SPV) and xStocks — Backed Finance's
// 1:1-collateralised equity tokens ("x" suffix). The holder picks which one.

export type StockSym = "OPENAI" | "TSLA" | "NVDA" | "SPCX";

// Where a live price comes from. Listed stocks quote off Nasdaq; a pre-IPO
// token has no exchange ticker, so its only price is the DEX pool's.
export type PriceSource = "nasdaq" | "dex";

export const DISTRIBUTION_MINUTES = 30; // treasury pays out every 30 min

export type PayoutStock = {
  symbol: StockSym;
  name: string;
  token: string; // xStock ticker on Solana
  mint: string; // SPL mint - ⟵ PASTE FROM xstocks.com / Solscan before launch
  seedPrice: number; // fallback when the price API is unreachable
  priceSource: PriceSource;
};

// Payout lineup. Each mint was verified on-chain before being written here:
// name, owning program and decimals all read back from the cluster.
//
// These are Token-2022 mints, not classic SPL - the keeper asks the chain
// which program owns each mint rather than assuming, because the
// associated-token address differs between the two. OPENAI has 9 decimals,
// the xStocks 8.
//
// The first entry is the quote asset TENDIE is paired against on stonkfun and
// the payout a holder gets if they never pick.
export const PAYOUT_STOCKS: PayoutStock[] = [
  {
    symbol: "OPENAI",
    name: "OpenAI",
    token: "OPENAI",
    // PreStocks pre-IPO token - the one stonkfun lists as a quote asset
    // (category "prestock"), not the smaller Tessera "tOpenAI".
    mint: "PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF",
    seedPrice: 1216.0,
    priceSource: "dex",
  },
  {
    symbol: "TSLA",
    name: "Tesla",
    token: "TSLAx",
    mint: "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB",
    seedPrice: 399.5,
    priceSource: "nasdaq",
  },
  {
    symbol: "NVDA",
    name: "NVIDIA",
    token: "NVDAx",
    mint: "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh",
    seedPrice: 196.8,
    priceSource: "nasdaq",
  },
  {
    symbol: "SPCX",
    name: "SpaceX",
    token: "SPCXx",
    mint: "Xs3oZwbHvqis4NYcf4YKWmEia2eC84wSiVrcYcTqpH8",
    seedPrice: 145.0, // now public on Nasdaq (IPO Jun 2026)
    priceSource: "nasdaq",
  },
];

export const DEFAULT_STOCK = PAYOUT_STOCKS[0];

// What the terminal calls the live feed for a given payout stock.
export const feedLabel = (symbol: string) =>
  PAYOUT_STOCKS.find((s) => s.symbol === symbol)?.priceSource === "dex"
    ? "Live · DEX feed"
    : "Live · Nasdaq feed";

// Basket shown in the landing live ticker (payout stocks first).
export const TICKER_SYMBOLS = [
  "OPENAI",
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
  OPENAI: 1216.0,
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
export type MarketClass = "payout" | "perps" | "nasdaq" | "preipo";

export type Market = {
  symbol: string;
  name: string;
  token?: string; // tokenized-equity ticker, when it is a payout asset
  classes: MarketClass[];
};

export const MARKETS: Market[] = [
  { symbol: "OPENAI", name: "OpenAI", token: "OPENAI", classes: ["payout", "perps", "preipo"] },
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
