"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { TREASURY, FEATURES } from "@/lib/mock";
import { useKeeperStatus } from "@/lib/useKeeperStatus";
import { PAYOUT_STOCKS, type StockSym } from "@/lib/stocks";
import { BUY_ROBX_URL } from "@/lib/config";
import { useQuotes, quotePrice } from "@/lib/useQuotes";
import { fmtUSD, fmtNum, fmtPct } from "@/lib/format";
import { CandleChart } from "@/components/CandleChart";
import { Stat, ViewHeader, LiveFeedChip } from "../ui";
import type { View } from "../TerminalShell";

export function Dashboard({ go }: { go: (v: View) => void }) {
  const { wallet, robxBalance, accruedUsd, shareBps, positions } = useStore();
  const quotes = useQuotes();
  const keeper = useKeeperStatus();

  const [market, setMarket] = useState<StockSym>("TSLA");
  const marketStock = PAYOUT_STOCKS.find((s) => s.symbol === market)!;
  const marketPrice = quotePrice(quotes, market);
  const marketChg = quotes[market]?.changePct ?? 0;

  return (
    <div>
      <ViewHeader
        title="Dashboard"
        subtitle="Your RobinX account at a glance — live reward markets."
        right={<LiveFeedChip />}
      />

      {!wallet.connected && (
        <div className="panel mb-6 flex flex-col items-start justify-between gap-3 border-robin/20 bg-robin/5 p-5 sm:flex-row sm:items-center">
          <div>
            <div className="font-medium text-robin">Wallet not connected</div>
            <div className="text-sm text-zinc-400">
              Connect to load your ROBX balance straight from the chain.
            </div>
          </div>
          <span className="chip">MetaMask · Rabby</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Token Balance"
          value={`${fmtNum(robxBalance)} ${TREASURY.tokenSymbol}`}
          sub={wallet.connected ? "Read from your wallet" : "Connect wallet to load"}
          accent="robin"
        />
        <Stat
          label="Accrued for you"
          value={fmtUSD(accruedUsd)}
          sub="Paid in stocks · every 30 min"
          accent="long"
        />
        <Stat
          label={`${market} Price`}
          value={fmtUSD(marketPrice)}
          sub={
            quotes[market]?.live ? (
              <span className={marketChg >= 0 ? "text-long" : "text-short"}>
                {fmtPct(marketChg, 2)} today · live
              </span>
            ) : (
              "On-chain priced"
            )
          }
        />
        <Stat
          label="Open Positions"
          value={positions.length}
          sub={positions.length ? "Tap Perps to manage" : FEATURES.perpsLive ? "Margin from your accrued rewards" : "Perps in preview — soon"}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="panel p-6 lg:col-span-2">
          {/* reward market picker */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {PAYOUT_STOCKS.map((s) => {
              const price = quotePrice(quotes, s.symbol);
              const active = market === s.symbol;
              return (
                <button
                  key={s.symbol}
                  onClick={() => setMarket(s.symbol)}
                  className={`flex items-center gap-2 rounded-md border-2 px-3 py-2 font-mono transition-all ${
                    active
                      ? "border-robin/60 bg-robin/10"
                      : "border-robin/15 bg-ink-900/60 hover:border-robin/35"
                  }`}
                >
                  <span className={`text-sm font-black uppercase ${active ? "text-robin" : "text-zinc-300"}`}>
                    {s.token}
                  </span>
                  <span className="num text-xs font-bold text-white">{fmtUSD(price)}</span>
                </button>
              );
            })}
            <span className="ml-auto hidden sm:block">
              <LiveFeedChip label={quotes[market]?.live ? "Live · Nasdaq feed" : "On-chain priced"} />
            </span>
          </div>

          <CandleChart symbol={market} basePrice={marketPrice} height={300} />

          <p className="mt-3 text-xs text-zinc-500">
            {marketStock.name} — one of the tokenized stocks the treasury pays
            out, and a perps market. Candles are Nasdaq OHLC, delayed ~15 min;
            perps settle against the keeper&apos;s oracle mark.
          </p>
        </div>

        <div className="panel flex flex-col p-6">
          <div className="label">Quick actions</div>
          <div className="mt-4 flex flex-col gap-3">
            <a
              href={BUY_ROBX_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-robin w-full justify-between"
            >
              <span className="flex items-center gap-2">
                Buy {TREASURY.tokenSymbol}
                <span className="rounded border border-ink-950/30 bg-ink-950/10 px-1.5 py-0.5 font-mono text-[9px] font-black tracking-wider">
                  PONS
                </span>
              </span>
              <Arrow />
            </a>
            <button onClick={() => go("perps")} className="btn-ghost w-full justify-between">
              <span className="flex items-center gap-2">
                {FEATURES.perpsLive ? "Trade Perps" : "Preview Perps"}
                {!FEATURES.perpsLive && (
                  <span className="rounded border border-robin/50 bg-robin/10 px-1.5 py-0.5 font-mono text-[9px] font-black tracking-wider text-robin">
                    SOON
                  </span>
                )}
              </span>
              <Arrow />
            </button>
            <button onClick={() => go("treasury")} className="btn-ghost w-full justify-between">
              <span>Pick your payout stock</span>
              <Arrow />
            </button>
          </div>

          <div className="mt-6 rounded-xl border border-robin/10 bg-ink-900/60 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400">In the treasury</span>
              <span className="num font-semibold text-white">
                {keeper?.treasury.pendingFeeUsd != null ? fmtUSD(keeper.treasury.pendingFeeUsd) : "TBA"}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-zinc-400">Paid out so far</span>
              <span className="num font-semibold text-long">
                {keeper?.ledger.paidOutUsd != null ? fmtUSD(keeper.ledger.paidOutUsd) : "TBA"}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-zinc-400">Distribution</span>
              <span className="font-semibold text-zinc-200">Stocks · every 30 min</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-700">
              <div
                className="h-full rounded-full bg-gradient-to-r from-robin-400 to-robin"
                style={{ width: `${Math.min(100, shareBps / 5)}%` }}
              />
            </div>
            <div className="mt-2 text-xs text-zinc-500">
              {keeper
                ? `${keeper.treasury.holders} holders accruing · ${keeper.ledger.epochsRun} distributions so far`
                : "Treasury metrics go live with the token launch."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const Arrow = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4">
    <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
