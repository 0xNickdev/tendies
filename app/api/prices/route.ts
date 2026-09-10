import { NextResponse } from "next/server";
import { TICKER_SYMBOLS, SEED_PRICES, type Quote } from "@/lib/stocks";

// Backend: real stock quotes for the ticker, perps marks, and reward pricing.
//
// Three sources, tried in order, because a single public feed is a single
// point of failure — a rate-limited Vercel IP would otherwise drop the whole
// site to seed prices:
//   1. Yahoo chart API on query1
//   2. the same API on query2 (separate host, survives query1 throttling)
//   3. CNBC's quote service — one batch call, fully independent of Yahoo
// Anything still missing falls back to a seed flagged live:false, which the UI
// labels "On-chain priced" instead of "Live · Nasdaq feed".

export const dynamic = "force-dynamic";

const UA = { "User-Agent": "Mozilla/5.0 (compatible; Tendies/1.0)" };

async function fromYahoo(symbol: string, host: string): Promise<Quote | null> {
  try {
    const res = await fetch(
      `https://${host}/v8/finance/chart/${symbol}?range=1d&interval=1d`,
      { headers: UA, next: { revalidate: 30 } },
    );
    if (!res.ok) return null;
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    const price = Number(meta?.regularMarketPrice);
    const prev = Number(meta?.chartPreviousClose ?? meta?.previousClose);
    if (!isFinite(price) || price <= 0) return null;
    const changePct = isFinite(prev) && prev > 0 ? ((price - prev) / prev) * 100 : 0;
    return { symbol, price, changePct, live: true };
  } catch {
    return null;
  }
}

// One request covers every missing symbol.
async function fromCnbc(symbols: string[]): Promise<Map<string, Quote>> {
  const out = new Map<string, Quote>();
  if (!symbols.length) return out;
  try {
    const res = await fetch(
      "https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol" +
        `?symbols=${symbols.join("|")}` +
        "&requestMethod=itv&noform=1&partnerId=2&fund=1&exthrs=1&output=json&events=1",
      { headers: UA, next: { revalidate: 30 } },
    );
    if (!res.ok) return out;
    const json = await res.json();
    const rows = json?.FormattedQuoteResult?.FormattedQuote;
    if (!Array.isArray(rows)) return out;
    for (const row of rows) {
      const symbol = String(row?.symbol ?? "").toUpperCase();
      // CNBC formats numbers for humans: "367.81", "1,234.56", "-0.10%"
      const price = Number(String(row?.last ?? "").replace(/,/g, ""));
      const prev = Number(String(row?.previous_day_closing ?? "").replace(/,/g, ""));
      if (!symbol || !isFinite(price) || price <= 0) continue;
      const changePct = isFinite(prev) && prev > 0 ? ((price - prev) / prev) * 100 : 0;
      out.set(symbol, { symbol, price, changePct, live: true });
    }
  } catch {
    /* fall through to seeds */
  }
  return out;
}

function seed(symbol: string): Quote {
  return { symbol, price: SEED_PRICES[symbol] ?? 100, changePct: 0, live: false };
}

export async function GET() {
  const found = new Map<string, Quote>();

  for (const host of ["query1.finance.yahoo.com", "query2.finance.yahoo.com"]) {
    const missing = TICKER_SYMBOLS.filter((s) => !found.has(s));
    if (!missing.length) break;
    const results = await Promise.all(missing.map((s) => fromYahoo(s, host)));
    results.forEach((q) => q && found.set(q.symbol, q));
  }

  const stillMissing = TICKER_SYMBOLS.filter((s) => !found.has(s));
  if (stillMissing.length) {
    const batch = await fromCnbc(stillMissing);
    batch.forEach((q, s) => found.set(s, q));
  }

  const quotes = TICKER_SYMBOLS.map((s) => found.get(s) ?? seed(s));
  return NextResponse.json(
    { quotes, updatedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "public, max-age=30" } },
  );
}
