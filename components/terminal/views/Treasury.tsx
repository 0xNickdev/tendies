"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { PAYOUT_STOCKS, DEFAULT_STOCK, DISTRIBUTION_MINUTES, feedLabel, type StockSym } from "@/lib/stocks";
import { useQuotes, quotePrice } from "@/lib/useQuotes";
import { useKeeperStatus } from "@/lib/useKeeperStatus";
import { payoutTx } from "@/lib/keeper";
import { fmtUSD, fmtNum } from "@/lib/format";
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
  const [local, setLocal] = useState<StockSym>(DEFAULT_STOCK.symbol);
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
          accent="robin"
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
              <LiveFeedChip label={quotes[payout]?.live ? feedLabel(payout) : "On-chain priced"} />
            </span>
          </div>
          <CandleChart symbol={payout} basePrice={payoutPrice} height={300} />
          <p className="mt-3 text-xs text-zinc-500">
            {payoutStock.name} - the stock you&apos;ve chosen to receive.
          </p>
        </div>

        <div className="panel flex flex-col p-6">
          <span className="label">Accrued for you</span>
          <div className="num mt-2 text-4xl font-semibold text-robin">
            {fmtUSD(accruedUsd)}
          </div>
          <p className="mt-2 text-sm text-zinc-500">
            Accruing in {payoutStock.token}. Sent to your wallet automatically -
            there is nothing to withdraw.
          </p>

          <div className="mt-5">
            <span className="label">Receive rewards as</span>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PAYOUT_STOCKS.map((st) => {
                const price = quotePrice(quotes, st.symbol);
                const active = payout === st.symbol;
                return (
                  <button
                    key={st.symbol}
                    onClick={() => choose(st.symbol)}
                    className={`rounded-lg border px-2 py-2.5 text-center transition-all ${
                      active
                        ? "border-robin/60 bg-robin/10"
                        : "border-robin/10 bg-ink-900/60 hover:border-robin/30"
                    }`}
                  >
                    <div className={`font-mono text-xs font-black ${active ? "text-robin" : "text-zinc-300"}`}>
                      {st.token}
                    </div>
                    <div className="num mt-1 text-[11px] text-zinc-500">
                      ≈ {fmtNum(accruedUsd / price, 3)}
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-zinc-600">
              {saving
                ? "Saving your choice - approve the signature in your wallet…"
                : minPayoutUsd > 0
                  ? `1:1-backed stock tokens on Robinhood Chain, held in your own wallet. Rewards accrue every ${DISTRIBUTION_MINUTES} min and are sent once your balance passes $${minPayoutUsd} - small amounts keep accruing instead of being eaten by gas.`
                  : "1:1-backed stock tokens on Robinhood Chain - held in your own wallet."}
            </p>
          </div>

          {wallet.connected && (
            <div className="mt-5">
              <div className="flex items-center justify-between">
                <span className="label">Your payouts</span>
                {streak > 0 && (
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-robin">
                    {streak} epoch streak
                  </span>
                )}
              </div>
              {payouts.length ? (
                <ul className="mt-2 divide-y divide-robin/10 rounded-xl border border-robin/10 bg-ink-900/40">
                  {payouts.slice(0, 6).map((p) => (
                    <li key={p.signature + p.epoch} className="flex items-center justify-between gap-3 px-3 py-2.5 text-xs">
                      <span className="font-mono text-zinc-500">
                        {new Date(p.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className="font-mono font-bold text-white">{p.symbol}</span>
                      <span className="num text-zinc-300">{p.valueUsd != null ? fmtUSD(p.valueUsd) : fmtNum(p.value)}</span>
                      <a
                        href={payoutTx(p.signature)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-[10px] uppercase tracking-wider text-robin hover:underline"
                      >
                        tx
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 rounded-xl border border-robin/10 bg-ink-900/40 px-3 py-3 text-xs text-zinc-500">
                  Nothing sent yet. Payouts appear here with a link to the
                  transaction, so you can check every one on the explorer.
                </p>
              )}
              {totalPaid > 0 && (
                <p className="mt-2 text-xs text-zinc-500">
                  {fmtUSD(totalPaid)} received in total.
                </p>
              )}

            </div>
          )}

          <div className="mt-5 space-y-2.5 rounded-xl border border-robin/10 bg-ink-900/40 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-400">Share of treasury</span>
              <span className="num text-white">{(shareBps / 100).toFixed(2)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Distribution</span>
              <span className="text-white">Every {DISTRIBUTION_MINUTES} minutes</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Next payout in</span>
              <span className="num font-semibold text-robin">{nextPayout}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Payout asset</span>
              <span className="text-white">{payoutStock.token} · {payoutStock.name}</span>
            </div>
          </div>

          {!wallet.connected ? (
            <button onClick={connect} className="btn-robin mt-5 w-full py-4">
              Connect Wallet
            </button>
          ) : (
            <div className="mt-5 rounded-xl border border-robin/25 bg-robin/5 p-4 text-center">
              <div className="font-mono text-xs font-bold uppercase tracking-wider text-robin">
                Nothing to claim - payouts are pushed
              </div>
              <p className="mt-2 text-xs leading-relaxed text-zinc-500">
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
