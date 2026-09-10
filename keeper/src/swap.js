// Swap the accrued fee into the xStocks holders picked, via the Jupiter
// aggregator's public API (quote + swap, no SDK).

import { VersionedTransaction, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress, getAccount, getMint } from "@solana/spl-token";
import { config } from "./config.js";
import { log } from "./log.js";
import { connection, treasury, tokenProgramFor } from "./solana.js";

const JUPITER = "https://quote-api.jup.ag/v6";

let cachedDecimals = null;

export async function feeDecimals() {
  if (cachedDecimals != null) return cachedDecimals;
  try {
    const mint = new PublicKey(config.feeMint);
    const { decimals } = await getMint(connection, mint, undefined, await tokenProgramFor(mint));
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
    const mint = new PublicKey(config.feeMint);
    const programId = await tokenProgramFor(mint);
    const ata = await getAssociatedTokenAddress(
      mint, treasury.publicKey, false, programId,
    );
    const account = await getAccount(connection, ata, undefined, programId);
    return account.amount;
  } catch {
    return 0n; // no fee account yet
  }
}

// Thrown when every attempt failed. The caller pays that group in the fee
// token instead of skipping them — a holder should never lose an epoch because
// an xStock had thin liquidity at 3am.
export class NoRouteError extends Error {
  constructor(mint) {
    super(`no route for ${mint}`);
    this.name = "NoRouteError";
  }
}

async function quoteWithRetries(outputMint, rawAmount) {
  let lastError = null;
  for (let attempt = 0; attempt < config.swapAttempts; attempt++) {
    // widen the tolerance each try: a thin book is the usual reason a route
    // that exists still can't be filled
    const slippage = config.slippageBps * (attempt + 1);
    try {
      const url =
        `${JUPITER}/quote?inputMint=${config.feeMint}&outputMint=${outputMint}` +
        `&amount=${rawAmount.toString()}&slippageBps=${slippage}`;
      const res = await fetch(url);
      const quote = res.ok ? await res.json() : null;
      if (quote?.outAmount) {
        if (attempt) log.info(`  route found on try ${attempt + 1} (slippage ${slippage}bps)`);
        return quote;
      }
      lastError = quote?.error ?? `HTTP ${res.status}`;
    } catch (e) {
      lastError = e.message;
    }
    log.warn(
      `  no route for ${outputMint} (try ${attempt + 1}/${config.swapAttempts}): ${lastError}`,
    );
    if (attempt < config.swapAttempts - 1) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  throw new NoRouteError(outputMint);
}

export async function swapFeeInto(outputMint, rawAmount) {
  if (config.dryRun || !treasury) {
    log.info(`  [dry-run] swap ${rawAmount} fee → ${outputMint}`);
    return null;
  }

  const quote = await quoteWithRetries(outputMint, rawAmount);

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
