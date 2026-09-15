"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { TREASURY } from "@/lib/mock";
import { PAYOUT_STOCKS, DISTRIBUTION_MINUTES, type StockSym } from "@/lib/stocks";
import { useQuotes, quotePrice } from "@/lib/useQuotes";
import { fmtUSD, fmtNum, fmtUSDCompact } from "@/lib/format";
import { CandleChart } from "@/components/CandleChart";
import { Stat, ViewHeader, LiveFeedChip } from "../ui";
import { useToast } from "../Toast";

// live countdown to the next 30-minute distribution epoch
function useNextPayout() {
  const [left, setLeft] = useState("--:--");
  useEffect(() => {
    const tick = () => {
      const ms = DISTRIBUTION_MINUTES * 60_000;
      const d = Math.max(0, Math.ceil(Date.now() / ms) * ms - Date.now());
      const m = Math.floor(d / 60_000);
      const sec = Math.floor((d % 60_000) / 1000);
      setLeft(`${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return left;
}

export function Treasury() {
  const { wallet, connect, claimUsdc, shareBps, payoutChoice, txPending, setPayoutChoice, claim: claimTx, refresh } = useStore();
  const { push } = useToast();
  const [local, setLocal] = useState<StockSym>("TSLA");
  // What the contract says you get, or what you are about to pick.
  const payout = payoutChoice ?? local;
  const pending = txPending;
  // Picking a stock is one transaction on the RewardDistributor
  // (setRewardChoice); the choice then sticks across every claim.
  const choose = async (symbol: StockSym) => {
    if (symbol === payoutChoice) return;
    if (!wallet.connected) {
      setLocal(symbol);
      return;
    }
    push("Confirm the pick in your wallet…", "pending");
    const r = await setPayoutChoice(symbol);
    if (r.ok) push(`Payouts set to ${PAYOUT_STOCKS.find((s) => s.symbol === symbol)?.token}`, "success");
    else {
      setLocal(symbol);
      push(r.error ?? "Could not set payout stock", "error");
    }
  };
  const quotes = useQuotes();
  const nextPayout = useNextPayout();

  const payoutStock = PAYOUT_STOCKS.find((st) => st.symbol === payout)!;
  const payoutPrice = quotePrice(quotes, payout);
  const payoutAmount = claimUsdc / payoutPrice;

  const claim = async () => {
    if (!wallet.connected) return connect();
    push("Confirm claim in wallet…", "pending");
    const r = await claimTx();
    if (r.ok) {
      push(`Claim sent - ≈${fmtNum(payoutAmount, 4)} ${payoutStock.token} on the way`, "success");
      setTimeout(() => void refresh(), 8000);
    } else push(r.error ?? "Claim failed", "error");
  };

  return (
    <div>
      <ViewHeader
        title="Treasury"
        subtitle={`Your share of the treasury — paid out in tokenized stocks every ${DISTRIBUTION_MINUTES} minutes.`}
        right={<LiveFeedChip label="Payouts every 30 min" />}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Total Treasury" value={TREASURY.totalUsdc > 0 ? fmtUSDCompact(TREASURY.totalUsdc) : "TBA"} sub="Pays out in tokenized stocks" />
        <Stat
          label="Your Share"
          value={shareBps > 0 ? `${(shareBps / 100).toFixed(2)}%` : "—"}
          sub={fmtUSD(claimUsdc)}
          accent="robin"
        />
        <Stat label="Realized APR" value={TREASURY.apr > 0 ? `${TREASURY.apr}%` : "TBA"} sub="From trade taxes" accent="long" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="panel p-6 lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {PAYOUT_STOCKS.map((st) => {
              const active = payout === st.symbol;
              return (
                <button
                  key={st.symbol}
                  onClick={() => void choose(st.symbol)}
                  className={`flex items-center gap-2 rounded-md border-2 px-3 py-2 font-mono transition-all ${
                    active
                      ? "border-robin/60 bg-robin/10"
                      : "border-robin/15 bg-ink-900/60 hover:border-robin/35"
                  }`}
                >
                  <span className={`text-sm font-black uppercase ${active ? "text-robin" : "text-zinc-300"}`}>
                    {st.token}
                  </span>
                  <span className="num text-xs font-bold text-white">
                    {fmtUSD(quotePrice(quotes, st.symbol))}
                  </span>
                </button>
              );
            })}
            <span className="ml-auto hidden sm:block">
              <LiveFeedChip label={quotes[payout]?.live ? "Live · Nasdaq feed" : "On-chain priced"} />
            </span>
          </div>
          <CandleChart symbol={payout} basePrice={payoutPrice} height={300} />
          <p className="mt-3 text-xs text-zinc-500">
            {payoutStock.name} — the stock you&apos;ve chosen to receive. Preview
            candles; live feed arrives with Phase 02.
          </p>
        </div>

        <div className="panel flex flex-col p-6">
          <span className="label">Claimable now</span>
          <div className="num mt-2 text-4xl font-semibold text-robin">
            {fmtUSD(claimUsdc)}
          </div>
          <p className="mt-2 text-sm text-zinc-500">
            Withdraw as a tokenized stock of your choice, or keep it as perps
            margin.
          </p>

          <div className="mt-5">
            <span className="label">Receive rewards as</span>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {PAYOUT_STOCKS.map((st) => {
                const price = quotePrice(quotes, st.symbol);
                const active = payout === st.symbol;
                return (
                  <button
                    key={st.symbol}
                    onClick={() => void choose(st.symbol)}
                    disabled={pending}
                    className={`rounded-lg border-2 px-2 py-2.5 text-center transition-all ${
                      active
                        ? "border-robin/60 bg-robin/10"
                        : "border-robin/10 bg-ink-900/60 hover:border-robin/30"
                    }`}
                  >
                    <div className={`font-mono text-xs font-black ${active ? "text-robin" : "text-zinc-300"}`}>
                      {st.token}
                    </div>
                    <div className="num mt-1 text-[11px] text-zinc-500">
                      ≈ {fmtNum(claimUsdc / price, 3)}
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-zinc-600">
              1:1-backed stock tokens on Robinhood Chain — held in your own
              wallet.
            </p>
          </div>

          <div className="mt-5 space-y-2.5 rounded-xl border border-robin/10 bg-ink-900/40 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-400">Share of treasury</span>
              <span className="num text-zinc-200">{(shareBps / 100).toFixed(2)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Distribution</span>
              <span className="text-zinc-200">Every {DISTRIBUTION_MINUTES} minutes</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Next payout in</span>
              <span className="num font-semibold text-robin">{nextPayout}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Payout asset</span>
              <span className="text-zinc-200">{payoutStock.token} · {payoutStock.name}</span>
            </div>
          </div>

          <button
            onClick={claim}
            disabled={pending || (wallet.connected && claimUsdc <= 0)}
            className="btn-robin mt-5 w-full py-4"
          >
            {!wallet.connected
              ? "Connect Wallet"
              : claimUsdc <= 0
                ? "Nothing to claim yet"
                : pending
                  ? "Claiming…"
                  : `Claim ${payoutStock.token}`}
          </button>
          <p className="mt-3 text-center text-xs text-zinc-500">
            Your USDG rewards are swapped into {payoutStock.token} at claim time, on-chain, and sent straight to your wallet.
          </p>
        </div>
      </div>
    </div>
  );
}
