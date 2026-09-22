// Payout: turn accrued balances into ERC-20 stock transfers.
//
// Holders do NOT get paid every epoch. Each epoch credits their share to the
// ledger; only balances that clear the dollar floor are actually swapped and
// sent, because every transfer is its own transaction and gas on a few cents
// costs more than the cents.

import { config } from "./config.js";
import { log } from "./log.js";
import { treasury, erc20 } from "./chain.js";
import { choiceOf, eligible, recordDelivery, settle } from "./store.js";

// Which stock an owner is paid in — their signed choice, or the first
// configured payout stock if they never picked one.
export function payoutFor(owner) {
  const picked = choiceOf(owner);
  const known = config.payoutTokens.find((p) => p.symbol === picked);
  return known ?? config.payoutTokens[0];
}

// Everyone whose accrued balance clears the floor, grouped by chosen stock.
//
// unitsPerDollar comes from feeUnitsPerDollar(): the floor is a dollar figure
// but the ledger counts fee-token units (wei of WETH).
export function duePayouts(unitsPerDollar) {
  const minRaw =
    (BigInt(Math.round(config.minPayoutUsd * 1e6)) * unitsPerDollar) / 1_000_000n;
  const groups = new Map();

  for (const { owner, accrued } of eligible(minRaw)) {
    const stock = payoutFor(owner);
    if (!stock) continue;
    if (!groups.has(stock.symbol)) {
      groups.set(stock.symbol, { ...stock, total: 0n, owners: [] });
    }
    const group = groups.get(stock.symbol);
    group.total += accrued;
    group.owners.push({ owner, accrued });
  }

  return [...groups.values()];
}

// Split the swapped stock across the group in proportion to what each owner
// accrued, then send it out one transfer at a time. The ledger is settled
// after every confirmed transfer, so a crash mid-epoch leaves the unpaid
// remainder still owed — never paid twice.
export async function payGroup(group, stockRawAmount, epoch, record) {
  if (config.dryRun || !treasury) {
    log.info(
      `  [dry-run] ${group.symbol}: ${group.owners.length} holders, ${stockRawAmount} raw`,
    );
    return { sent: 0, signatures: [] };
  }

  const stock = erc20(group.address, treasury);

  // integer maths only — no float rounding on money
  const cuts = group.owners.map(({ owner, accrued }) => ({
    owner,
    amount: (stockRawAmount * accrued) / group.total,
    accrued,
  }));

  const signatures = [];
  let sent = 0;

  // Book a confirmed transfer: profile, ledger, epoch journal - in that order,
  // so a crash between them can only under-report, never double-pay.
  const book = (cut, signature) => {
    recordDelivery(cut.owner, {
      epoch: epoch.id,
      at: new Date().toISOString(),
      symbol: group.symbol,
      amount: cut.amount.toString(),
      paidRaw: cut.accrued.toString(),
      signature,
    });
    settle([cut.owner]);
    record(epoch, {
      symbol: group.symbol,
      owners: 1,
      signature,
      paidRaw: cut.accrued.toString(),
    });
    signatures.push(signature);
    sent += 1;
  };

  for (const cut of cuts) {
    if (cut.amount <= 0n) continue;
    try {
      const tx = await stock.transfer(cut.owner, cut.amount);
      const rcpt = await tx.wait();
      if (!rcpt || rcpt.status !== 1) throw new Error("reverted");
      book(cut, tx.hash);
      log.info(`  ${group.symbol} → ${cut.owner.slice(0, 6)}…: ${tx.hash}`);
    } catch (e) {
      // One bad recipient must not hold the rest of the group hostage: whoever
      // fails stays owed and is tried again next epoch.
      log.warn(
        `  ${group.symbol} ${cut.owner.slice(0, 6)}… could not be paid (${e.shortMessage || e.message}) - stays owed`,
      );
    }
  }

  return { sent, signatures };
}
