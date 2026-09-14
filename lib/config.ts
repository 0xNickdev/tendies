// ─── Launch configuration ────────────────────────────────────────────────
// Fill these in when the token goes live. Everything that depends on them
// shows a "TBA / Soon" state until they're set.

// TENDIEPERP SPL mint on Solana.
// ⟵ PASTE THE MINT ADDRESS HERE after the stonkfun launch (enables balance reads)
export const TENDIE_MINT = "vMTmvXKesQX8hTuikEr7j19H6k4oXwVCPxkVNbESHfY";

// TENDIEPERP is launched on the stonkfun launchpad — coins paired with real
// assets. ⟵ PASTE THE COIN PAGE URL HERE once it exists, e.g.
//    https://www.stonkfun.xyz/coin/<mint>
export const BUY_TENDIE_URL = "https://www.stonkfun.xyz/token/vMTmvXKesQX8hTuikEr7j19H6k4oXwVCPxkVNbESHfY";

// Treasury wallet that accumulates the trade fee and pays holders out in
// xStocks. ⟵ PASTE THE TREASURY PUBKEY HERE at launch.
export const TREASURY_WALLET = "58HkY764t9XNyzeVapVm5SqpN5TUoEGrp6mfXJer7Hf7";

// Bump whenever the kitchen card's artwork changes. X caches link previews by
// URL for about a week, so a redesigned card would otherwise keep showing the
// old picture to everyone who shared before. The version rides in the shared
// URL and in og:image, giving the crawler a fresh address to fetch.
export const CARD_VERSION = 2;

// Canonical public origin - what share links and OG images point at.
export const SITE_URL = "https://tendiesonstonk.com";

// The keeper service (accrual ledger + payout choices). Set
// NEXT_PUBLIC_KEEPER_URL to the Railway URL; blank disables the payout-choice
// UI instead of letting it pretend to work.
// Normalised, because a value pasted without a scheme ("host.up.railway.app")
// would be treated as a relative path by fetch and fail silently.
export const KEEPER_URL = (() => {
  const raw = (process.env.NEXT_PUBLIC_KEEPER_URL ?? "").trim();
  if (!raw) return "";
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withScheme.replace(/\/+$/, "");
})();

// ─── Solana mainnet-beta ─────────────────────────────────────────────────
// Balance reads go through /api/rpc, which forwards to SOLANA_RPC on the
// server. The endpoint URL carries a paid API key, so it must NOT be exposed
// as NEXT_PUBLIC_* — that would inline it into the browser bundle.
export const SOLANA = {
  cluster: "mainnet-beta",
  rpcUrl: "/api/rpc",
  explorer: "https://solscan.io",
  nativeCurrency: { name: "Solana", symbol: "SOL", decimals: 9 },
} as const;

export const explorerAccount = (address: string) =>
  `${SOLANA.explorer}/account/${address}`;
