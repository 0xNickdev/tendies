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
  const {
    wallet,
    connect,
    claimUsdc,
    shareBps,
    payoutChoice,
    accruedUsd,
    minPayoutUsd,
    setPayoutChoice,
  } = useStore();
  const { push } = useToast();
  const [pending, setPending] = useState(false);
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
  const nextPayout = useNextPayout();

  const payoutStock = PAYOUT_STOCKS.find((st) => st.symbol === payout)!;
  const payoutPrice = quotePrice(quotes, payout);
  const payoutAmount = claimUsdc / payoutPrice;

  const claim = () => {
    if (!wallet.connected) return connect();
    setPending(true);
    push("Confirm claim in wallet…", "pending");
    setTimeout(() => {
      push(`Claimed ${fmtNum(payoutAmount, 4)} ${payoutStock.token} to wallet`, "success");
      setPending(false);
    }, 1100);
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
          accent="tendie"
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
            {payoutStock.name} — the stock you&apos;ve chosen to receive.
          </p>
        </div>

        <div className="panel flex flex-col p-6">
          <span className="label">Accrued for you</span>
          <div className="num mt-2 text-4xl font-semibold text-tendie">
            {fmtUSD(accruedUsd || claimUsdc)}
          </div>
          <p className="mt-2 text-sm text-mist-400">
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
                      ≈ {fmtNum(claimUsdc / price, 3)}
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-mist-500">
              {saving
                ? "Saving your choice — approve the signature in your wallet…"
                : minPayoutUsd > 0
                  ? `1:1-backed xStocks on Solana, held in your own wallet. Rewards accrue every ${DISTRIBUTION_MINUTES} min and are sent once your balance passes $${minPayoutUsd} — small amounts keep accruing instead of being eaten by network fees.`
                  : "1:1-backed xStocks on Solana — held in your own wallet."}
            </p>
          </div>

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

          <button
            onClick={claim}
            disabled={pending || (wallet.connected && claimUsdc <= 0)}
            className="btn-tendie mt-5 w-full py-4"
          >
            {!wallet.connected
              ? "Connect Wallet"
              : claimUsdc <= 0
                ? "Nothing to claim yet"
                : pending
                  ? "Claiming…"
                  : `Claim ${payoutStock.token}`}
          </button>
          <p className="mt-3 text-center text-xs text-mist-400">
            Claiming reduces your perps margin headroom.
          </p>
        </div>
      </div>
    </div>
  );
}
