import Link from "next/link";
import { HandLoop, Star, Sparkle, ArrowDoodle } from "@/components/Doodles";
import { HeroStats } from "./HeroStats";

export function Hero() {
  return (
    <section className="relative flex min-h-[100svh] items-center overflow-hidden pt-24">
      {/* archer backdrop — the figure sits to the right of the text column;
          mix-blend-screen drops the image's black so the page grid shows through */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute right-[2%] top-[38%] hidden h-[440px] w-[440px] -translate-y-1/2 rounded-full bg-robin/10 blur-[130px] md:block" />
        <img
          src="/hero-archer.png"
          alt=""
          className="absolute top-[38%] hidden h-[min(62vh,540px)] w-auto -translate-y-1/2 mix-blend-screen md:right-[-16rem] md:block lg:right-[-8rem] xl:right-0"
        />
        <img
          src="/hero-archer.png"
          alt=""
          className="absolute right-[-38%] top-8 h-56 w-auto opacity-40 mix-blend-screen md:hidden"
        />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-7xl px-5 sm:px-6">
        <div className="max-w-3xl">
          <div className="animate-fade-up mb-6 flex items-center gap-3">
            <span className="chip">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-robin opacity-70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-robin" />
              </span>
              On-chain · Settled on Robinhood Chain
            </span>
            <Star className="h-4 w-4 animate-pulse" />
          </div>

          <h1 className="animate-fade-up display text-[clamp(2.8rem,9vw,6.2rem)] text-white">
            Draw the bow.
            <br />
            <span className="relative inline-block">
              <span className="hand normal-case text-robin [text-transform:none]">
                hit the mark.
              </span>
              <HandLoop className="absolute -inset-x-4 -inset-y-3 h-[calc(100%+1.5rem)] w-[calc(100%+2rem)]" />
            </span>
          </h1>

          <p
            className="animate-fade-up mt-7 max-w-xl text-pretty text-base leading-relaxed text-zinc-300 sm:text-lg"
            style={{ animationDelay: "120ms" }}
          >
            Synthetic stock exposure — 24/7, on-chain, no brokerage account.
            Hold the token, get paid in real tokenized stocks — Tesla, NVIDIA
            or even SpaceX, every 30 minutes — and trade perps on the next
            oracle mark.
            All on Robinhood Chain.
          </p>

          <div
            className="animate-fade-up mt-9 flex flex-wrap items-center gap-4"
            style={{ animationDelay: "200ms" }}
          >
            <Link href="/terminal" className="btn-robin !px-7 !py-4 text-base">
              Enter Terminal
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.6">
                <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <a href="#mechanics" className="btn-ghost !px-7 !py-4 text-base">
              How it works
            </a>
            <span className="relative hidden items-center gap-1 sm:flex">
              <ArrowDoodle className="h-12 w-16 -scale-x-100" />
              <span className="hand text-lg text-robin">start here</span>
            </span>
          </div>

          {/* contract / disclaimer line */}
          <div
            className="animate-fade-up mt-6 flex items-center gap-2 font-mono text-xs text-zinc-500"
            style={{ animationDelay: "260ms" }}
          >
            <Sparkle className="h-3.5 w-3.5" />
            No equity · no shareholder rights · pure synthetic price exposure
          </div>
        </div>

        {/* brutalist stat strip — live data only */}
        <HeroStats />
      </div>
    </section>
  );
}
