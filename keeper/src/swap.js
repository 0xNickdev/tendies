// Swap the accrued fee (WETH) into the stocks holders picked, on Uniswap v3
// via SwapRouter02, quoted by QuoterV2. Paths are packed the way the fork
// tests in contracts/test/Fork.t.sol prove against the live pools:
//   WETH -(0.01%)-> USDG -(stock tier)-> stock

import { ethers } from "ethers";
import { config } from "./config.js";
import { log } from "./log.js";
import { provider, treasury, erc20, treasuryBalance } from "./chain.js";

const QUOTER_ABI = [
  "function quoteExactInput(bytes path, uint256 amountIn) returns (uint256 amountOut, uint160[] sqrtPriceX96AfterList, uint32[] initializedTicksCrossedList, uint256 gasEstimate)",
];
const ROUTER_ABI = [
  "function exactInput((bytes path, address recipient, uint256 amountIn, uint256 amountOutMinimum)) payable returns (uint256 amountOut)",
];

const quoter = new ethers.Contract(config.quoter, QUOTER_ABI, provider);
const router = treasury ? new ethers.Contract(config.router, ROUTER_ABI, treasury) : null;

export function feeDecimals() {
  return Promise.resolve(config.feeDecimals);
}

export const feeBalance = () => treasuryBalance(config.feeToken);

// The ROBX half of the creator fee. It is deliberately never swapped or
// distributed: it sits in the treasury as the buyback reserve. Reported so the
// pile is visible rather than looking like a stuck balance.
export const buybackReserve = () => treasuryBalance(config.token);

export const isUsdg = (a) => a.toLowerCase() === config.usdg.toLowerCase();
export const isWeth = (a) => a.toLowerCase() === config.weth.toLowerCase();

// Packed v3 path from the fee token to a payout stock. USDG is the hub every
// stock has depth against, so WETH takes one extra hop through it.
export function pathTo(stock) {
  const hops = [];
  if (isWeth(config.feeToken)) {
    hops.push(config.weth, config.wethUsdgFee, config.usdg);
  } else {
    hops.push(config.feeToken); // fee already in USDG
  }
  if (!isUsdg(stock.address)) hops.push(stock.fee, stock.address);
  return encodePath(hops);
}

export function encodePath(hops) {
  const types = [];
  for (let i = 0; i < hops.length; i++) types.push(i % 2 === 0 ? "address" : "uint24");
  return ethers.solidityPacked(types, hops);
}

// Thrown when the fee token could not be priced and never has been. The
// payout floor is a dollar figure, so without a rate there is no honest way to
// decide who clears it.
export class UnpricedFeeError extends Error {
  constructor(why) {
    super(`cannot price ${config.feeToken}: ${why}`);
    this.name = "UnpricedFeeError";
  }
}

let cachedUnitsPerDollar = null;
let cachedUnitsPerDollarAt = 0;
// /status, /account and /perps all need the rate, and the site polls them.
// A quote a few seconds old is as good as a fresh one for a payout floor, so
// share one across requests instead of asking the quoter on every hit.
const RATE_TTL_MS = 30_000;

// How many raw units of the fee token one dollar buys.
//
// The ledger counts fee-token units (wei of WETH), but the payout floor is in
// dollars. Quote a small round amount of WETH into USDG (a dollar by
// construction) and invert.
export async function feeUnitsPerDollar() {
  if (isUsdg(config.feeToken)) return 1_000_000n; // a dollar is a dollar
  if (cachedUnitsPerDollar && Date.now() - cachedUnitsPerDollarAt < RATE_TTL_MS) {
    return cachedUnitsPerDollar;
  }
  try {
    const probe = 10n ** BigInt(config.feeDecimals) / 100n; // 0.01 WETH: no price impact
    const path = encodePath([config.feeToken, config.wethUsdgFee, config.usdg]);
    const [usdgOut] = await quoter.quoteExactInput.staticCall(path, probe);
    if (usdgOut <= 0n) throw new Error("empty quote");
    // probe / (usdgOut / 1e6) = units per dollar
    const units = (probe * 1_000_000n) / usdgOut;
    if (units <= 0n) throw new Error("degenerate quote");
    cachedUnitsPerDollar = units;
    cachedUnitsPerDollarAt = Date.now();
    return units;
  } catch (e) {
    // A stale rate is far better than a wrong one: too high a floor only makes
    // balances carry to the next epoch, which costs nobody anything.
    if (cachedUnitsPerDollar) {
      log.warn(`  could not price the fee token (${e.shortMessage || e.message}) — reusing the last rate`);
      return cachedUnitsPerDollar;
    }
    throw new UnpricedFeeError(e.shortMessage || e.message);
  }
}

// Thrown when every attempt failed. The caller pays that group in the fee
// token instead of skipping them — a holder should never lose an epoch because
// a stock pool was thin at 3am.
export class NoRouteError extends Error {
  constructor(address) {
    super(`no route for ${address}`);
    this.name = "NoRouteError";
  }
}

async function quoteWithRetries(stock, rawAmount) {
  const path = pathTo(stock);
  let lastError = null;
  for (let attempt = 0; attempt < config.swapAttempts; attempt++) {
    try {
      const [amountOut] = await quoter.quoteExactInput.staticCall(path, rawAmount);
      if (amountOut > 0n) {
        if (attempt) log.info(`  route found on try ${attempt + 1}`);
        return { path, amountOut };
      }
      lastError = "zero out";
    } catch (e) {
      lastError = e.shortMessage || e.message;
    }
    log.warn(`  no route for ${stock.symbol} (try ${attempt + 1}/${config.swapAttempts}): ${lastError}`);
    if (attempt < config.swapAttempts - 1) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  throw new NoRouteError(stock.address);
}

// One unlimited approval per token to the router, checked every time so a
// fresh treasury (or a revoked allowance) is fixed rather than reverted on.
async function ensureAllowance(rawAmount) {
  const fee = erc20(config.feeToken, treasury);
  const have = await fee.allowance(treasury.address, config.router);
  if (have >= rawAmount) return;
  const tx = await fee.approve(config.router, ethers.MaxUint256);
  await tx.wait();
  log.info(`  approved router for the fee token (${tx.hash})`);
}

export async function swapFeeInto(stock, rawAmount) {
  // Paying out the very token the fee accrues in. Asking the router to route a
  // token to itself just fails, and the caller's NoRouteError fallback would
  // then pay the right amount while logging a false alarm. Say so up front.
  if (stock.address.toLowerCase() === config.feeToken.toLowerCase()) {
    log.info(`  ${rawAmount} already in the payout token — no swap needed`);
    return null; // null means "units unchanged", which is exactly true here
  }

  if (config.dryRun || !treasury || !router) {
    log.info(`  [dry-run] swap ${rawAmount} fee → ${stock.symbol}`);
    return null;
  }

  const { path, amountOut: quoted } = await quoteWithRetries(stock, rawAmount);
  await ensureAllowance(rawAmount);

  // What the swap actually delivers, not what it was quoted. Paying out the
  // quote could try to send more of the stock than the treasury received.
  const before = await treasuryBalance(stock.address);
  const minOut = (quoted * BigInt(10_000 - config.slippageBps)) / 10_000n;
  const tx = await router.exactInput({
    path,
    recipient: treasury.address,
    amountIn: rawAmount,
    amountOutMinimum: minOut,
  });
  const rcpt = await tx.wait();
  if (!rcpt || rcpt.status !== 1) throw new NoRouteError(stock.address);
  const received = (await treasuryBalance(stock.address)) - before;
  if (received <= 0n) throw new NoRouteError(stock.address); // swap landed nothing
  if (received < quoted) {
    log.info(`  filled ${received} vs ${quoted} quoted (${tx.hash})`);
  } else {
    log.info(`  swapped → ${stock.symbol}: ${tx.hash}`);
  }
  return { signature: tx.hash, outAmount: received };
}
