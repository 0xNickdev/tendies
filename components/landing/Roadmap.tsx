"use client";

import Link from "next/link";
import { Underline } from "@/components/Doodles";
import { Reveal } from "@/components/Reveal";

/* ---------- kitchen pictograms ---------- */

// a full basket, straight out of the fryer — "shipped"
function BasketFull({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" aria-hidden>
      {/* tenders poking out */}
      <path d="M13 20c0-4 3-7 7-8" stroke="#69AAC1" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M21 19c1-4 4-6 8-6" stroke="#69AAC1" strokeWidth="4.5" strokeLinecap="round" opacity="0.7" />
      {/* basket */}
      <path d="M7 23h26l-3 11H10L7 23z" stroke="#69AAC1" strokeWidth="2" strokeLinejoin="round" fill="rgba(105, 170, 193,0.12)" />
      <path d="M12 26v6M20 26v6M28 26v6" stroke="#69AAC1" strokeWidth="1.6" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

// oil bubbling in the fryer — "cooking now"
function Fryer({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" aria-hidden>
      <path d="M7 18h26v12a4 4 0 01-4 4H11a4 4 0 01-4-4V18z" stroke="#69AAC1" strokeWidth="2" strokeLinejoin="round" fill="rgba(105, 170, 193,0.08)" />
      <path d="M7 22c4 2 7-2 10 0s5 2 9 0 4 0 7 1" stroke="#69AAC1" strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />
      {/* rising bubbles */}
      <circle cx="14" cy="13" r="2.2" stroke="#69AAC1" strokeWidth="1.8" />
      <circle cx="22" cy="8" r="1.6" stroke="#69AAC1" strokeWidth="1.6" opacity="0.7" />
      <circle cx="28" cy="13" r="1.2" stroke="#69AAC1" strokeWidth="1.4" opacity="0.5" />
    </svg>
  );
}

// still in the freezer box — "later"
function Freezer({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" stroke="#69AAC1" aria-hidden>
      <path d="M8 14h24v20H8V14z" strokeWidth="2" strokeLinejoin="round" fill="rgba(105, 170, 193,0.06)" />
      <path d="M8 20h24" strokeWidth="2" />
      <path d="M17 14v-4h6v4" strokeWidth="2" strokeLinejoin="round" />
      {/* frost crystal */}
      <path d="M20 24v7M17 26l6 3M23 26l-6 3" strokeWidth="1.8" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}

// the tender that flies across the conveyor strip
function FlyingTender({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 56 14" className={className} fill="none" aria-hidden>
      <path d="M8 9c0-3 3-5 8-6 6-1.2 12-1 18 0" stroke="#69AAC1" strokeWidth="7" strokeLinecap="round" />
      <circle cx="16" cy="6.4" r="1.1" fill="#071013" opacity="0.6" />
      <circle cx="26" cy="4.4" r="0.9" fill="#071013" opacity="0.6" />
      {/* motion streaks */}
      <path d="M0 4h5M0 10h4" stroke="#69AAC1" strokeWidth="1.6" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

// the fryer at the head of the conveyor line
function KitchenMark() {
  return (
    <div className="grid h-24 w-24 shrink-0 place-items-center">
      <Fryer className="h-16 w-16 opacity-90" />
    </div>
  );
}

/* ---------- roadmap data ---------- */

type Phase = {
  n: string;
  status: "live" | "next" | "later";
  statusLabel: string;
  title: string;
  points: string[];
  icon: React.ReactNode;
  cta?: { label: string; href: string };
};

const PHASES: Phase[] = [
  {
    n: "01",
    status: "live",
    statusLabel: "Shipped · Live",
    title: "Token & Treasury",
    points: [
      "TENDIE token with a 4% tithe to the treasury",
      "Rewards in real tokenized stocks - TSLAx, NVDAx or SPCXx, your pick",
      "Distribution every 30 minutes + live Nasdaq price feed",
    ],
    icon: <BasketFull />,
    cta: { label: "Enter Terminal", href: "/terminal" },
  },
  {
    n: "02",
    status: "next",
    statusLabel: "In the fryer · Soon",
    title: "Stock Perps",
    points: [
      "Long / short TSLA, NVDA & SPCX oracle marks",
      "1-10× leverage, treasury claim as margin",
      "Mandatory risk gating before every trade",
    ],
    icon: <Fryer />,
    cta: { label: "Preview in Terminal", href: "/terminal" },
  },
  {
    n: "03",
    status: "later",
    statusLabel: "Still frozen",
    title: "Auto-Trading",
    points: [
      "Strategy vaults that DCA the marks for you",
      "Copy the top cooks on the leaderboard",
      "Signal bots wired to oracle prints",
    ],
    icon: <Freezer />,
  },
];

/* ---------- section ---------- */

export function Roadmap() {
  return (
    <section id="roadmap" className="relative overflow-hidden py-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <div className="flex justify-center">
            <span className="chip mb-5">// 05 · Roadmap</span>
          </div>
          <h2 className="display text-balance text-4xl text-white sm:text-5xl">
            Three baskets,{" "}
            <span className="relative inline-block">
              <span className="hand normal-case text-tendie [text-transform:none]">
                one kitchen.
              </span>
              <Underline className="absolute -bottom-2 left-0 h-3 w-full" />
            </span>
          </h2>
          <p className="mt-5 text-pretty leading-relaxed text-mist-300">
            First basket is out of the fryer, the second is cooking, the third
            is still frozen. Here&apos;s exactly where Tendies stands.
          </p>
        </div>

        {/* conveyor strip - a tender travels the line, fryer to basket */}
        <div className="relative mt-16 hidden items-center gap-2 lg:flex">
          <KitchenMark />
          <div className="relative h-16 flex-1">
            {/* dashed flight line */}
            <div className="absolute left-0 right-10 top-1/2 border-t-2 border-dashed border-tendie/25" />
            {/* phase ticks aligned to the three columns */}
            {["16.66%", "50%", "83.33%"].map((left, i) => (
              <div
                key={left}
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                style={{ left }}
              >
                <span
                  className={`block h-3 w-3 rotate-45 border ${
                    i === 0
                      ? "border-tendie bg-tendie"
                      : i === 1
                        ? "animate-pulse border-tendie bg-ink-950"
                        : "border-tendie/40 bg-ink-950"
                  }`}
                />
              </div>
            ))}
            {/* the animated tender */}
            <span className="animate-fly absolute top-1/2 -translate-y-1/2">
              <FlyingTender className="h-3.5 w-14" />
            </span>
            {/* end target */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2">
              <BasketFull className="h-9 w-9 opacity-80" />
            </div>
          </div>
        </div>

        {/* phase cards */}
        <div className="mt-10 grid gap-6 lg:mt-6 lg:grid-cols-3">
          {PHASES.map((p, i) => (
            <Reveal
              key={p.n}
              delay={i * 110}
              className={`panel panel-hover relative overflow-hidden p-6 ${
                p.status === "next" ? "border-tendie/60" : ""
              } ${p.status === "later" ? "opacity-90" : ""}`}
            >
              {/* ghost numeral */}
              <span className="pointer-events-none absolute -right-3 -top-7 select-none font-black text-[7rem] leading-none text-tendie/[0.07]">
                {p.n}
              </span>

              <div className="flex items-start justify-between gap-4">
                <span
                  className={`chip ${
                    p.status === "live"
                      ? "!border-tendie !bg-tendie !text-ink-950"
                      : p.status === "later"
                        ? "!border-tendie/25 !text-tendie/60"
                        : ""
                  }`}
                >
                  {p.status === "next" && (
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-tendie opacity-70" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-tendie" />
                    </span>
                  )}
                  {p.statusLabel}
                </span>
                {p.icon}
              </div>

              <h3 className="mt-5 text-xl font-black uppercase tracking-tight text-white">
                {p.title}
              </h3>

              <ul className="mt-4 space-y-2.5">
                {p.points.map((pt) => (
                  <li key={pt} className="flex gap-2.5 text-sm leading-relaxed text-mist-300">
                    <svg viewBox="0 0 20 12" className="mt-1 h-3 w-5 shrink-0" fill="none" aria-hidden>
                      <path d="M1 6h13m0 0l-4-4m4 4l-4 4" stroke="#69AAC1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {pt}
                  </li>
                ))}
              </ul>

              {p.cta && (
                <Link
                  href={p.cta.href}
                  className="mt-6 inline-flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-tendie hover:underline"
                >
                  {p.cta.label}
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.6">
                    <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              )}
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
