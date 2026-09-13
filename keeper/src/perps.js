// Perps engine.
//
// A position is a bet against the treasury on the next marks of a reward
// stock. Margin is taken from the holder's accrued balance (never from their
// wallet), converted to dollars at the rate of that moment, and the position
// is then dollar-denominated: size, PnL, funding and liquidation are all in
// dollars, and whatever is left at close is converted back into fee-token
// units and returned to the ledger - from where it is paid out in stock like
// any other accrual.
//
// Losses stay in the treasury. The epoch loop sees them as new fee and hands
// them to every holder pro-rata, so the pool of TENDIE holders collectively
// takes the other side of every trade. That is why the limits in config are
// fractions of the treasury: no single trade may put more than a slice of
// everyone's rewards at risk.
//
// Open and close are authenticated the same way as payout choices: the wallet
// signs a short message, the keeper checks it against the owner's public key.

import nacl from "tweetnacl";
import bs58 from "bs58";
import { randomBytes } from "node:crypto";
import { config } from "./config.js";
import { log } from "./log.js";
import { feeUnitsPerDollar } from "./swap.js";
import { treasury } from "./solana.js";
import {
  accruedOf,
  addAccrual,
  adjustReserve,
  reserveOf,
  debitAccrual,
  allPositions,
  closePositionRecord,
  markOf,
  positionById,
  positionsOf,
  putPosition,
  saveState,
} from "./store.js";
import { marketFor } from "./oracle.js";

const usd = (n) => Math.round(n * 100) / 100;
const usdToRaw = (dollars, unitsPerDollar) =>
  (BigInt(Math.round(dollars * 1e6)) * unitsPerDollar) / 1_000_000n;
const rawToUsd = (raw, unitsPerDollar) => Number(raw) / Number(unitsPerDollar);

// ── messages the wallet signs ───────────────────────────────────────────

export function openMessage({ market, side, leverage, marginUsd, ts }) {
  return (
    `Tendies perp open\nmarket: ${market}\nside: ${side}\n` +
    `leverage: ${leverage}\nmargin: ${Number(marginUsd).toFixed(2)}\nts: ${ts}`
  );
}

export function closeMessage({ id, ts }) {
  return `Tendies perp close\nposition: ${id}\nts: ${ts}`;
}

function verify(message, owner, signature) {
  try {
    return nacl.sign.detached.verify(
      new TextEncoder().encode(message),
      bs58.decode(signature),
      bs58.decode(owner),
    );
  } catch {
    return false;
  }
}

function fresh(ts) {
  const age = Date.now() - Number(ts);
  return isFinite(age) && age <= config.choiceTtlMs && age >= -60_000;
}

// ── valuation ───────────────────────────────────────────────────────────

// Unrealised PnL in dollars against a mark. Long wins when the mark rises.
export function pnlUsd(pos, mark) {
  const move = mark / pos.entry - 1;
  return usd(pos.sizeUsd * (pos.side === "long" ? move : -move));
}

// What the position is worth right now: margin less funding paid, plus PnL.
export function equityUsd(pos, mark) {
  return usd(pos.marginUsd - pos.fundingPaidUsd + pnlUsd(pos, mark));
}

// The mark at which equity hits the liquidation threshold.
export function liquidationPrice(pos) {
  const keep = pos.marginUsd * (1 - config.perps.liquidationPct / 100);
  const lossAllowed = pos.marginUsd - pos.fundingPaidUsd - keep;
  const move = lossAllowed / pos.sizeUsd;
  const px = pos.side === "long" ? pos.entry * (1 - move) : pos.entry * (1 + move);
  return Math.round(px * 100) / 100;
}

export function view(pos) {
  const mark = markOf(pos.symbol);
  const price = mark?.price ?? pos.entry;
  return {
    id: pos.id,
    owner: pos.owner,
    symbol: pos.symbol,
    side: pos.side,
    leverage: pos.leverage,
    marginUsd: pos.marginUsd,
    sizeUsd: pos.sizeUsd,
    entry: pos.entry,
    mark: price,
    markAt: mark?.at ?? null,
    pnlUsd: pnlUsd(pos, price),
    equityUsd: equityUsd(pos, price),
    fundingPaidUsd: pos.fundingPaidUsd,
    liqPrice: liquidationPrice(pos),
    openedAt: pos.openedAt,
    nextFundingAt: new Date(pos.lastFundingAt + config.perps.fundingIntervalMs).toISOString(),
  };
}

// ── limits ──────────────────────────────────────────────────────────────

// The house bankroll in dollars. Before launch there is no fee flow to build
// one, so a configured stand-in lets the engine be exercised.
function reserveUsd(unitsPerDollar) {
  if (!treasury) return config.perps.dryRunReserveUsd;
  return rawToUsd(reserveOf(), unitsPerDollar);
}

export function openInterestUsd() {
  return usd(allPositions().reduce((sum, p) => sum + p.sizeUsd, 0));
}

export function limits(unitsPerDollar) {
  const reserve = usd(reserveUsd(unitsPerDollar));
  return {
    reserveUsd: reserve,
    maxPositionUsd: usd((reserve * config.perps.maxPositionPct) / 100),
    maxOpenInterestUsd: usd((reserve * config.perps.maxOpenInterestPct) / 100),
    openInterestUsd: openInterestUsd(),
  };
}

// ── open ────────────────────────────────────────────────────────────────

export async function openPosition(body) {
  const { owner, market, side, leverage, marginUsd, ts, signature } = body ?? {};
  if (!config.perps.enabled) return { ok: false, error: "perps are paused" };
  if (!owner || !market || !side || !leverage || !marginUsd || !ts || !signature) {
    return { ok: false, error: "owner, market, side, leverage, marginUsd, ts and signature are required" };
  }
  if (side !== "long" && side !== "short") return { ok: false, error: "side must be long or short" };

  const lev = Number(leverage);
  if (!Number.isInteger(lev) || lev < 1 || lev > config.perps.maxLeverage) {
    return { ok: false, error: `leverage must be a whole number from 1 to ${config.perps.maxLeverage}` };
  }
  const margin = usd(Number(marginUsd));
  if (!isFinite(margin) || margin < config.perps.minMarginUsd) {
    return { ok: false, error: `margin must be at least $${config.perps.minMarginUsd}` };
  }
  if (!fresh(ts)) return { ok: false, error: "signature expired — sign again" };
  if (!verify(openMessage({ market, side, leverage: lev, marginUsd: margin, ts }), owner, signature)) {
    return { ok: false, error: "signature does not match owner" };
  }

  const m = marketFor(market);
  if (!m) return { ok: false, error: `unknown market: ${market}` };
  const mark = markOf(market);
  if (!mark) return { ok: false, error: `${market} has no mark yet — try again in a minute` };
  if (Date.now() - new Date(mark.at).getTime() > 3 * config.perps.markIntervalMs) {
    return { ok: false, error: `${market} mark is stale — trading paused until it refreshes` };
  }

  let unitsPerDollar;
  try {
    unitsPerDollar = await feeUnitsPerDollar();
  } catch (e) {
    return { ok: false, error: `cannot price margin right now: ${e.message}` };
  }

  // The holder's free balance is what is in the ledger; margin already in
  // positions has left it. Compare in dollars so the error makes sense.
  const marginRaw = usdToRaw(margin, unitsPerDollar);
  const freeRaw = accruedOf(owner);
  if (marginRaw > freeRaw) {
    return {
      ok: false,
      error: `insufficient accrued balance: $${rawToUsd(freeRaw, unitsPerDollar).toFixed(2)} available`,
    };
  }

  const sizeUsd = usd(margin * lev);
  const lim = limits(unitsPerDollar);
  if (sizeUsd > lim.maxPositionUsd) {
    return { ok: false, error: `position too large: max $${lim.maxPositionUsd.toFixed(2)} right now (${config.perps.maxPositionPct}% of the house reserve)` };
  }
  if (lim.openInterestUsd + sizeUsd > lim.maxOpenInterestUsd) {
    return { ok: false, error: `house is at its open-interest cap ($${lim.maxOpenInterestUsd.toFixed(2)}) - try a smaller size or later` };
  }

  if (!debitAccrual(owner, marginRaw)) {
    return { ok: false, error: "insufficient accrued balance" };
  }
  const now = Date.now();
  const pos = {
    id: bs58.encode(randomBytes(8)),
    owner,
    symbol: market,
    side,
    leverage: lev,
    marginUsd: margin,
    marginRaw: marginRaw.toString(),
    sizeUsd,
    entry: mark.price,
    openedAt: new Date(now).toISOString(),
    lastFundingAt: now,
    fundingPaidUsd: 0,
  };
  putPosition(pos);
  log.info(`perp open ${pos.id} ${owner.slice(0, 6)}… ${side} ${market} ×${lev} $${margin} @ ${mark.price}`);
  return { ok: true, position: view(pos) };
}

// ── close / settle ──────────────────────────────────────────────────────

// Return what is left of the position to the ledger. The margin itself was
// the holder's all along; anything above it is a win paid out of the house
// reserve, anything below it is a loss the reserve keeps. If the reserve
// cannot cover a win in full - a run of winners against a young reserve -
// the payout is trimmed to what is there and the trim is recorded. Equity
// below zero is impossible past liquidation, but clamp anyway.
async function settle(pos, mark, reason, returned = equityUsd(pos, mark)) {
  let equity = Math.max(0, returned);
  let unitsPerDollar;
  try {
    unitsPerDollar = await feeUnitsPerDollar();
  } catch (e) {
    throw new Error(`cannot settle ${pos.id}: ${e.message}`);
  }
  const marginRaw = BigInt(pos.marginRaw);
  let returnRaw = usdToRaw(equity, unitsPerDollar);
  let trimmedUsd = 0;
  if (returnRaw > marginRaw) {
    const paid = -adjustReserve(-(returnRaw - marginRaw)); // what the reserve could give
    const short = returnRaw - marginRaw - paid;
    if (short > 0n) {
      trimmedUsd = usd(rawToUsd(short, unitsPerDollar));
      returnRaw = marginRaw + paid;
      equity = usd(rawToUsd(returnRaw, unitsPerDollar));
      log.warn(`  reserve short by $${trimmedUsd} on ${pos.id} - win trimmed to what the house holds`);
    }
  } else {
    adjustReserve(marginRaw - returnRaw);
  }
  addAccrual(pos.owner, returnRaw);
  const closed = closePositionRecord(pos.id, {
    closedAt: new Date().toISOString(),
    exit: mark,
    reason,
    pnlUsd: pnlUsd(pos, mark),
    returnedUsd: equity,
    returnedRaw: returnRaw.toString(),
    trimmedUsd,
  });
  log.info(`perp ${reason} ${pos.id} ${pos.side} ${pos.symbol} @ ${mark} · pnl $${closed.pnlUsd} · returned $${equity} · reserve ${reserveOf()}`);
  return closed;
}

export async function closePosition(body) {
  const { owner, id, ts, signature } = body ?? {};
  if (!owner || !id || !ts || !signature) {
    return { ok: false, error: "owner, id, ts and signature are required" };
  }
  if (!fresh(ts)) return { ok: false, error: "signature expired — sign again" };
  if (!verify(closeMessage({ id, ts }), owner, signature)) {
    return { ok: false, error: "signature does not match owner" };
  }
  const pos = positionById(id);
  if (!pos || pos.owner !== owner) return { ok: false, error: "no such open position" };
  const mark = markOf(pos.symbol);
  if (!mark) return { ok: false, error: "no mark to settle against" };

  try {
    const closed = await settle(pos, mark.price, "closed");
    return { ok: true, position: closed };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ── the tick: funding, then liquidation ─────────────────────────────────

// Runs after every mark refresh. Funding is charged first so a position that
// only survives because its funding is overdue does not get another round.
export async function tickPositions() {
  const now = Date.now();
  const { fundingRateBps, fundingIntervalMs, liquidationPct } = config.perps;
  let touched = false;

  for (const pos of allPositions()) {
    while (now - pos.lastFundingAt >= fundingIntervalMs) {
      pos.fundingPaidUsd = usd(pos.fundingPaidUsd + (pos.sizeUsd * fundingRateBps) / 10_000);
      pos.lastFundingAt += fundingIntervalMs;
      touched = true;
    }
  }
  if (touched) saveState();

  for (const pos of allPositions()) {
    const mark = markOf(pos.symbol);
    if (!mark) continue;
    const equity = equityUsd(pos, mark.price);
    const floor = pos.marginUsd * (1 - liquidationPct / 100);
    if (equity <= floor) {
      try {
        // Liquidation keeps the remaining sliver as the treasury's fee: the
        // trader gets nothing back, which is what the liquidation line means.
        await settle(pos, mark.price, "liquidated", 0);
      } catch (e) {
        log.error(`liquidation of ${pos.id} failed: ${e.message}`);
      }
    }
  }
}

export async function summary() {
  const open = allPositions();
  const unitsPerDollar = await feeUnitsPerDollar().catch(() => null);
  const lim = unitsPerDollar ? limits(unitsPerDollar) : null;
  return {
    enabled: config.perps.enabled,
    openPositions: open.length,
    openInterestUsd: openInterestUsd(),
    reserveUsd: lim?.reserveUsd ?? null,
    maxPositionUsd: lim?.maxPositionUsd ?? null,
    maxOpenInterestUsd: lim?.maxOpenInterestUsd ?? null,
    reserveBps: config.perps.reserveBps,
    reserveCapPct: config.perps.reserveCapPct,
    maxLeverage: config.perps.maxLeverage,
    minMarginUsd: config.perps.minMarginUsd,
    fundingRateBps: config.perps.fundingRateBps,
    fundingIntervalHours: config.perps.fundingIntervalMs / 3_600_000,
    liquidationPct: config.perps.liquidationPct,
    maxPositionPct: config.perps.maxPositionPct,
    maxOpenInterestPct: config.perps.maxOpenInterestPct,
  };
}

export { positionsOf };
