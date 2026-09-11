"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { TREASURY } from "@/lib/mock";
import { PAYOUT_STOCKS, DISTRIBUTION_MINUTES, type StockSym } from "@/lib/stocks";
import { useQuotes, quotePrice } from "@/lib/useQuotes";
import { useKeeperStatus } from "@/lib/useKeeperStatus";
import { solscanTx } from "@/lib/keeper";
import { fmtUSD, fmtNum, fmtUSDCompact } from "@/lib/format";
import { CandleChart } from "@/components/CandleChart";
import { Stat, ViewHeader, LiveFeedChip } from "../ui";
import { useToast } from "../Toast";

// live countdown to the next 30-minute distribution epoch
// Counts down to the keeper's actual next epoch. Without the keeper there is
// no honest number to show, so it stays blank rather than ticking a wall clock
// that has nothing to do with when payouts happen.
function useNextPayout(secondsUntilNext?: number) {
  const [left, setLeft] = useState("--:--");
  useEffect(() => {
    if (secondsUntilNext == null) {
      setLeft("--:--");
      return;
    }
    const target = Date.now() + secondsUntilNext * 1000;
    const tick = () => {
      const d = Math.max(0, target - Date.now());
      const m = Math.floor(d / 60_000);
      const sec = Math.floor((d % 60_000) / 1000);
      setLeft(`${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [secondsUntilNext]);
  return left;
}

export function Treasury() {
  const {
    wallet,
    connect,
    shareBps,
    payoutChoice,
    accruedUsd,
    minPayoutUsd,
    setPayoutChoice,
    totalPaid,
    streak,
    payouts,
  } = useStore();
  const { push } = useToast();
  const [saving, setSaving] = useState(false);
  // the keeper is the source of truth; local state is only the optimistic view
  const [local, setLocal] = useState<StockSym>("TSLA");
  const payout = payoutChoice ?? local;

  // Persisting the pick costs a wallet signature, not a transaction.
  const choose = async (symbol: StockSym) => {
    setLocal(symbol);
    if (!wallet.connected) {
      push("Connect a wallet to save your payout stock", "pending");
      return;
    }
    setSaving(true);
    const result = await setPayoutChoice(symbol);
    setSaving(false);
    push(
      result.ok
        ? `Payouts set to ${PAYOUT_STOCKS.find((s) => s.symbol === symbol)?.token}`
        : result.error ?? "Could not save your choice",
      result.ok ? "success" : "error",
    );
  };
  const quotes = useQuotes();
  const keeper = useKeeperStatus();
  const nextPayout = useNextPayout(keeper?.epoch.secondsUntilNext);

  const payoutStock = PAYOUT_STOCKS.find((st) => st.symbol === payout)!;
  const payoutPrice = quotePrice(quotes, payout);

  return (
    <div>
      <ViewHeader
        title="Treasury"
        subtitle={`Your share of the treasury - paid out in tokenized stocks every ${DISTRIBUTION_MINUTES} minutes.`}
        right={<LiveFeedChip label="Payouts every 30 min" />}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="In the treasury"
          value={keeper?.treasury.pendingFeeUsd != null ? fmtUSD(keeper.treasury.pendingFeeUsd) : "TBA"}
          sub={keeper ? `${keeper.treasury.holders} holders accruing` : "Pays out in tokenized stocks"}
        />
        <Stat
          label="Your Share"
          value={shareBps > 0 ? `${(shareBps / 100).toFixed(2)}%` : "-"}
          sub={`${fmtUSD(accruedUsd)} accrued`}
          accent="tendie"
        />
        <Stat
          label="Paid out so far"
          value={keeper?.ledger.paidOutUsd != null ? fmtUSD(keeper.ledger.paidOutUsd) : "TBA"}
          sub={keeper ? `${keeper.ledger.epochsRun} distributions` : "From trade fees"}
          accent="long"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="panel p-6 lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {PAYOUT_STOCKS.map((st) => {
              const active = payout === st.symbol;
              return (
                <button
                  key={st.symbol}
                  onClick={() => choose(st.symbol)}
                  className={`flex items-center gap-2 rounded-md border px-3 py-2 font-mono transition-all ${
                    active
                      ? "border-tendie/60 bg-tendie/10"
                      : "border-tendie/15 bg-ink-900/60 hover:border-tendie/35"
                  }`}
                >
                  <span className={`text-sm font-black uppercase ${active ? "text-tendie" : "text-mist-200"}`}>
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
          <p className="mt-3 text-xs text-mist-400">
            {payoutStock.name} - the stock you&apos;ve chosen to receive.
          </p>
        </div>

        <div className="panel flex flex-col p-6">
          <span className="label">Accrued for you</span>
          <div className="num mt-2 text-4xl font-semibold text-tendie">
            {fmtUSD(accruedUsd)}
          </div>
          <p className="mt-2 text-sm text-mist-400">
            Accruing in {payoutStock.token}. Sent to your wallet automatically -
            there is nothing to withdraw.
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
                    onClick={() => choose(st.symbol)}
                    className={`rounded-lg border px-2 py-2.5 text-center transition-all ${
                      active
                        ? "border-tendie/60 bg-tendie/10"
                        : "border-tendie/10 bg-ink-900/60 hover:border-tendie/30"
                    }`}
                  >
                    <div className={`font-mono text-xs font-black ${active ? "text-tendie" : "text-mist-200"}`}>
                      {st.token}
                    </div>
                    <div className="num mt-1 text-[11px] text-mist-400">
                      ≈ {fmtNum(accruedUsd / price, 3)}
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-mist-500">
              {saving
                ? "Saving your choice - approve the signature in your wallet…"
                : minPayoutUsd > 0
                  ? `1:1-backed xStocks on Solana, held in your own wallet. Rewards accrue every ${DISTRIBUTION_MINUTES} min and are sent once your balance passes $${minPayoutUsd} - small amounts keep accruing instead of being eaten by network fees.`
                  : "1:1-backed xStocks on Solana - held in your own wallet."}
            </p>
          </div>

          {wallet.connected && (
            <div className="mt-5">
              <div className="flex items-center justify-between">
                <span className="label">Your payouts</span>
                {streak > 0 && (
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-tendie">
                    {streak} epoch streak
                  </span>
                )}
              </div>
              {payouts.length ? (
                <ul className="mt-2 divide-y divide-tendie/10 rounded-xl border border-tendie/10 bg-ink-900/40">
                  {payouts.slice(0, 6).map((p) => (
                    <li key={p.signature + p.epoch} className="flex items-center justify-between gap-3 px-3 py-2.5 text-xs">
                      <span className="font-mono text-mist-400">
                        {new Date(p.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className="font-mono font-bold text-mist-50">{p.symbol}</span>
                      <span className="num text-mist-200">{p.valueUsd != null ? fmtUSD(p.valueUsd) : fmtNum(p.value)}</span>
                      <a
                        href={solscanTx(p.signature)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-[10px] uppercase tracking-wider text-tendie hover:underline"
                      >
                        tx
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 rounded-xl border border-tendie/10 bg-ink-900/40 px-3 py-3 text-xs text-mist-400">
                  Nothing sent yet. Payouts appear here with a link to the
                  transaction, so you can check every one on Solscan.
                </p>
              )}
              {totalPaid > 0 && (
                <p className="mt-2 text-xs text-mist-400">
                  {fmtUSD(totalPaid)} received in total.
                </p>
              )}

              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                  streak > 0
                    ? `${streak} epochs in the kitchen. paid in real tokenized stock, every 30 minutes.\n\nI'm cooking.`
                    : "holding $TENDIE. paid in real tokenized stock every 30 minutes.\n\nI'm cooking.",
                )}&url=${encodeURIComponent(`https://gettendies.vercel.app/card/${wallet.address}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost mt-3 w-full !py-2.5 text-xs"
              >
                Share my kitchen card
              </a>
            </div>
          )}

          <div className="mt-5 space-y-2.5 rounded-xl border border-tendie/10 bg-ink-900/40 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-mist-300">Share of treasury</span>
              <span className="num text-mist-50">{(shareBps / 100).toFixed(2)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-mist-300">Distribution</span>
              <span className="text-mist-50">Every {DISTRIBUTION_MINUTES} minutes</span>
            </div>
            <div className="flex justify-between">
              <span className="text-mist-300">Next payout in</span>
              <span className="num font-semibold text-tendie">{nextPayout}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-mist-300">Payout asset</span>
              <span className="text-mist-50">{payoutStock.token} · {payoutStock.name}</span>
            </div>
          </div>

          {!wallet.connected ? (
            <button onClick={connect} className="btn-tendie mt-5 w-full py-4">
              Connect Wallet
            </button>
          ) : (
            <div className="mt-5 rounded-xl border border-tendie/25 bg-tendie/5 p-4 text-center">
              <div className="font-mono text-xs font-bold uppercase tracking-wider text-tendie">
                Nothing to claim - payouts are pushed
              </div>
              <p className="mt-2 text-xs leading-relaxed text-mist-400">
                {accruedUsd >= minPayoutUsd && minPayoutUsd > 0
                  ? `Your balance is over the $${minPayoutUsd} floor - it goes out as ${payoutStock.token} on the next distribution.`
                  : minPayoutUsd > 0
                    ? `Rewards accrue every ${DISTRIBUTION_MINUTES} minutes and are sent automatically once your balance passes $${minPayoutUsd}. Below that they keep accruing, so network fees never cost more than the payout.`
                    : "Rewards are sent to your wallet automatically - there is no claim step."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
