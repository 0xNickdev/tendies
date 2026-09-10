// ─── Launch configuration ────────────────────────────────────────────────
// Fill these in when the token goes live. Everything that depends on them
// shows a "TBA / Soon" state until they're set.

// TENDIE SPL mint on Solana.
// ⟵ PASTE THE MINT ADDRESS HERE after the stonkfun launch (enables balance reads)
export const TENDIE_MINT = "";

// TENDIE is launched on the stonkfun launchpad — coins paired with real
// assets. ⟵ PASTE THE COIN PAGE URL HERE once it exists, e.g.
//    https://www.stonkfun.xyz/coin/<mint>
export const BUY_TENDIE_URL = "https://www.stonkfun.xyz/";

// Treasury wallet that accumulates the trade fee and pays holders out in
// xStocks. ⟵ PASTE THE TREASURY PUBKEY HERE at launch.
export const TREASURY_WALLET = "";

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
