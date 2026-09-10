"use client";

// Hero stat strip — product facts, no HOOD. Live prices live in the ticker
// below; these are the tokenomics constants that sell the mechanic.
export function HeroStats() {
  const stats = [
    { value: "TSLA · NVDA · SPCX", label: "Reward Stocks" },
    { value: "30 min", label: "Payout Cycle" },
    { value: "4%", label: "Trade Tax" },
    { value: "100M", label: "Supply" },
    { value: "Solana", label: "Network" },
  ];

  return (
    <>
      <div
        className="animate-fade-up mt-14 grid max-w-4xl grid-cols-2 gap-0 overflow-hidden rounded-lg border border-tendie/30 bg-ink-900/70 backdrop-blur-md sm:grid-cols-5"
        style={{ animationDelay: "320ms" }}
      >
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={`px-4 py-4 ${i !== 0 ? "border-tendie/15 sm:border-l" : ""} ${
              i % 2 === 1 ? "border-l border-tendie/15 sm:border-l" : ""
            }`}
          >
            <div className="num text-sm font-black leading-tight text-tendie sm:text-base">
              {s.value}
            </div>
            <div className="label mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div
        className="animate-fade-up mt-3 flex items-center gap-2 font-mono text-xs text-mist-400"
        style={{ animationDelay: "360ms" }}
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-long opacity-70" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-long" />
        </span>
        Live prices below · refreshes every 60s
      </div>
    </>
  );
}
