// RobinX keeper — Railway entry point.
// Boots the chain wiring, HTTP server (health/status), the 30-minute
// distribute loop, and the share-sync sweep. Zero privileges: the keeper
// wallet only pays gas to call public functions.

import { config } from "./src/config.js";
import { log } from "./src/log.js";
import { initChain, gasBalanceEth } from "./src/chain.js";
import {
  state,
  tickDistribute,
  sweepSyncs,
  watchTransfers,
  refreshChainId,
} from "./src/keeper.js";
import { startServer } from "./src/server.js";

// Bring the chain wiring up, retrying forever so a bad RPC/config never
// crash-loops the container (health stays green while we retry).
async function initChainWithRetry() {
  let attempt = 0;
  for (;;) {
    try {
      const { robxAddr, usdgAddr } = await initChain();
      await refreshChainId();
      log.info(`keeper      ${state.keeper}`);
      log.info(`distributor ${config.distributor}`);
      log.info(`ROBX        ${robxAddr}`);
      log.info(`USDG        ${usdgAddr}`);
      log.info(`chainId     ${state.chainId}`);
      const gas = await gasBalanceEth();
      log.info(`gas balance ${gas} ETH`);
      if (gas <= 0) log.warn("keeper wallet has no gas — fund it (~0.01 ETH)");
      return;
    } catch (e) {
      attempt += 1;
      const wait = Math.min(60_000, 5_000 * attempt);
      state.lastError = `init: ${e.shortMessage || e.message}`;
      log.warn(
        `chain init failed (attempt ${attempt}): ${state.lastError} — retry in ${wait / 1000}s`,
      );
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

async function main() {
  log.info("RobinX keeper starting…");

  // 1) HTTP up first so Railway's /health passes immediately.
  startServer();

  // 2) Chain wiring (retries in the background, never exits).
  await initChainWithRetry();

  // 3) Keeper loops.
  watchTransfers();
  await tickDistribute();
  const distTimer = setInterval(tickDistribute, config.checkIntervalMs);
  const sweepTimer = setInterval(sweepSyncs, config.sweepIntervalMs);

  const shutdown = (sig) => {
    log.info(`${sig} received — shutting down`);
    clearInterval(distTimer);
    clearInterval(sweepTimer);
    process.exit(0);
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  log.info("keeper running.");
}

main().catch((e) => {
  log.error("fatal:", e.message);
  process.exit(1);
});
