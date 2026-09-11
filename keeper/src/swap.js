// Swap the accrued fee into the xStocks holders picked, via the Jupiter
// aggregator's public API (quote + swap, no SDK).

import { VersionedTransaction, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress, getAccount, getMint } from "@solana/spl-token";
import { config } from "./config.js";
import { log } from "./log.js";
import { connection, treasury, tokenProgramFor } from "./solana.js";

// quote-api.jup.ag/v6 was retired — its DNS record is gone, so every call
// there fails to connect rather than returning an error worth reading.
const JUPITER = "https://lite-api.jup.ag/swap/v1";

// A dollar, in the fee token's own raw units. USDC is the reference leg
// because one USDC is one dollar by construction.
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

let cachedDecimals = null;
let cachedUnitsPerDollar = null;

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
export async function treasuryBalance(mintStr) {
  if (!treasury || !mintStr) return 0n;
  try {
    const mint = new PublicKey(mintStr);
    const programId = await tokenProgramFor(mint);
    const ata = await getAssociatedTokenAddress(
      mint, treasury.publicKey, false, programId,
    );
    const account = await getAccount(connection, ata, undefined, programId);
    return account.amount;
  } catch {
    return 0n; // no token account yet
  }
}

export const feeBalance = () => treasuryBalance(config.feeMint);

// The TENDIE half of the creator fee. It is deliberately never swapped or
// distributed: it sits in the treasury as the buyback reserve. Reported so the
// pile is visible rather than looking like a stuck balance.
export const buybackReserve = () => treasuryBalance(config.mint);

// Thrown when the fee token could not be priced and never has been. The
// payout floor is a dollar figure, so without a rate there is no honest way to
// decide who clears it.
export class UnpricedFeeError extends Error {
  constructor(why) {
    super(`cannot price ${config.feeMint}: ${why}`);
    this.name = "UnpricedFeeError";
  }
}

// How many raw units of the fee token one dollar buys.
//
// The ledger counts fee-token units, but the payout floor is in dollars. While
// the fee accrued in USDC those were the same number; paired against a stock
// they differ by a factor of hundreds, so the floor has to be converted with a
// live rate or it silently becomes a $363 floor that nobody ever clears.
export async function feeUnitsPerDollar() {
  if (config.feeMint === USDC_MINT) return 1_000_000n; // a dollar is a dollar

  try {
    const url =
      `${JUPITER}/quote?inputMint=${USDC_MINT}&outputMint=${config.feeMint}` +
      `&amount=1000000&slippageBps=${config.slippageBps}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { outAmount } = await res.json();
    const units = BigInt(outAmount ?? 0);
    if (units <= 0n) throw new Error("empty quote");
    cachedUnitsPerDollar = units;
    return units;
  } catch (e) {
    // A stale rate is far better than a wrong one: too high a floor only makes
    // balances carry to the next epoch, which costs nobody anything.
    if (cachedUnitsPerDollar) {
      log.warn(`  could not price the fee token (${e.message}) — reusing the last rate`);
      return cachedUnitsPerDollar;
    }
    throw new UnpricedFeeError(e.message);
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
  // Paying out the very token the fee accrues in — pairing against TSLAx makes
  // this the common case, not an edge one. Asking Jupiter to route a mint to
  // itself just fails, and the caller's NoRouteError fallback would then pay
  // the right amount while logging a false alarm. Say so up front instead.
  if (outputMint === config.feeMint) {
    log.info(`  ${rawAmount} already in the payout token — no swap needed`);
    return null; // null means "units unchanged", which is exactly true here
  }

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
