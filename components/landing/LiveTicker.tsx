"use client";

import { TICKER_SYMBOLS, SEED_PRICES } from "@/lib/stocks";
import { useQuotes } from "@/lib/useQuotes";

// Landing marquee — real Nasdaq quotes from /api/prices (30s server cache,
// 60s client refresh). Seeds render until the first response lands.
export function LiveTicker() {
  const quotes = useQuotes();

  const items = TICKER_SYMBOLS.map((s) => {
    const q = quotes[s];
    return {
      symbol: s,
      price: q?.price ?? SEED_PRICES[s] ?? 0,
      changePct: q?.changePct ?? 0,
      live: q?.live ?? false,
    };
  });
  const row = [...items, ...items];

  return (
    <div className="relative overflow-hidden border-y-2 border-robin/25 bg-ink-900/60 py-3">
      <div className="flex w-max animate-ticker gap-8">
        {row.map((m, i) => (
          <span
            key={i}
            className="num flex items-center gap-2 whitespace-nowrap font-mono text-sm text-zinc-400"
          >
            <span className="text-robin">✦</span>
            <span className="font-bold text-zinc-200">{m.symbol}</span>
            <span className="font-bold text-white">${m.price.toFixed(2)}</span>
            <span className={m.changePct >= 0 ? "text-long" : "text-short"}>
              {m.changePct >= 0 ? "+" : ""}
              {m.changePct.toFixed(2)}%
            </span>
            {m.live && (
              <span className="relative ml-0.5 flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-long opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-long" />
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
