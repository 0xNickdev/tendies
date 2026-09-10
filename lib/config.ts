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
export const KEEPER_URL = process.env.NEXT_PUBLIC_KEEPER_URL ?? "";

// ─── Solana mainnet-beta ─────────────────────────────────────────────────
// The public RPC is rate-limited — set NEXT_PUBLIC_SOLANA_RPC to a Helius /
// QuickNode / Triton endpoint before launch.
export const SOLANA = {
  cluster: "mainnet-beta",
  rpcUrl:
    process.env.NEXT_PUBLIC_SOLANA_RPC ?? "https://api.mainnet-beta.solana.com",
  explorer: "https://solscan.io",
  nativeCurrency: { name: "Solana", symbol: "SOL", decimals: 9 },
} as const;

export const explorerAccount = (address: string) =>
  `${SOLANA.explorer}/account/${address}`;
