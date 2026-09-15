// The keeper: triggers distribute() every epoch and heals share desyncs.

import { ethers } from "ethers";
import { config } from "./config.js";
import { log } from "./log.js";
import { distributor, chain, provider, wallet, gasBalanceEth } from "./chain.js";

// live status, exposed via the HTTP /status endpoint
export const state = {
  bootedAt: new Date().toISOString(),
  keeper: wallet.address,
  distributor: config.distributor,
  chainId: null,
  lastCheck: null,
  lastDistributionTx: null,
  lastError: null,
  distributionsSent: 0,
  syncsSent: 0,
};

let distributing = false;

async function withRetry(fn, label, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      const msg = e.shortMessage || e.message;
      if (i === tries - 1) throw e;
      log.warn(`${label} failed (try ${i + 1}/${tries}): ${msg} — retrying`);
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    }
  }
}

export async function tickDistribute() {
  if (distributing) return;
  distributing = true;
  state.lastCheck = new Date().toISOString();
  try {
    const ready = await distributor.canDistribute();
    if (!ready) {
      const [last, interval] = await Promise.all([
        distributor.lastDistribution(),
        distributor.epochInterval(),
      ]);
      const left = Math.max(
        0,
        Number(last) + Number(interval) - Math.floor(Date.now() / 1000),
      );
      log.info(`not ready · next epoch in ~${Math.ceil(left / 60)}m`);
      return;
    }

    log.info("epoch ready → distribute()");
    const tx = await withRetry(() => distributor.distribute(), "distribute");
    log.info(`  sent ${tx.hash}`);
    const rcpt = await tx.wait();
    const epoch = await distributor.epochCount();
    state.lastDistributionTx = tx.hash;
    state.distributionsSent += 1;
    state.lastError = null;
    log.info(`  confirmed in block ${rcpt.blockNumber} · epoch #${epoch}`);

    const gas = await gasBalanceEth();
    if (gas < config.minGasWarn) {
      log.warn(`keeper gas low: ${gas} ETH — top it up`);
    }
  } catch (e) {
    state.lastError = e.shortMessage || e.message;
    log.error("distribute error:", state.lastError);
  } finally {
    distributing = false;
  }
}

// ── share-sync sweep (AUDIT M-1) ─────────────────────────────────────────
// Watch ROBX transfers; any account whose ledger share drifts from its true
// balance gets healed. Cheap insurance against a gas-starved share hook.
const dirty = new Set();

export function watchTransfers() {
  if (!chain.robx) return;
  chain.robx.on("Transfer", (from, to) => {
    if (from && from !== ethers.ZeroAddress) dirty.add(from);
    if (to && to !== ethers.ZeroAddress) dirty.add(to);
  });
  log.info("watching ROBX transfers for share desyncs");
}

export async function sweepSyncs() {
  if (!chain.robx || dirty.size === 0) return;
  const accounts = [...dirty];
  dirty.clear();
  for (const a of accounts) {
    try {
      const [share, bal] = await Promise.all([
        distributor.shares(a),
        chain.robx.balanceOf(a),
      ]);
      if (share !== bal) {
        log.info(`desync ${a} (${share} ≠ ${bal}) → syncShare()`);
        const tx = await distributor.syncShare(a);
        await tx.wait();
        state.syncsSent += 1;
        log.info(`  healed ${tx.hash}`);
      }
    } catch (e) {
      log.warn(`sync ${a}: ${e.shortMessage || e.message}`);
    }
  }
}

export async function refreshChainId() {
  try {
    const net = await provider.getNetwork();
    state.chainId = Number(net.chainId);
  } catch {
    /* ignore */
  }
}
