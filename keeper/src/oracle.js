// Mark oracle for perps.
//
// Every few minutes the keeper prices each payout stock and records the mark,
// signed by the treasury key so anyone can check a published number came
// from here. Listed stocks are priced off their exchange quote (Yahoo, two
// hosts) with the DEX pool as a fallback; a pre-IPO token has no ticker, so
// the pool price is the only one there is.

import nacl from "tweetnacl";
import bs58 from "bs58";
import { config } from "./config.js";
import { log } from "./log.js";
import { treasury } from "./solana.js";
import { setMarks, markOf } from "./store.js";

const UA = { "User-Agent": "Mozilla/5.0 (compatible; TendiesKeeper/1.0)" };

// Payout stocks as perp markets. xStocks carry a trailing "x" on their ticker
// (TSLAx) and trade on an exchange; anything else is priced on-chain.
export function markets() {
  return config.payoutMints.map((p) => {
    const listed = /x$/.test(p.symbol);
    return {
      market: listed ? p.symbol.slice(0, -1) : p.symbol,
      symbol: p.symbol,
      mint: p.mint,
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

async function fromJupiter(mints) {
  const out = new Map();
  if (!mints.length) return out;
  try {
    const res = await fetch(`https://lite-api.jup.ag/price/v3?ids=${mints.join(",")}`, {
      headers: UA,
    });
    if (!res.ok) return out;
    const json = await res.json();
    for (const mint of mints) {
      const price = Number(json?.[mint]?.usdPrice);
      if (isFinite(price) && price > 0) out.set(mint, price);
    }
  } catch {
    /* every market falls back to its last mark */
  }
  return out;
}

// Exactly what is signed, so a reader can rebuild and verify it.
export function markMessage(market, price, at) {
  return `Tendies mark\nmarket: ${market}\nprice: ${price}\nat: ${at}`;
}

function sign(market, price, at) {
  if (!treasury) return null;
  const sig = nacl.sign.detached(
    new TextEncoder().encode(markMessage(market, price, at)),
    treasury.secretKey,
  );
  return bs58.encode(sig);
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
  const pool = await fromJupiter(viaPool.map((m) => m.mint));
  for (const m of viaPool) {
    const price = pool.get(m.mint);
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
      signature: sign(m.market, price, at),
    });
  }
  if (marks.length) setMarks(marks);
  return marks;
}
