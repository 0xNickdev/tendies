// Environment config + validation. The keeper boots in DRY-RUN whenever the
// launch addresses aren't set yet, so it can run (and be watched) before the
// token exists instead of crash-looping.

export const config = {
  rpcUrl: process.env.SOLANA_RPC || "https://api.mainnet-beta.solana.com",

  // TENDIE SPL mint — set after the stonkfun launch.
  mint: process.env.TENDIE_MINT || "",

  // Treasury keypair (base58 secret key) that holds the accrued fee and signs
  // the payouts. Without it the keeper still snapshots and computes, but
  // sends nothing.
  treasurySecret: process.env.TREASURY_SECRET_KEY || "",

  // xStock mints the treasury can pay out in, as SYMBOL:MINT pairs, e.g.
  //   PAYOUT_MINTS="TSLAx:Xs3...,NVDAx:Xs7...,SPCXx:Xs9..."
  payoutMints: parsePairs(process.env.PAYOUT_MINTS || ""),

  // What the fee accrues in before it is swapped (USDC by default).
  // ⚠ VERIFY this mint against solscan.io before funding anything — it is the
  // widely published Solana USDC mint, but confirm it yourself.
  feeMint:
    process.env.FEE_MINT || "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",

  // Accounts that must never receive rewards: the launchpad pool/curve, the
  // treasury itself, any CEX or LP account. Comma-separated pubkeys.
  exclude: (process.env.EXCLUDE_ACCOUNTS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  // Durable state (accrual ledger, choices, epoch journal). On Railway this
  // MUST be a mounted Volume — the container disk is wiped on every redeploy.
  stateDir: process.env.STATE_DIR || "./data",

  // Public origin allowed to POST payout choices (the site).
  allowOrigin: process.env.ALLOW_ORIGIN || "*",

  slippageBps: Number(process.env.SLIPPAGE_BPS || 100),

  epochMinutes: Number(process.env.EPOCH_MINUTES || 30),
  checkIntervalMs: Number(process.env.CHECK_INTERVAL_MS || 60_000),
  // Payout floor in DOLLARS, not tokens. Creating a holder's token account
  // costs the treasury ~0.002 SOL of rent, so paying out a few cents burns
  // more than it delivers — anything under this keeps accruing instead.
  minPayoutUsd: Number(process.env.MIN_PAYOUT_USD || 1),

  // A signed choice message older than this is rejected (replay protection).
  choiceTtlMs: Number(process.env.CHOICE_TTL_MS || 10 * 60_000),
  // transfers per transaction; Solana caps what fits in 1232 bytes
  transfersPerTx: Number(process.env.TRANSFERS_PER_TX || 8),
  port: Number(process.env.PORT || 3333),
  minSolWarn: Number(process.env.MIN_SOL_WARN || 0.05),
};

// A keeper with no mint or no signer can compute but must not claim to pay.
config.dryRun =
  !config.mint || !config.treasurySecret || config.payoutMints.length === 0;

function parsePairs(raw) {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((pair) => {
      const [symbol, mint] = pair.split(":").map((x) => x.trim());
      return symbol && mint ? { symbol, mint } : null;
    })
    .filter(Boolean);
}
