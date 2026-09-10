// Swap the accrued fee into the xStocks holders picked, via the Jupiter
// aggregator's public API (quote + swap, no SDK).

import { VersionedTransaction, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress, getAccount, getMint } from "@solana/spl-token";
import { config } from "./config.js";
import { log } from "./log.js";
import { connection, treasury } from "./solana.js";

const JUPITER = "https://quote-api.jup.ag/v6";

let cachedDecimals = null;

export async function feeDecimals() {
  if (cachedDecimals != null) return cachedDecimals;
  try {
    const { decimals } = await getMint(connection, new PublicKey(config.feeMint));
    cachedDecimals = decimals;
  } catch {
    cachedDecimals = 6; // USDC
  }
  return cachedDecimals;
}

// Raw integer units — the ledger never touches floats.
export async function feeBalance() {
  if (!treasury) return 0n;
  try {
    const ata = await getAssociatedTokenAddress(
      new PublicKey(config.feeMint),
      treasury.publicKey,
    );
    const account = await getAccount(connection, ata);
    return account.amount;
  } catch {
    return 0n; // no fee account yet
  }
}

export async function swapFeeInto(outputMint, rawAmount) {
  if (config.dryRun || !treasury) {
    log.info(`  [dry-run] swap ${rawAmount} fee → ${outputMint}`);
    return null;
  }

  const quoteUrl =
    `${JUPITER}/quote?inputMint=${config.feeMint}&outputMint=${outputMint}` +
    `&amount=${rawAmount.toString()}&slippageBps=${config.slippageBps}`;
  const quote = await fetch(quoteUrl).then((r) => r.json());
  if (!quote?.outAmount) throw new Error(`no route for ${outputMint}`);

  const { swapTransaction } = await fetch(`${JUPITER}/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: treasury.publicKey.toBase58(),
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
    }),
  }).then((r) => r.json());

  const tx = VersionedTransaction.deserialize(Buffer.from(swapTransaction, "base64"));
  tx.sign([treasury]);
  const signature = await connection.sendRawTransaction(tx.serialize(), { maxRetries: 3 });
  await connection.confirmTransaction(signature, "confirmed");
  log.info(`  swapped → ${outputMint}: ${signature}`);
  return { signature, outAmount: Number(quote.outAmount) };
}
