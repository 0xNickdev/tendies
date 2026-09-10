// Durable keeper state: the accrual ledger, payout choices and the epoch
// journal, kept in one JSON file written atomically (temp + rename) so a crash
// mid-write can never leave a half-file behind.
//
// ⚠️ On Railway the container filesystem is ephemeral — mount a Volume at
// STATE_DIR, otherwise every redeploy wipes accrued balances and holders lose
// what they had not yet been paid.

import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";
import { log } from "./log.js";

const FILE = path.join(config.stateDir, "keeper-state.json");

const empty = () => ({
  version: 1,
  // owner -> { accrued: string (raw fee-token units), updatedAt }
  ledger: {},
  // owner -> { symbol, ts }
  choices: {},
  // newest first, capped
  epochs: [],
  totals: { paidOutRaw: "0", epochsRun: 0 },
});

let state = empty();

export function loadState() {
  try {
    fs.mkdirSync(config.stateDir, { recursive: true });
    if (fs.existsSync(FILE)) {
      const parsed = JSON.parse(fs.readFileSync(FILE, "utf8"));
      state = { ...empty(), ...parsed };
      const owners = Object.keys(state.ledger).length;
      log.info(`state loaded · ${owners} ledger entries · ${state.epochs.length} epochs`);
    } else {
      // No file means no history — start from a clean ledger rather than
      // whatever happens to be in memory from a previous load.
      state = empty();
      log.info(`no state file yet — starting fresh at ${FILE}`);
    }
  } catch (e) {
    // Never start on a corrupt ledger: paying from a half-parsed file would
    // send the wrong amounts to the wrong people.
    log.error(`state load failed (${e.message}) — refusing to start`);
    process.exit(1);
  }
  return state;
}

export function getState() {
  return state;
}

export function saveState() {
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, FILE);
}

// ── accrual ledger ────────────────────────────────────────────────────────
// Amounts are raw integer units of the fee token (USDC, 6 decimals), carried
// as strings because JSON numbers lose precision above 2^53.

export function accruedOf(owner) {
  return BigInt(state.ledger[owner]?.accrued ?? "0");
}

export function totalAccrued() {
  return Object.values(state.ledger).reduce(
    (sum, e) => sum + BigInt(e.accrued ?? "0"),
    0n,
  );
}

export function addAccrual(owner, amount) {
  if (amount <= 0n) return;
  const next = accruedOf(owner) + amount;
  state.ledger[owner] = { accrued: next.toString(), updatedAt: Date.now() };
}

// Called right after a batch confirms, so a crash can never double-pay:
// whatever is still in the ledger is still owed.
export function settle(owners) {
  for (const owner of owners) {
    delete state.ledger[owner];
  }
  saveState();
}

export function eligible(minRaw) {
  return Object.entries(state.ledger)
    .map(([owner, e]) => ({ owner, accrued: BigInt(e.accrued ?? "0") }))
    .filter((e) => e.accrued >= minRaw);
}

// ── payout choices ────────────────────────────────────────────────────────

export function choiceOf(owner) {
  return state.choices[owner]?.symbol ?? null;
}

export function setChoice(owner, symbol, ts) {
  state.choices[owner] = { symbol, ts };
  saveState();
}

export function choiceTs(owner) {
  return state.choices[owner]?.ts ?? 0;
}

// ── epoch journal ─────────────────────────────────────────────────────────

export function startEpoch() {
  const epoch = {
    id: state.totals.epochsRun + 1,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    status: "running",
    newFeeRaw: "0",
    holders: 0,
    payouts: [], // { symbol, owners, stockAmount, signature }
    error: null,
  };
  state.epochs.unshift(epoch);
  state.epochs = state.epochs.slice(0, 200);
  state.totals.epochsRun = epoch.id;
  saveState();
  return epoch;
}

export function recordPayout(epoch, entry) {
  epoch.payouts.push(entry);
  state.totals.paidOutRaw = (
    BigInt(state.totals.paidOutRaw) + BigInt(entry.paidRaw ?? "0")
  ).toString();
  saveState();
}

export function finishEpoch(epoch, patch = {}) {
  Object.assign(epoch, patch, {
    finishedAt: new Date().toISOString(),
    status: patch.error ? "failed" : "done",
  });
  saveState();
}
