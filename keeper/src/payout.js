// Payout: turn accrued balances into batched xStock transfers.
//
// Holders do NOT get paid every epoch. Each epoch credits their share to the
// ledger; only balances that clear the dollar floor are actually swapped and
// sent, because creating a recipient token account costs the treasury rent
// that can exceed a small payout many times over.

import {
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
  getMint,
} from "@solana/spl-token";
import { config } from "./config.js";
import { log } from "./log.js";
import { connection, treasury } from "./solana.js";
import { choiceOf, eligible, recordDelivery, settle } from "./store.js";

// Which stock an owner is paid in — their signed choice, or the first
// configured payout stock if they never picked one.
export function payoutFor(owner) {
  const picked = choiceOf(owner);
  const known = config.payoutMints.find((p) => p.symbol === picked);
  return known ?? config.payoutMints[0];
}

// Everyone whose accrued balance clears the floor, grouped by chosen stock.
export function duePayouts(feeDecimals) {
  const minRaw = BigInt(Math.round(config.minPayoutUsd * 10 ** feeDecimals));
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
// accrued, then send it out in batches. The ledger is settled batch by batch,
// so a crash mid-epoch leaves the unpaid remainder still owed — never paid twice.
export async function payGroup(group, stockRawAmount, epoch, record) {
  if (config.dryRun || !treasury) {
    log.info(
      `  [dry-run] ${group.symbol}: ${group.owners.length} holders, ${stockRawAmount} raw`,
    );
    return { sent: 0, signatures: [] };
  }

  const mint = new PublicKey(group.mint);
  const { decimals } = await getMint(connection, mint);
  const source = await getAssociatedTokenAddress(mint, treasury.publicKey);

  // integer maths only — no float rounding on money
  const cuts = group.owners.map(({ owner, accrued }) => ({
    owner,
    amount: (stockRawAmount * accrued) / group.total,
    accrued,
  }));

  const signatures = [];
  let sent = 0;

  for (let i = 0; i < cuts.length; i += config.transfersPerTx) {
    const batch = cuts.slice(i, i + config.transfersPerTx).filter((c) => c.amount > 0n);
    if (!batch.length) continue;

    const tx = new Transaction();
    for (const cut of batch) {
      const owner = new PublicKey(cut.owner);
      const destination = await getAssociatedTokenAddress(mint, owner);
      tx.add(
        createAssociatedTokenAccountIdempotentInstruction(
          treasury.publicKey,
          destination,
          owner,
          mint,
        ),
        createTransferCheckedInstruction(
          source,
          mint,
          destination,
          treasury.publicKey,
          cut.amount,
          decimals,
        ),
      );
    }

    const signature = await sendAndConfirmTransaction(connection, tx, [treasury]);

    // settle immediately: confirmed money leaves the ledger before we move on
    for (const cut of batch) {
      recordDelivery(cut.owner, {
        epoch: epoch.id,
        at: new Date().toISOString(),
        symbol: group.symbol,
        amount: cut.amount.toString(),
        paidRaw: cut.accrued.toString(),
        signature,
      });
    }
    settle(batch.map((c) => c.owner));
    record(epoch, {
      symbol: group.symbol,
      owners: batch.length,
      signature,
      paidRaw: batch.reduce((sum, c) => sum + c.accrued, 0n).toString(),
    });

    signatures.push(signature);
    sent += batch.length;
    log.info(`  ${group.symbol} batch ${signatures.length}: ${signature}`);
  }

  return { sent, signatures };
}
