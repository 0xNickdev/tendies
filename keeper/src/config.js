// Environment config + validation. Fails fast on boot if something's missing.

function required(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`[config] Missing required env var: ${name}`);
    process.exit(1);
  }
  return v;
}

export const config = {
  rpcUrl: process.env.RPC_URL || "https://rpc.mainnet.chain.robinhood.com",
  distributor: required("DISTRIBUTOR"),
  keeperKey: required("KEEPER_PRIVATE_KEY"),
  // polling cadence for the distribute check (ms)
  checkIntervalMs: Number(process.env.CHECK_INTERVAL_MS || 60_000),
  // how often the syncShare sweep runs (ms)
  sweepIntervalMs: Number(process.env.SWEEP_INTERVAL_MS || 5 * 60_000),
  // HTTP server port (Railway sets PORT automatically)
  port: Number(process.env.PORT || 3333),
  // warn if keeper gas balance drops below this (ETH)
  minGasWarn: Number(process.env.MIN_GAS_WARN || 0.002),
};
