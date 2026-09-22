// Protocol configuration & shared types for the RobinX terminal.
// No mock market data — live prices come from /api/prices, balances from the
// connected wallet, and positions from the chain once perps go live.

import { KEEPER_URL, ROBX_TOKEN_ADDRESS } from "./config";

// Feature flags — what's live vs. on the roadmap (see landing Roadmap section)
export const FEATURES = {
  tradeLive: Boolean(ROBX_TOKEN_ADDRESS), // unlocks with the ROBX token launch (see lib/config.ts)
  // Perps live in the keeper; pointing the site at it is the launch switch.
  perpsLive: Boolean(KEEPER_URL),
  autoTradingLive: false, // Phase 03 — strategy vaults / auto-trading
};

// Token economics (design constants). Live figures (treasury size, APR, spot
// price) come from the keeper's /status; the UI shows "TBA" until it is wired.
export const TREASURY = {
  totalUsdc: 0,
  // Pons pool fee is 1% of every swap; 70% of it is the creator share that
  // becomes the treasury — 0.7% of volume, taken by the pool, not a tax.
  poolFeeBps: 100,
  creatorSharePct: 70,
  tokenPriceUsd: 0,
  tokenSymbol: "ROBX",
  totalSupply: 1_000_000_000, // Pons mints a fixed 1B
  apr: 0,
};

export type Direction = "long" | "short";

// Robinhood Chain mainnet (verified on-chain).
export const NETWORK = {
  name: "Robinhood Chain",
  chainId: 4663,
  symbol: "ETH",
  explorer: "https://robinhoodchain.blockscout.com",
};
