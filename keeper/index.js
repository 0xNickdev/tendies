// RobinX keeper — Railway entry point.
// Boots the HTTP server (health/status) and the 30-minute epoch loop that
// collects the Pons creator fee, accrues it to ROBX holders and pays them out
// in tokenized stocks on Robinhood Chain.
//
// The treasury key is the only privileged key here: it is the Pons payout
// wallet, and it signs swaps and transfers out of the treasury and nothing
// else. It is NOT a token authority — ROBX is a fixed-supply ERC-20 minted by
// Pons; there is no contract of ours on chain.

import { config } from "./src/config.js";
import { log } from "./src/log.js";
import { logIdentity, ethBalance, treasury } from "./src/chain.js";
import { state, tickEpoch } from "./src/keeper.js";
import { loadState } from "./src/store.js";
import { startServer } from "./src/server.js";
import { refreshMarks } from "./src/oracle.js";
import { tickPositions } from "./src/perps.js";

async function main() {
  log.info("RobinX keeper starting…");
  loadState();
  startServer();
  logIdentity();

  if (config.dryRun) {
    log.warn(
      "DRY-RUN: set ROBX_TOKEN, TREASURY_PRIVATE_KEY and PAYOUT_TOKENS to go live.",
    );
  } else {
    const eth = await ethBalance();
    log.info(`treasury ETH ${eth}`);
    if (eth <= 0) log.warn("treasury has no ETH — fund it (~0.02 ETH on chain 4663)");
  }

  await tickEpoch();
  const timer = setInterval(tickEpoch, config.checkIntervalMs);

  // Marks run on their own clock, independent of the epoch: positions are
  // funded and checked for liquidation every few minutes, not every half hour.
  let marking = false;
  const tickMarks = async () => {
    if (marking) return;
    marking = true;
    try {
      const marks = await refreshMarks();
      if (marks.length) log.info(`marks · ${marks.map((m) => `${m.symbol} ${m.price}`).join(" · ")}`);
      await tickPositions();
    } catch (e) {
      log.error("mark tick error:", e.message);
    } finally {
      marking = false;
    }
  };
  await tickMarks();
  const markTimer = setInterval(tickMarks, config.perps.markIntervalMs);

  const shutdown = (sig) => {
    log.info(`${sig} received — shutting down`);
    clearInterval(timer);
    clearInterval(markTimer);
    process.exit(0);
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  log.info(`keeper running · epoch every ${config.epochMinutes}m`);
  if (treasury) log.info(`signer ${treasury.address}`);
  void state;
}

main().catch((e) => {
  log.error("fatal:", e.message);
  process.exit(1);
});
