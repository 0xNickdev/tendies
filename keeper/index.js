// Tendies keeper — Railway entry point.
// Boots the HTTP server (health/status) and the 30-minute epoch loop that
// pays TENDIE holders out in xStocks on Solana.
//
// The treasury keypair is the only privileged key here: it signs swaps and
// transfers out of the treasury and nothing else. It is NOT a mint authority
// — TENDIE is minted by the stonkfun launchpad.

import { config } from "./src/config.js";
import { log } from "./src/log.js";
import { logIdentity, solBalance, treasury } from "./src/solana.js";
import { state, tickEpoch } from "./src/keeper.js";
import { loadState } from "./src/store.js";
import { startServer } from "./src/server.js";

async function main() {
  log.info("Tendies keeper starting…");
  loadState();
  startServer();
  logIdentity();

  if (config.dryRun) {
    log.warn(
      "DRY-RUN: set TENDIE_MINT, TREASURY_SECRET_KEY and PAYOUT_MINTS to go live.",
    );
  } else {
    const sol = await solBalance();
    log.info(`treasury SOL ${sol}`);
    if (sol <= 0) log.warn("treasury has no SOL — fund it (~0.1 SOL)");
  }

  await tickEpoch();
  const timer = setInterval(tickEpoch, config.checkIntervalMs);

  const shutdown = (sig) => {
    log.info(`${sig} received — shutting down`);
    clearInterval(timer);
    process.exit(0);
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  log.info(`keeper running · epoch every ${config.epochMinutes}m`);
  if (treasury) log.info(`signer ${treasury.publicKey.toBase58()}`);
  void state;
}

main().catch((e) => {
  log.error("fatal:", e.message);
  process.exit(1);
});
