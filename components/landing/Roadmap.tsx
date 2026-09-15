import Link from "next/link";
import { Underline } from "@/components/Doodles";

/* ---------- little archery pictograms ---------- */

// target with an arrow buried in the bullseye — "shipped"
function TargetHit({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" aria-hidden>
      <circle cx="20" cy="20" r="15" stroke="#D9FF4D" strokeWidth="2" />
      <circle cx="20" cy="20" r="9.5" stroke="#D9FF4D" strokeWidth="2" opacity="0.55" />
      <circle cx="20" cy="20" r="4" fill="#D9FF4D" />
      {/* arrow shaft into the bullseye */}
      <path d="M20 20L33 7" stroke="#D9FF4D" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M30 4l3 3 3-3M33 7l3-3" stroke="#D9FF4D" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// open target — "arrow in flight"
function TargetOpen({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" aria-hidden>
      <circle cx="20" cy="20" r="15" stroke="#D9FF4D" strokeWidth="2" strokeDasharray="4 4" />
      <circle cx="20" cy="20" r="9.5" stroke="#D9FF4D" strokeWidth="2" opacity="0.55" />
      <circle cx="20" cy="20" r="4" stroke="#D9FF4D" strokeWidth="2" />
    </svg>
  );
}

// three arrows waiting in the quiver — "later"
function Quiver({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" stroke="#D9FF4D" aria-hidden>
      <path d="M13 36l6-24M20 36l3-26M27 36l-1-25" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
      <path d="M17 8l2 4 3-3M21 6l2 4 3-3M25 7l1 4 3-2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 30h20l-2 8H13l-3-8z" strokeWidth="2" strokeLinejoin="round" fill="rgba(217,255,77,0.08)" />
    </svg>
  );
}

// the arrow that flies across the trajectory strip
function FlyingArrow({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 56 14" className={className} fill="none" aria-hidden>
      <path d="M3 7h42" stroke="#D9FF4D" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M45 2.5L53 7l-8 4.5v-9z" fill="#D9FF4D" />
      <path d="M4 2l5 5-5 5M10 2l5 5-5 5" stroke="#D9FF4D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// small archer cropped out of the hero art
function Archer() {
  return (
    <div className="relative h-24 w-24 shrink-0 overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/hero-archer.png"
        alt=""
        aria-hidden
        className="absolute right-[-14px] top-1/2 h-40 w-auto max-w-none -translate-y-1/2 mix-blend-screen"
      />
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
      "ROBX token with a 4% tithe to the treasury",
      "Rewards in real tokenized stocks — tTSLA, tNVDA or tSPCX, your pick",
      "Distribution every 30 minutes + live Nasdaq price feed",
    ],
    icon: <TargetHit />,
    cta: { label: "Enter Terminal", href: "/terminal" },
  },
  {
    n: "02",
    status: "next",
    statusLabel: "In flight · Soon",
    title: "Stock Perps",
    points: [
      "Long / short TSLA, NVDA & SPCX oracle marks",
      "1–10× leverage, treasury claim as margin",
      "Mandatory risk gating before every shot",
    ],
    icon: <TargetOpen />,
    cta: { label: "Preview in Terminal", href: "/terminal" },
  },
  {
    n: "03",
    status: "later",
    statusLabel: "In the quiver",
    title: "Auto-Trading",
    points: [
      "Strategy vaults that DCA the marks for you",
      "Copy the top archers on the leaderboard",
      "Signal bots wired to oracle prints",
    ],
    icon: <Quiver />,
  },
];

/* ---------- section ---------- */

export function Roadmap() {
  return (
    <section id="roadmap" className="relative overflow-hidden py-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <div className="flex justify-center">
            <span className="chip mb-5">// 04 · Roadmap</span>
          </div>
          <h2 className="display text-balance text-4xl text-white sm:text-5xl">
            Three arrows,{" "}
            <span className="relative inline-block">
              <span className="hand normal-case text-robin [text-transform:none]">
                one hunt.
              </span>
              <Underline className="absolute -bottom-2 left-0 h-3 w-full" />
            </span>
          </h2>
          <p className="mt-5 text-pretty leading-relaxed text-zinc-400">
            The first arrow already hit. The second is mid-air. The third is
            nocked and waiting. Here&apos;s exactly where RobinX stands.
          </p>
        </div>

        {/* trajectory strip — archer looses an arrow across the phases */}
        <div className="relative mt-16 hidden items-center gap-2 lg:flex">
          <Archer />
          <div className="relative h-16 flex-1">
            {/* dashed flight line */}
            <div className="absolute left-0 right-10 top-1/2 border-t-2 border-dashed border-robin/25" />
            {/* phase ticks aligned to the three columns */}
            {["16.66%", "50%", "83.33%"].map((left, i) => (
              <div
                key={left}
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                style={{ left }}
              >
                <span
                  className={`block h-3 w-3 rotate-45 border-2 ${
                    i === 0
                      ? "border-robin bg-robin"
                      : i === 1
                        ? "animate-pulse border-robin bg-ink-950"
                        : "border-robin/40 bg-ink-950"
                  }`}
                />
              </div>
            ))}
            {/* the animated arrow */}
            <span className="animate-arrow-fly absolute top-1/2 -translate-y-1/2">
              <FlyingArrow className="h-3.5 w-14" />
            </span>
            {/* end target */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2">
              <TargetOpen className="h-9 w-9 opacity-80" />
            </div>
          </div>
        </div>

        {/* phase cards */}
        <div className="mt-10 grid gap-6 lg:mt-6 lg:grid-cols-3">
          {PHASES.map((p) => (
            <div
              key={p.n}
              className={`panel panel-hover relative overflow-hidden p-6 ${
                p.status === "next" ? "border-robin/60" : ""
              } ${p.status === "later" ? "opacity-90" : ""}`}
              style={
                p.status === "next"
                  ? { boxShadow: "6px 6px 0 0 rgba(217,255,77,0.45)" }
                  : undefined
              }
            >
              {/* ghost numeral */}
              <span className="pointer-events-none absolute -right-3 -top-7 select-none font-black text-[7rem] leading-none text-robin/[0.07]">
                {p.n}
              </span>

              <div className="flex items-start justify-between gap-4">
                <span
                  className={`chip ${
                    p.status === "live"
                      ? "!border-robin !bg-robin !text-ink-950"
                      : p.status === "later"
                        ? "!border-robin/25 !text-robin/60"
                        : ""
                  }`}
                >
                  {p.status === "next" && (
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-robin opacity-70" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-robin" />
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
                  <li key={pt} className="flex gap-2.5 text-sm leading-relaxed text-zinc-400">
                    <svg viewBox="0 0 20 12" className="mt-1 h-3 w-5 shrink-0" fill="none" aria-hidden>
                      <path d="M1 6h13m0 0l-4-4m4 4l-4 4" stroke="#D9FF4D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {pt}
                  </li>
                ))}
              </ul>

              {p.cta && (
                <Link
                  href={p.cta.href}
                  className="mt-6 inline-flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-robin hover:underline"
                >
                  {p.cta.label}
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.6">
                    <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
