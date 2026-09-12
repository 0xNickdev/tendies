"use client";

import Link from "next/link";
import { useMemo } from "react";
import { MARKETS, SEED_PRICES } from "@/lib/stocks";
import { useQuotes } from "@/lib/useQuotes";
import { useReducedMotion } from "@/lib/motion";
import { Reveal } from "@/components/Reveal";

// Only the stocks the treasury actually pays out. The feed carries more, and
// the marquee shows them — but a card in a grid reads as something you can act
// on, and five tickers that go nowhere teach a reader that half the page is
// decoration. That is an expensive thing to teach on a page asking them to
// trust a treasury.
export function Markets() {
  const quotes = useQuotes();
  const reduced = useReducedMotion();

  const rows = useMemo(
    () =>
      MARKETS.filter((m) => m.classes.includes("payout")).map((m) => {
        const q = quotes[m.symbol];
        return {
          ...m,
          price: q?.price ?? SEED_PRICES[m.symbol] ?? 0,
          changePct: q?.changePct ?? 0,
          live: q?.live ?? false,
        };
      }),
    [quotes],
  );

  return (
    <section id="markets" className="mx-auto max-w-7xl px-5 py-24 sm:px-6">
      <Reveal>
        <div>
          <span className="chip mb-5">// 01 · Markets</span>
          <h2 className="display text-balance text-4xl text-white sm:text-5xl">
            Four stocks on the menu.
          </h2>
          <p className="mt-4 max-w-xl text-pretty leading-relaxed text-mist-300">
            Pick one and it lands in your wallet every 30 minutes, as a
            tokenized share - OpenAI before it even lists. Change your pick
            whenever you like.
          </p>
        </div>
      </Reveal>

      {/* Each card opens its own market in the terminal. */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map((m, i) => (
          <Reveal key={m.symbol} delay={Math.min(i, 7) * 45}>
          <Link
            href={`/terminal?market=${m.symbol}`}
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
                {/* No "Payout" badge: every card in this grid is one, so the
                    label would mark nothing. Perps stays — it says "later",
                    which is information rather than decoration. */}
                {m.classes.includes("preipo") && (
                  <span className="rounded border border-tendie/40 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-tendie">
                    Pre-IPO
                  </span>
                )}
                {m.classes.includes("perps") && (
                  <span className="rounded border border-mist-700 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-mist-300">
                    Perps soon
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
          </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
