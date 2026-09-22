// Mark oracle for perps.
//
// Every few minutes the keeper prices each payout stock and records the mark,
// signed by the treasury key so anyone can check a published number came
// from here. Listed stocks are priced off their exchange quote (Yahoo, two
// hosts) with the Uniswap v3 USDG pool as a fallback; a token with no ticker
// (a pre-IPO name) is priced on the pool alone.

import { ethers } from "ethers";
import { config } from "./config.js";
import { log } from "./log.js";
import { treasury, provider, decimalsOf } from "./chain.js";
import { encodePath } from "./swap.js";
import { setMarks, markOf } from "./store.js";

const UA = { "User-Agent": "Mozilla/5.0 (compatible; RobinXKeeper/1.0)" };

// Payout stocks as perp markets. A symbol with a trailing "*" has no exchange
// listing (a pre-IPO token) and is priced on-chain only; everything else is a
// real ticker.
export function markets() {
  return config.payoutTokens.map((p) => {
    const listed = !/\*$/.test(p.symbol);
    return {
      market: listed ? p.symbol : p.symbol.slice(0, -1),
      symbol: p.symbol,
      address: p.address,
      fee: p.fee,
      listed,
    };
  });
}

export function marketFor(name) {
  return markets().find((m) => m.market === name) ?? null;
}

async function fromYahoo(ticker, host) {
  try {
    const res = await fetch(
      `https://${host}/v8/finance/chart/${ticker}?range=1d&interval=1d`,
      { headers: UA },
    );
    if (!res.ok) return null;
    const json = await res.json();
    const price = Number(json?.chart?.result?.[0]?.meta?.regularMarketPrice);
    return isFinite(price) && price > 0 ? price : null;
  } catch {
    return null;
  }
}

const QUOTER_ABI = [
  "function quoteExactInput(bytes path, uint256 amountIn) returns (uint256 amountOut, uint160[] a, uint32[] b, uint256 c)",
];
const quoter = new ethers.Contract(config.quoter, QUOTER_ABI, provider);

// Dollar price of one stock token off its USDG pool: sell 1 token, read USDG.
async function fromPool(list) {
  const out = new Map();
  for (const m of list) {
    try {
      const dec = await decimalsOf(m.address);
      const path = encodePath([m.address, m.fee, config.usdg]);
      const [usdg] = await quoter.quoteExactInput.staticCall(path, 10n ** BigInt(dec));
      const price = Number(usdg) / 1e6;
      if (isFinite(price) && price > 0) out.set(m.address, price);
    } catch {
      /* this market falls back to its last mark */
    }
  }
  return out;
}

// Exactly what is signed, so a reader can rebuild and verify it.
export function markMessage(market, price, at) {
  return `RobinX mark\nmarket: ${market}\nprice: ${price}\nat: ${at}`;
}

async function sign(market, price, at) {
  if (!treasury) return null;
  return treasury.signMessage(markMessage(market, price, at));
}

// Price every market once. A market that cannot be priced keeps its previous
// mark rather than getting a made-up one; positions on it simply are not
// re-checked until the next round.
export async function refreshMarks() {
  const list = markets();
  if (!list.length) return [];

  const at = new Date().toISOString();
  const priced = new Map();

  const listed = list.filter((m) => m.listed);
  for (const host of ["query1.finance.yahoo.com", "query2.finance.yahoo.com"]) {
    const missing = listed.filter((m) => !priced.has(m.market));
    if (!missing.length) break;
    const results = await Promise.all(missing.map((m) => fromYahoo(m.market, host)));
    results.forEach((price, i) => {
      if (price) priced.set(missing[i].market, { price, source: "nasdaq" });
    });
  }

  const viaPool = list.filter((m) => !priced.has(m.market));
  const pool = await fromPool(viaPool);
  for (const m of viaPool) {
    const price = pool.get(m.address);
    if (price) priced.set(m.market, { price, source: "dex" });
  }

  const marks = [];
  for (const m of list) {
    const hit = priced.get(m.market);
    if (!hit) {
      const last = markOf(m.market);
      log.warn(
        `mark ${m.market}: unpriced this round${last ? ` — keeping ${last.price} from ${last.at}` : ""}`,
      );
      continue;
    }
    const price = Math.round(hit.price * 100) / 100;
    marks.push({
      symbol: m.market,
      price,
      at,
      source: hit.source,
      signature: await sign(m.market, price, at),
    });
  }
  if (marks.length) setMarks(marks);
  return marks;
}
