// The keeper's epoch loop.
//
// Every epoch does two separate things:
//   1. ACCRUE — credit the fee that arrived since last time to holders, by
//      share. Everyone accrues every epoch, however small their stake.
//   2. PAY — swap and send only to holders whose accrued balance clears the
//      dollar floor. The rest keeps accruing, so the treasury never burns
//      account rent to deliver a few cents.

import { config } from "./config.js";
import { log } from "./log.js";
import { snapshotHolders, solBalance, treasury } from "./solana.js";
import { duePayouts, payGroup } from "./payout.js";
import { feeBalance, feeDecimals, swapFeeInto } from "./swap.js";
import {
  addAccrual,
  finishEpoch,
  getState,
  recordPayout,
  saveState,
  startEpoch,
  totalAccrued,
} from "./store.js";

export const state = {
  bootedAt: new Date().toISOString(),
  cluster: config.rpcUrl,
  mint: config.mint || null,
  treasury: treasury?.publicKey.toBase58() ?? null,
  dryRun: config.dryRun,
  lastCheck: null,
  lastEpochAt: null,
  lastError: null,
  holders: 0,
};

let running = false;

function epochDue() {
  if (!state.lastEpochAt) return true;
  return Date.now() - new Date(state.lastEpochAt).getTime() >= config.epochMinutes * 60_000;
}

export async function tickEpoch() {
  if (running) return;
  running = true;
  state.lastCheck = new Date().toISOString();
  let epoch = null;

  try {
    if (!epochDue()) {
      const left =
        config.epochMinutes * 60_000 - (Date.now() - new Date(state.lastEpochAt).getTime());
      log.info(`not due · next epoch in ~${Math.ceil(left / 60_000)}m`);
      return;
    }

    const holders = await snapshotHolders();
    state.holders = holders.length;
    if (!holders.length) {
      log.info("no holders yet — nothing to accrue");
      state.lastEpochAt = new Date().toISOString();
      return;
    }

    epoch = startEpoch();
    const decimals = await feeDecimals();

    // ── 1. accrue ────────────────────────────────────────────────────────
    // Everything in the treasury beyond what is already owed is new fee.
    const balance = await feeBalance();
    const owed = totalAccrued();
    const newFee = balance > owed ? balance - owed : 0n;

    if (newFee > 0n) {
      let handed = 0n;
      for (const h of holders) {
        // share is a float 0..1; scale through BigInt to keep the cents honest
        const cut = (newFee * BigInt(Math.round(h.share * 1e9))) / 1_000_000_000n;
        addAccrual(h.owner, cut);
        handed += cut;
      }
      saveState();
      log.info(
        `accrued ${newFee} raw across ${holders.length} holders (${newFee - handed} left as dust)`,
      );
    } else {
      log.info("no new fee since last epoch — nothing to accrue");
    }

    // ── 2. pay whoever cleared the floor ─────────────────────────────────
    const groups = duePayouts(decimals);
    if (!groups.length) {
      log.info(`nobody over the $${config.minPayoutUsd} floor yet — all balances carried`);
      finishEpoch(epoch, { newFeeRaw: newFee.toString(), holders: holders.length });
      state.lastEpochAt = new Date().toISOString();
      state.lastError = null;
      return;
    }

    for (const group of groups) {
      log.info(
        `${group.symbol}: ${group.owners.length} holders due, ${group.total} raw fee`,
      );
      const swap = await swapFeeInto(group.mint, group.total);
      const stockRaw = swap ? BigInt(swap.outAmount) : group.total; // dry-run keeps units
      await payGroup(group, stockRaw, epoch, recordPayout);
    }

    finishEpoch(epoch, { newFeeRaw: newFee.toString(), holders: holders.length });
    state.lastEpochAt = new Date().toISOString();
    state.lastError = null;
    log.info(`epoch #${epoch.id} done · ${groups.length} payout groups`);

    const sol = await solBalance();
    if (treasury && sol < config.minSolWarn) {
      log.warn(`treasury SOL low: ${sol} — tops up fees and account rent`);
    }
  } catch (e) {
    state.lastError = e.message;
    if (epoch) finishEpoch(epoch, { error: e.message });
    log.error("epoch error:", e.message);
  } finally {
    running = false;
  }
}

export function ledgerSummary() {
  const { ledger, totals, epochs } = getState();
  const entries = Object.values(ledger);
  return {
    owedAccounts: entries.length,
    owedRaw: totalAccrued().toString(),
    paidOutRaw: totals.paidOutRaw,
    epochsRun: totals.epochsRun,
    lastEpoch: epochs[0] ?? null,
  };
}
