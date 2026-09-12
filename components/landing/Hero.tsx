"use client";

import Link from "next/link";
import { HeroArt, HeroVisual } from "./HeroArt";
import { HeroStats } from "./HeroStats";
import { usePointerParallax, useScrollY, useReducedMotion } from "@/lib/motion";

export function Hero() {
  const reduced = useReducedMotion();
  const pointer = usePointerParallax();
  const scrollY = useScrollY();

  // Three depths: the glow drifts least, the pile most, the copy barely at
  // all — so the hero gains parallax without anything visibly sliding.
  const depth = (factor: number, scrollFactor = 0) => {
    if (reduced) return undefined;
    const x = pointer.x * factor * -1;
    const y = pointer.y * factor * -1 + scrollY * scrollFactor;
    return { transform: `translate3d(${x}px, ${y}px, 0)` };
  };

  const fade = reduced ? 1 : Math.max(0, 1 - scrollY / 620);

  return (
    <section className="relative flex min-h-[100svh] items-center overflow-hidden pt-24">
      {/* parallax backdrop */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {/* cursor-tracked spotlight - the page feels lit from where you look */}
        {!reduced && (
          <div
            className="absolute inset-0 transition-opacity duration-500"
            style={{
              background: `radial-gradient(560px circle at ${50 + pointer.x * 26}% ${44 + pointer.y * 26}%, rgba(105, 170, 193,0.10), transparent 62%)`,
            }}
          />
        )}
        {/* positioning stays on the outer element; parallax rides the inner
            one, so the transforms never fight each other */}
        <div className="absolute right-[2%] top-[38%] hidden h-[440px] w-[440px] -translate-y-1/2 md:block">
          <div
            className="h-full w-full rounded-full bg-tendie/10 blur-[130px]"
            style={depth(14, 0.06)}
          />
        </div>
        <div className="absolute top-[38%] hidden -translate-y-1/2 md:right-[-4rem] md:block lg:right-[2rem] xl:right-[6rem]">
          <HeroVisual
            className="h-[min(66vh,560px)] w-[min(66vh,560px)]"
            depth={depth}
            reduced={reduced}
          />
        </div>
        <HeroArt className="absolute right-[-22%] top-10 h-64 w-auto opacity-30 md:hidden" />
      </div>

      <div
        className="relative z-10 mx-auto w-full max-w-7xl px-5 sm:px-6"
        style={reduced ? undefined : { opacity: fade }}
      >
        <div className="max-w-3xl" style={depth(7, 0.04)}>
          <div className="animate-fade-up mb-6 flex items-center gap-3">
            <span className="chip">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-tendie opacity-70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-tendie" />
              </span>
              On Solana · Launched on stonkfun
            </span>
          </div>

          <h1 className="animate-fade-up display text-[clamp(2.8rem,9vw,6.2rem)] text-white">
            Hold the bag.
            <br />
            <span className="grad-text">Get the tendies.</span>
          </h1>

          <p
            className="animate-fade-up mt-7 max-w-xl text-pretty text-base leading-relaxed text-mist-200 sm:text-lg"
            style={{ animationDelay: "120ms" }}
          >
            Tokenized stock exposure - 24/7, on-chain, no brokerage account.
            Hold $TENDIE and the treasury pays you tokenized OpenAI - before
            the IPO - or Tesla, NVIDIA, SpaceX, every 30 minutes. Then put the
            stack to work on perps.
          </p>

          <div
            className="animate-fade-up mt-9 flex flex-wrap items-center gap-3"
            style={{ animationDelay: "200ms" }}
          >
            <Link href="/terminal" className="btn-tendie !px-7 !py-4 text-base">
              Enter Terminal
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.6">
                <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <a href="#markets" className="btn-ghost !px-7 !py-4 text-base">
              Browse markets
            </a>
          </div>

          <div
            className="animate-fade-up mt-6 font-mono text-xs text-mist-400"
            style={{ animationDelay: "260ms" }}
          >
            No equity · no shareholder rights · pure synthetic price exposure
          </div>
        </div>

        <HeroStats />
      </div>
    </section>
  );
}
