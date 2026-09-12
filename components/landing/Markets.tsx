"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MARKETS, SEED_PRICES, type MarketClass } from "@/lib/stocks";
import { useQuotes } from "@/lib/useQuotes";
import { useReducedMotion } from "@/lib/motion";
import { Reveal } from "@/components/Reveal";

// Sorts are limited to what we can compute from the live feed — no invented
// market caps or volumes.
const SORTS = [
  { id: "movers", label: "Top movers" },
  { id: "price", label: "Price" },
  { id: "az", label: "A-Z" },
] as const;
type SortId = (typeof SORTS)[number]["id"];

const FILTERS: { id: "all" | MarketClass; label: string }[] = [
  { id: "all", label: "All" },
  { id: "payout", label: "Payout stocks" },
  { id: "perps", label: "Perps" },
  { id: "nasdaq", label: "Nasdaq" },
];

// A market card: a link for the stocks you can actually receive, an inert panel
// for the ones that are only on the feed.
function Card({
  symbol,
  payout,
  children,
  ...rest
}: {
  symbol: string;
  payout: boolean;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLElement>) {
  if (!payout) return <div {...rest}>{children}</div>;
  return (
    <Link href={`/terminal?market=${symbol}`} {...rest}>
      {children}
    </Link>
  );
}

export function Markets() {
  const quotes = useQuotes();
  const reduced = useReducedMotion();
  const [sort, setSort] = useState<SortId>("movers");
  const [filter, setFilter] = useState<"all" | MarketClass>("all");

  const rows = useMemo(() => {
    const list = MARKETS.filter(
      (m) => filter === "all" || m.classes.includes(filter),
    ).map((m) => {
      const q = quotes[m.symbol];
      return {
        ...m,
        price: q?.price ?? SEED_PRICES[m.symbol] ?? 0,
        changePct: q?.changePct ?? 0,
        live: q?.live ?? false,
      };
    });

    if (sort === "movers")
      list.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
    if (sort === "price") list.sort((a, b) => b.price - a.price);
    if (sort === "az") list.sort((a, b) => a.symbol.localeCompare(b.symbol));
    return list;
  }, [quotes, sort, filter]);

  return (
    <section id="markets" className="mx-auto max-w-7xl px-5 py-24 sm:px-6">
      <Reveal className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <span className="chip mb-5">// 01 · Markets</span>
          <h2 className="display text-balance text-4xl text-white sm:text-5xl">
            Every ticker on the menu.
          </h2>
          <p className="mt-4 max-w-xl text-pretty leading-relaxed text-mist-300">
            Payout assets land in your wallet every 30 minutes. Perps markets
            settle against the oracle mark. Everything else is on the feed.
          </p>
        </div>

        {/* sort tabs */}
        <div className="flex items-center gap-1 rounded-lg border border-tendie/20 bg-ink-900/60 p-1">
          {SORTS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSort(s.id)}
              className={`rounded-md px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors ${
                sort === s.id
                  ? "bg-tendie text-ink-950"
                  : "text-mist-300 hover:text-tendie"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </Reveal>

      {/* class filters */}
      <div className="mt-7 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-md border px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors ${
              filter === f.id
                ? "border-tendie bg-tendie/10 text-tendie"
                : "border-tendie/20 text-mist-300 hover:border-tendie/50 hover:text-tendie"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* listing grid */}
      {/* A card only links where there is something to open. The terminal
          charts the three payout stocks and nothing else, so sending a feed-only
          ticker there used to land the reader on Tesla — a card promising GME
          and delivering something else. */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map((m, i) => (
          <Reveal key={m.symbol} delay={Math.min(i, 7) * 45}>
          <Card
            symbol={m.symbol}
            payout={m.classes.includes("payout")}
            onPointerMove={(e) => {
              if (reduced) return;
              // tilt the card toward the cursor — depth without a library
              const el = e.currentTarget;
              const box = el.getBoundingClientRect();
              const px = (e.clientX - box.left) / box.width - 0.5;
              const py = (e.clientY - box.top) / box.height - 0.5;
              el.style.transform = `perspective(700px) rotateX(${-py * 7}deg) rotateY(${px * 7}deg) translateZ(6px)`;
            }}
            onPointerLeave={(e) => {
              e.currentTarget.style.transform = "";
            }}
            style={{ transition: "transform 380ms cubic-bezier(0.16,1,0.3,1)" }}
            className="panel panel-hover group flex h-full flex-col gap-4 p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-mono text-lg font-black tracking-tight text-white">
                  {m.symbol}
                </div>
                <div className="mt-0.5 text-xs text-mist-400">{m.name}</div>
              </div>
              {m.token && (
                <span className="rounded-md border border-tendie/30 bg-tendie/5 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-tendie">
                  {m.token}
                </span>
              )}
            </div>

            <div className="mt-auto">
              <div className="num flex items-baseline gap-2">
                <span className="text-2xl font-black text-white">
                  ${m.price.toFixed(2)}
                </span>
                <span
                  className={`font-mono text-sm font-bold ${
                    m.changePct >= 0 ? "text-long" : "text-short"
                  }`}
                >
                  {m.changePct >= 0 ? "+" : ""}
                  {m.changePct.toFixed(2)}%
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {m.classes.includes("payout") && (
                  <span className="rounded border border-tendie/25 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-tendie/80">
                    Payout
                  </span>
                )}
                {m.classes.includes("perps") && (
                  <span className="rounded border border-mist-700 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-mist-300">
                    Perps
                  </span>
                )}
                {m.live && (
                  <span className="ml-auto flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-mist-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-long" />
                    Live
                  </span>
                )}
              </div>
            </div>
          </Card>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
