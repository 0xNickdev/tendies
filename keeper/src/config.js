// Environment config + validation. The keeper boots in DRY-RUN whenever the
// launch addresses aren't set yet, so it can run (and be watched) before the
// token exists instead of crash-looping.
//
// Robinhood Chain (4663) addresses below are verified on-chain; see
// contracts/test/Fork.t.sol for the live quotes that prove the fee tiers.

export const ADDR = {
  WETH: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73",
  USDG: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168", // 6 decimals
  ROUTER: "0xCaf681a66D020601342297493863E78C959E5cb2", // SwapRouter02
  QUOTER: "0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7", // QuoterV2
  V3_FACTORY: "0x1f7d7550b1b028f7571e69a784071f0205fd2efa", // router.factory()
  // Pons v1: the locker holds the v3 LP position; collectFees(token) sends the
  // creator's share of the pool fee (WETH + token) to the payout wallet.
  PONS_LOCKER: "0x736D76699C26D0d966744cAe304C000d471f7F35",
  // Pons v2 (what ROBX launched on): a bonding curve first, a Uniswap v4 pool
  // after graduation. The creator's share does not land in the wallet at all -
  // it accrues inside a fee escrow, in NATIVE ETH, and is pulled with claim().
  PONS_V2_FACTORY: "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e",
  PONS_V2_FEE_ESCROW: "0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e",
};

// Tokenized stocks with real v3 depth against USDG (verified 2026-09-15).
const DEFAULT_PAYOUT_TOKENS =
  "TSLA:0x322F0929c4625eD5bAd873c95208D54E1c003b2d:3000," +
  "NVDA:0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC:500," +
  "SPCX:0x4a0E65A3EcceC6dBe60AE065F2e7bb85Fae35eEa:3000";

export const config = {
  rpcUrl: process.env.RPC_URL || "https://rpc.mainnet.chain.robinhood.com",
  chainId: Number(process.env.CHAIN_ID || 4663),

  // $ROBX ERC-20 minted by Pons — set after the launch.
  token: process.env.ROBX_TOKEN || "",
  // Block the token was deployed in. Optional: found by bisecting getCode
  // when unset, so the holder scan never starts from genesis.
  tokenStartBlock: Number(process.env.ROBX_START_BLOCK || 0),

  // Treasury = the Pons payout wallet. Holds the accrued fee (WETH), pays gas
  // and signs the payouts. Without it the keeper still snapshots and computes,
  // but sends nothing.
  treasuryKey: process.env.TREASURY_PRIVATE_KEY || "",

  // Stocks the treasury can pay out in, as SYMBOL:ADDRESS:USDG_POOL_FEE.
  payoutTokens: parseTriples(process.env.PAYOUT_TOKENS || DEFAULT_PAYOUT_TOKENS),

  // What the fee accrues in before it is swapped. Pons pools are TOKEN/WETH,
  // so the creator share arrives as WETH (plus the token side, kept as the
  // buyback reserve and never distributed).
  feeToken: process.env.FEE_TOKEN || ADDR.WETH,
  feeDecimals: Number(process.env.FEE_DECIMALS || 18),

  weth: process.env.WETH || ADDR.WETH,
  usdg: process.env.USDG || ADDR.USDG,
  router: process.env.SWAP_ROUTER || ADDR.ROUTER,
  quoter: process.env.QUOTER || ADDR.QUOTER,
  v3Factory: process.env.V3_FACTORY || ADDR.V3_FACTORY,
  // Pool fee tier of the WETH/USDG leg every swap starts with (0.01%).
  wethUsdgFee: Number(process.env.WETH_USDG_FEE || 100),

  // Pons v1 locker. Blank turns that path off; it is only used for a token
  // that was launched through the v1 factory.
  locker: process.env.PONS_LOCKER ?? ADDR.PONS_LOCKER,
  // Pons v2 fee escrow - the path ROBX actually uses. Blank turns it off.
  feeEscrow: process.env.PONS_FEE_ESCROW ?? ADDR.PONS_V2_FEE_ESCROW,
  // Native ETH kept back when wrapping the claimed fee, so the treasury can
  // always pay gas. Claimed ETH above this is wrapped into WETH and becomes
  // the fee the epoch distributes.
  gasReserveEth: Number(process.env.GAS_RESERVE_ETH || 0.01),
  // Below this there is nothing worth a claim transaction.
  minClaimEth: Number(process.env.MIN_CLAIM_ETH || 0.0005),

  // Accounts that must never receive rewards beyond what the keeper already
  // skips on its own (contracts, the pool, the treasury). Comma-separated.
  exclude: (process.env.EXCLUDE_ACCOUNTS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),

  // Durable state (accrual ledger, choices, epoch journal, holder cache). On
  // Railway this MUST be a mounted Volume — the container disk is wiped on
  // every redeploy.
  stateDir: process.env.STATE_DIR || "./data",

  // Public origins allowed to call the keeper (the site). Comma-separated;
  // the request's Origin is echoed back when it is on the list.
  allowOrigins: (process.env.ALLOW_ORIGIN || "*")
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean),

  slippageBps: Number(process.env.SLIPPAGE_BPS || 100),
  // How many times to look for a swap route before paying that group in the
  // fee token instead. Tolerance widens with each attempt.
  swapAttempts: Number(process.env.SWAP_ATTEMPTS || 3),

  epochMinutes: Number(process.env.EPOCH_MINUTES || 30),
  checkIntervalMs: Number(process.env.CHECK_INTERVAL_MS || 60_000),
  // Payout floor in DOLLARS, not tokens. Every payout is its own transaction
  // on EVM, so paying out a few cents costs more gas than it delivers —
  // anything under this keeps accruing instead.
  minPayoutUsd: Number(process.env.MIN_PAYOUT_USD || 1),

  // A signed choice message older than this is rejected (replay protection).
  choiceTtlMs: Number(process.env.CHOICE_TTL_MS || 10 * 60_000),
  port: Number(process.env.PORT || 3333),

  // ── perps ──────────────────────────────────────────────────────────────
  // The house is the counterparty to every position, and the house bankroll
  // is the reserve: a slice of each epoch's fee that is held back instead of
  // distributed, grown by funding and losing margin, drawn down by winners.
  // Every limit here is relative to that reserve, so a win can always be
  // paid from money that was never owed to anyone else. Margin comes out of
  // a holder's accrued balance, never from their wallet.
  perps: {
    enabled: (process.env.PERPS_ENABLED || "true") !== "false",
    maxLeverage: Number(process.env.PERPS_MAX_LEVERAGE || 10),
    minMarginUsd: Number(process.env.PERPS_MIN_MARGIN_USD || 1),
    // share of each epoch's new fee held back into the reserve…
    reserveBps: Number(process.env.PERPS_RESERVE_BPS || 1000),
    // …until the reserve reaches this share of the treasury's fee balance
    reserveCapPct: Number(process.env.PERPS_RESERVE_CAP_PCT || 20),
    // one position's size may be at most this share of the reserve
    maxPositionPct: Number(process.env.PERPS_MAX_POSITION_PCT || 50),
    // all open positions together, at most this share of the reserve
    maxOpenInterestPct: Number(process.env.PERPS_MAX_OI_PCT || 200),
    // liquidate once losses eat this much of the margin
    liquidationPct: Number(process.env.PERPS_LIQUIDATION_PCT || 95),
    // funding: a flat charge on position size, paid to the treasury every
    // interval. It is what makes holding leverage indefinitely cost something.
    fundingRateBps: Number(process.env.PERPS_FUNDING_BPS || 5),
    fundingIntervalMs: Number(process.env.PERPS_FUNDING_INTERVAL_MS || 8 * 60 * 60_000),
    // how often marks are refreshed and positions checked for liquidation
    markIntervalMs: Number(process.env.PERPS_MARK_INTERVAL_MS || 5 * 60_000),
    // With no treasury signer there is no fee flow to build a reserve from.
    // This stands in for it so the engine can be exercised before launch.
    dryRunReserveUsd: Number(process.env.PERPS_DRYRUN_RESERVE_USD || 0),
  },
  // Warn well before the treasury runs out of gas: every payout is a
  // transaction, so a wave of recipients drains a small ETH balance fast.
  minEthWarn: Number(process.env.MIN_ETH_WARN || 0.002),
  // Gas one ERC-20 transfer is budgeted at when checking the treasury can
  // afford an epoch. Generous: a cold recipient slot costs ~50k.
  transferGas: Number(process.env.TRANSFER_GAS || 80_000),
};

// A keeper with no token or no signer can compute but must not claim to pay.
config.dryRun =
  !config.token || !config.treasuryKey || config.payoutTokens.length === 0;

function parseTriples(raw) {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((triple) => {
      const [symbol, address, fee] = triple.split(":").map((x) => x.trim());
      if (!symbol || !address) return null;
      return { symbol, address, fee: Number(fee || 3000) };
    })
    .filter(Boolean);
}
