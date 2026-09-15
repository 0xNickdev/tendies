"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { FEATURES } from "@/lib/mock";
import { PAYOUT_STOCKS, type StockSym } from "@/lib/stocks";
import { useQuotes, quotePrice } from "@/lib/useQuotes";
import { fmtUSD, fmtNum, fmtPct } from "@/lib/format";
import { Segmented, ViewHeader, EmptyState } from "../ui";
import { CandleChart } from "@/components/CandleChart";
import { IconPerps } from "../icons";
import { useToast } from "../Toast";
import type { Direction } from "@/lib/mock";

const LEVERAGES = [1, 2, 3, 5, 10];

export function Perps() {
  const {
    wallet,
    connect,
    claimUsdc,
    positions,
    openPosition,
    closePosition,
  } = useStore();
  const { push } = useToast();

  const [market, setMarket] = useState<StockSym>("TSLA");
  const [dir, setDir] = useState<Direction>("long");
  const [lev, setLev] = useState(3);
  const [margin, setMargin] = useState("");
  const [ack, setAck] = useState(false);
  const [showRisk, setShowRisk] = useState(false);
  const [pending, setPending] = useState(false);

  const quotes = useQuotes();
  const entry = quotePrice(quotes, market);
  const numMargin = parseFloat(margin) || 0;
  const size = numMargin * lev;
  const overBalance = numMargin > claimUsdc + 1e-9;

  const liq = useMemo(() => {
    const move = entry / lev;
    return dir === "long" ? entry - move * 0.95 : entry + move * 0.95;
  }, [entry, lev, dir]);

  const liqPct = ((liq - entry) / entry) * 100;

  const requestOpen = () => {
    if (!FEATURES.perpsLive) return; // preview only — trading unlocks in Phase 02
    if (!wallet.connected) return connect();
    if (numMargin <= 0 || overBalance) return;
    if (!ack) {
      setShowRisk(true);
      return;
    }
    doOpen();
  };

  const doOpen = () => {
    setShowRisk(false);
    setPending(true);
    push("Confirm position in wallet…", "pending");
    setTimeout(() => {
      openPosition({ direction: dir, leverage: lev, marginUsdc: numMargin, entryPrice: entry });
      push(`Opened ${lev}× ${dir.toUpperCase()} · ${fmtUSD(size)}`, "success");
      setMargin("");
      setPending(false);
    }, 1100);
  };

  return (
    <div>
      <ViewHeader
        title="Perps"
        subtitle="Pick a market, then speculate on its next oracle mark using your treasury claim as margin."
        right={
          <span className="flex items-center gap-2">
            <span className="chip">Mark: {fmtUSD(entry)}</span>
            {!FEATURES.perpsLive && (
              <span className="chip !border-robin !bg-robin !text-ink-950">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ink-950 opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-ink-950" />
                </span>
                Preview
              </span>
            )}
          </span>
        }
      />

      {!FEATURES.perpsLive && (
        <div className="panel mb-6 flex flex-col items-start justify-between gap-3 border-robin/30 bg-robin/5 p-5 sm:flex-row sm:items-center">
          <div>
            <div className="font-bold text-robin">
              Perps are next on the roadmap — Phase 02
            </div>
            <div className="mt-1 text-sm text-zinc-400">
              The ticket below is a live preview: play with direction, leverage
              and liquidation math. Opening positions unlocks at launch.
            </div>
          </div>
          <a href="/#roadmap" className="chip shrink-0 hover:bg-robin/15">
            View roadmap →
          </a>
        </div>
      )}

      {/* market selector — pick what you trade */}
      <div className="mb-5 flex flex-wrap gap-2">
        {PAYOUT_STOCKS.map((st) => {
          const price = quotePrice(quotes, st.symbol);
          const chg = quotes[st.symbol]?.changePct ?? 0;
          const active = market === st.symbol;
          return (
            <button
              key={st.symbol}
              onClick={() => setMarket(st.symbol)}
              className={`flex items-center gap-3 rounded-md border-2 px-4 py-2.5 font-mono transition-all ${
                active
                  ? "border-robin/60 bg-robin/10"
                  : "border-robin/15 bg-ink-900/60 hover:border-robin/35"
              }`}
            >
              <span className={`text-sm font-black uppercase ${active ? "text-robin" : "text-zinc-300"}`}>
                {st.symbol}-PERP
              </span>
              <span className="num text-sm font-bold text-white">{fmtUSD(price)}</span>
              <span className={`num text-xs ${chg >= 0 ? "text-long" : "text-short"}`}>
                {chg >= 0 ? "+" : ""}
                {chg.toFixed(2)}%
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* order ticket */}
        <div className="panel relative overflow-hidden p-6 lg:col-span-2">
          {!FEATURES.perpsLive && (
            <span className="absolute right-[-38px] top-[22px] rotate-45 bg-robin px-12 py-1 text-center font-mono text-xs font-black uppercase tracking-widest text-ink-950">
              Soon
            </span>
          )}
          <Segmented<Direction>
            value={dir}
            onChange={setDir}
            options={[
              { label: "▲ Long", value: "long" },
              { label: "▼ Short", value: "short" },
            ]}
          />

          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="label">Margin (from claim)</span>
              <button
                onClick={() => setMargin(String(Math.floor(claimUsdc)))}
                className="text-xs text-robin hover:underline"
              >
                Avail: {fmtUSD(claimUsdc)} · Max
              </button>
            </div>
            <div
              className={`flex items-center gap-3 rounded-xl border bg-ink-900/60 px-4 py-3 ${
                overBalance ? "border-short/50" : "border-robin/10 focus-within:border-robin/40"
              }`}
            >
              <input
                inputMode="decimal"
                value={margin}
                onChange={(e) => setMargin(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0.00"
                className="num w-full bg-transparent text-2xl font-semibold text-white outline-none placeholder:text-zinc-600"
              />
              <span className="shrink-0 rounded-lg bg-robin/10 px-3 py-1.5 text-sm font-semibold text-robin">
                USDC
              </span>
            </div>
            {overBalance && (
              <p className="mt-2 text-xs text-short">Exceeds available claim.</p>
            )}
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="label">Leverage</span>
              <span className="num text-sm font-semibold text-robin">{lev}×</span>
            </div>
            <div className="flex gap-2">
              {LEVERAGES.map((l) => (
                <button
                  key={l}
                  onClick={() => setLev(l)}
                  className={`num flex-1 rounded-lg border py-2 text-sm font-semibold transition-all ${
                    lev === l
                      ? "border-robin/40 bg-robin/15 text-robin"
                      : "border-robin/10 bg-ink-900/60 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {l}×
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 space-y-2.5 rounded-xl border border-robin/10 bg-ink-900/40 p-4 text-sm">
            <Row label="Direction" value={dir === "long" ? "Long ▲" : "Short ▼"} accent={dir === "long" ? "long" : "short"} />
            <Row label="Entry mark" value={fmtUSD(entry)} />
            <Row label="Position size" value={fmtUSD(size)} />
            <Row
              label="Est. liquidation"
              value={`${fmtUSD(liq)} (${fmtPct(liqPct, 1)})`}
              accent="short"
            />
          </div>

          {/* acknowledgement */}
          <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm text-zinc-400">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#D9FF4D]"
            />
            <span>
              I understand perps are high-risk, leveraged, and can be fully
              liquidated. <button type="button" onClick={() => setShowRisk(true)} className="text-robin underline">Read disclosure</button>.
            </span>
          </label>

          <button
            onClick={requestOpen}
            disabled={
              !FEATURES.perpsLive ||
              pending ||
              (wallet.connected && (numMargin <= 0 || overBalance))
            }
            className={`mt-4 w-full rounded-xl py-4 text-base font-semibold transition-all active:scale-[0.98] disabled:opacity-40 ${
              !FEATURES.perpsLive
                ? "border-2 border-dashed border-robin/50 bg-robin/10 !opacity-100 text-robin"
                : dir === "long"
                  ? "bg-long text-ink-950 hover:brightness-110"
                  : "bg-short text-ink-950 hover:brightness-110"
            }`}
          >
            {!FEATURES.perpsLive
              ? "Coming Soon — Phase 02"
              : !wallet.connected
                ? "Connect Wallet"
                : pending
                  ? "Opening…"
                  : `Open ${lev}× ${dir === "long" ? "Long" : "Short"}`}
          </button>
        </div>

        {/* chart + open positions */}
        <div className="lg:col-span-3">
          <div className="panel mb-6 p-5">
            <CandleChart symbol={market} basePrice={entry} />
          </div>

          <div className="mb-3 flex items-center justify-between">
            <span className="label">Open positions</span>
            {positions.length > 0 && (
              <span className="chip">{positions.length} active</span>
            )}
          </div>

          {positions.length === 0 ? (
            <EmptyState
              icon={<IconPerps className="h-6 w-6" />}
              title="No open positions"
              body={
                FEATURES.perpsLive
                  ? "Set your direction, margin, and leverage on the left to open your first position on the next mark."
                  : "Perps are in preview — positions unlock when trading goes live in Phase 02. Meanwhile, rehearse your setup on the left."
              }
            />
          ) : (
            <div className="space-y-3">
              {positions.map((p) => {
                const dirUp = p.direction === "long";
                // unrealized PnL at current mark (entry == mark at open ⇒ ~0)
                const pnl =
                  ((entry - p.entryPrice) / p.entryPrice) *
                  p.sizeUsd *
                  (dirUp ? 1 : -1);
                const pnlPct = (pnl / p.marginUsdc) * 100;
                return (
                  <div key={p.id} className="panel p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                            dirUp ? "bg-long/15 text-long" : "bg-short/15 text-short"
                          }`}
                        >
                          {dirUp ? "LONG" : "SHORT"} {p.leverage}×
                        </span>
                        <span className="text-xs text-zinc-500">#{p.id}</span>
                      </div>
                      <div className={`num text-right text-sm font-semibold ${pnl >= 0 ? "text-long" : "text-short"}`}>
                        {pnl >= 0 ? "+" : ""}
                        {fmtUSD(pnl)}{" "}
                        <span className="opacity-70">({fmtPct(pnlPct, 1)})</span>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                      <Cell label="Margin" value={fmtUSD(p.marginUsdc)} />
                      <Cell label="Size" value={fmtUSD(p.sizeUsd)} />
                      <Cell label="Entry" value={fmtUSD(p.entryPrice)} />
                      <Cell label="Liq." value={fmtUSD(p.liqPrice)} accent="short" />
                    </div>
                    <button
                      onClick={() => {
                        closePosition(p.id);
                        push(`Closed #${p.id} · ${pnl >= 0 ? "+" : ""}${fmtUSD(pnl)}`, pnl >= 0 ? "success" : "error");
                      }}
                      className="btn-ghost mt-4 w-full"
                    >
                      Close position
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showRisk && (
        <RiskModal
          onClose={() => setShowRisk(false)}
          onAccept={() => {
            setAck(true);
            if (numMargin > 0 && !overBalance && wallet.connected) doOpen();
            else setShowRisk(false);
          }}
        />
      )}
    </div>
  );
}

function RiskModal({
  onClose,
  onAccept,
}: {
  onClose: () => void;
  onAccept: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-ink-950/80 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="animate-fade-up w-full max-w-md rounded-t-3xl border border-robin/15 bg-ink-850 p-6 shadow-glow sm:rounded-3xl">
        <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-warn/30 bg-warn/10 text-warn">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 9v4M12 17h.01M10.3 3.9l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3l-8-14a2 2 0 0 0-3.4 0z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-white">Risk disclosure</h3>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          Perpetual futures on tokenized-stock oracle marks are highly speculative.
          Please acknowledge before continuing:
        </p>
        <ul className="mt-4 space-y-2.5 text-sm text-zinc-300">
          {[
            "Leverage amplifies both gains and losses.",
            "Your position can be fully liquidated, losing 100% of margin.",
            "Oracle marks print on a schedule and can gap sharply.",
            "This is synthetic exposure — not direct share ownership.",
          ].map((t) => (
            <li key={t} className="flex gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warn" />
              {t}
            </li>
          ))}
        </ul>
        <div className="mt-6 flex gap-3">
          <button onClick={onClose} className="btn-ghost flex-1">
            Cancel
          </button>
          <button onClick={onAccept} className="btn-robin flex-1">
            I understand
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "long" | "short";
}) {
  const c = accent === "long" ? "text-long" : accent === "short" ? "text-short" : "text-zinc-200";
  return (
    <div className="flex items-center justify-between">
      <span className="text-zinc-400">{label}</span>
      <span className={`num font-medium ${c}`}>{value}</span>
    </div>
  );
}

function Cell({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "short";
}) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className={`num mt-0.5 font-medium ${accent === "short" ? "text-short" : "text-zinc-100"}`}>
        {value}
      </div>
    </div>
  );
}
