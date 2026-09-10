import { NextResponse } from "next/server";

// Real OHLC history for the terminal charts.
//
// Yahoo's chart endpoint already carries the whole series next to the quote we
// were reading — this route just stops throwing it away. Two hosts are tried
// so a throttled query1 doesn't blank the chart; if both fail we return an
// empty series and the client falls back to its seeded preview candles.

export const dynamic = "force-dynamic";

const UA = { "User-Agent": "Mozilla/5.0 (compatible; Tendies/1.0)" };

export type Bar = {
  t: number; // unix seconds
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
};

// Yahoo has no 4h interval — we pull hourly and fold four bars into one.
const TF: Record<string, { range: string; interval: string; fold: number }> = {
  "15m": { range: "5d", interval: "15m", fold: 1 },
  "1H": { range: "1mo", interval: "1h", fold: 1 },
  "4H": { range: "6mo", interval: "1h", fold: 4 },
  "1D": { range: "2y", interval: "1d", fold: 1 },
};

function fold(bars: Bar[], size: number): Bar[] {
  if (size <= 1) return bars;
  const out: Bar[] = [];
  for (let i = 0; i < bars.length; i += size) {
    const group = bars.slice(i, i + size);
    if (!group.length) continue;
    out.push({
      t: group[0].t,
      o: group[0].o,
      h: Math.max(...group.map((b) => b.h)),
      l: Math.min(...group.map((b) => b.l)),
      c: group[group.length - 1].c,
      v: group.reduce((sum, b) => sum + b.v, 0),
    });
  }
  return out;
}

async function fromYahoo(
  symbol: string,
  host: string,
  range: string,
  interval: string,
): Promise<Bar[] | null> {
  try {
    const res = await fetch(
      `https://${host}/v8/finance/chart/${symbol}?range=${range}&interval=${interval}`,
      { headers: UA, next: { revalidate: 60 } },
    );
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    const ts: number[] = result?.timestamp ?? [];
    const q = result?.indicators?.quote?.[0];
    if (!ts.length || !q) return null;

    const bars: Bar[] = [];
    for (let i = 0; i < ts.length; i++) {
      const o = q.open?.[i];
      const h = q.high?.[i];
      const l = q.low?.[i];
      const c = q.close?.[i];
      // Yahoo leaves holes in intraday series — drop them rather than
      // interpolating, so nothing on the chart is invented.
      if ([o, h, l, c].some((n) => n == null || !isFinite(n))) continue;
      bars.push({ t: ts[i], o, h, l, c, v: Number(q.volume?.[i] ?? 0) });
    }
    return bars.length ? bars : null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbol = (url.searchParams.get("symbol") ?? "TSLA")
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, "")
    .slice(0, 12);
  const tfKey = url.searchParams.get("tf") ?? "1H";
  const tf = TF[tfKey] ?? TF["1H"];

  let bars: Bar[] | null = null;
  for (const host of ["query1.finance.yahoo.com", "query2.finance.yahoo.com"]) {
    bars = await fromYahoo(symbol, host, tf.range, tf.interval);
    if (bars) break;
  }

  const candles = bars ? fold(bars, tf.fold) : [];
  return NextResponse.json(
    { symbol, tf: tfKey, live: candles.length > 0, candles },
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
}
