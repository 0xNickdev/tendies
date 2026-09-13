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
  // owner -> { totalPaid, streak, lastEpoch, firstEpoch, payouts: [...] }
  // Everything here is measured, never assigned: totalPaid is the sum of what
  // actually left the treasury, streak counts consecutive epochs the wallet
  // was in the holder snapshot. History is capped so the file stays bounded.
  profiles: {},
  // owner -> { symbol, ts }
  choices: {},
  // id -> position (see perps.js). Margin locked here is still owed to the
  // holder and must count as such wherever the ledger is totalled.
  positions: {},
  // closed positions, newest first, capped
  positionHistory: [],
  // symbol -> { price, at, source }, plus a short history for the chart
  marks: {},
  markHistory: [],
  // newest first, capped
  epochs: [],
  totals: { paidOutRaw: "0", epochsRun: 0 },
  // When the last epoch ran. Persisted because the epoch clock is a schedule,
  // not a runtime detail: kept in memory alone, every redeploy resets it to
  // "never" and fires an epoch immediately, so "every 30 minutes" quietly
  // becomes "every 30 minutes, plus once per deploy".
  lastEpochAt: null,
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

export function getLastEpochAt() {
  return state.lastEpochAt ?? null;
}

export function setLastEpochAt(iso) {
  state.lastEpochAt = iso;
  saveState();
}

export function accruedOf(owner) {
  return BigInt(state.ledger[owner]?.accrued ?? "0");
}

// Everything the treasury owes holders: unpaid accruals plus margin locked in
// open positions. The epoch loop treats balance minus this as new fee, so if
// locked margin were left out it would be handed out a second time.
export function totalAccrued() {
  const ledger = Object.values(state.ledger).reduce(
    (sum, e) => sum + BigInt(e.accrued ?? "0"),
    0n,
  );
  return ledger + lockedMargin();
}

export function lockedMargin() {
  return Object.values(state.positions).reduce(
    (sum, p) => sum + BigInt(p.marginRaw ?? "0"),
    0n,
  );
}

// Move margin out of the ledger into a position, or back. Debit refuses to
// go negative rather than trusting the caller's arithmetic.
export function debitAccrual(owner, amount) {
  const have = accruedOf(owner);
  if (amount > have) return false;
  const next = have - amount;
  if (next === 0n) delete state.ledger[owner];
  else state.ledger[owner] = { accrued: next.toString(), updatedAt: Date.now() };
  return true;
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

// ── holder profiles ───────────────────────────────────────────────────────

const HISTORY_CAP = 25; // per owner, newest first

function profile(owner) {
  if (!state.profiles[owner]) {
    state.profiles[owner] = {
      totalPaid: "0",
      streak: 0,
      lastEpoch: 0,
      firstEpoch: 0,
      payouts: [],
    };
  }
  return state.profiles[owner];
}

export function profileOf(owner) {
  const p = state.profiles[owner];
  if (!p) return { totalPaid: "0", streak: 0, lastEpoch: 0, firstEpoch: 0, payouts: [] };
  return p;
}

// Mark everyone present in this epoch's snapshot. A wallet that misses an
// epoch starts its streak over — that is what makes the number mean something.
export function markPresent(owners, epochId) {
  for (const owner of owners) {
    const p = profile(owner);
    p.streak = p.lastEpoch === epochId - 1 ? p.streak + 1 : 1;
    p.lastEpoch = epochId;
    if (!p.firstEpoch) p.firstEpoch = epochId;
  }
}

// Recorded only once a transfer has confirmed on chain.
export function recordDelivery(owner, entry) {
  const p = profile(owner);
  p.totalPaid = (BigInt(p.totalPaid) + BigInt(entry.paidRaw ?? "0")).toString();
  p.payouts.unshift(entry);
  p.payouts = p.payouts.slice(0, HISTORY_CAP);
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

// ── perps ─────────────────────────────────────────────────────────────────

const POSITION_HISTORY_CAP = 500;
const MARK_HISTORY_CAP = 2000; // ~1 week of 5-minute marks across 4 markets

export function positionsOf(owner) {
  return Object.values(state.positions).filter((p) => p.owner === owner);
}

export function allPositions() {
  return Object.values(state.positions);
}

export function positionById(id) {
  return state.positions[id] ?? null;
}

export function putPosition(pos) {
  state.positions[pos.id] = pos;
  saveState();
}

export function closePositionRecord(id, patch) {
  const pos = state.positions[id];
  if (!pos) return null;
  delete state.positions[id];
  const closed = { ...pos, ...patch };
  state.positionHistory.unshift(closed);
  state.positionHistory = state.positionHistory.slice(0, POSITION_HISTORY_CAP);
  saveState();
  return closed;
}

export function positionHistoryOf(owner, limit = 50) {
  return state.positionHistory.filter((p) => p.owner === owner).slice(0, limit);
}

export function markOf(symbol) {
  return state.marks[symbol] ?? null;
}

export function allMarks() {
  return state.marks;
}

export function setMarks(marks) {
  for (const m of marks) {
    state.marks[m.symbol] = m;
    state.markHistory.unshift(m);
  }
  state.markHistory = state.markHistory.slice(0, MARK_HISTORY_CAP);
  saveState();
}

export function markHistoryOf(symbol, limit = 288) {
  return state.markHistory.filter((m) => m.symbol === symbol).slice(0, limit);
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
