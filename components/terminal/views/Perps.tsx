"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { FEATURES } from "@/lib/mock";
import { PAYOUT_STOCKS, DEFAULT_STOCK, type StockSym } from "@/lib/stocks";
import { useQuotes, quotePrice } from "@/lib/useQuotes";
import { fmtUSD, fmtNum, fmtPct, fmtDate } from "@/lib/format";
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
    accruedUsd,
    positions,
    perps,
    openPosition,
    closePosition,
  } = useStore();
  const { push } = useToast();
  // Margin is the accrued balance - the keeper is the counterparty, so the
  // stake never leaves the treasury until it is paid out as stock.
  const claimUsd = accruedUsd;

  const [market, setMarket] = useState<StockSym>(DEFAULT_STOCK.symbol);
  const [dir, setDir] = useState<Direction>("long");
  const [lev, setLev] = useState(3);
  const [margin, setMargin] = useState("");
  const [ack, setAck] = useState(false);
  const [showRisk, setShowRisk] = useState(false);
  const [pending, setPending] = useState(false);

  const quotes = useQuotes();
  // Positions open and settle on the keeper's mark, not the site quote; the
  // quote is only the preview while no keeper is wired up.
  const keeperMark = perps?.marks?.[market];
  const entry = keeperMark?.price ?? quotePrice(quotes, market);
  const numMargin = parseFloat(margin) || 0;
  const size = numMargin * lev;
  const overBalance = numMargin > claimUsd + 1e-9;
  const minMargin = perps?.minMarginUsd ?? 1;
  const underMin = numMargin > 0 && numMargin < minMargin;
  const liquidationPct = perps?.liquidationPct ?? 95;
  const fundingBps = perps?.fundingRateBps ?? 5;
  const fundingHours = perps?.fundingIntervalHours ?? 8;
  const fundingUsd = (size * fundingBps) / 10_000;
  // Rewards accrue in the quote token; the position is dollar-denominated so
  // it is one bet, not two. Show what the dollars are in that token anyway.
  const quotePx = perps?.marks?.[DEFAULT_STOCK.symbol]?.price ?? quotePrice(quotes, DEFAULT_STOCK.symbol);
  const marginInQuote = quotePx > 0 ? numMargin / quotePx : 0;
  const maxPosition = perps?.maxPositionUsd ?? null;
  const overMax = maxPosition != null && size > maxPosition + 1e-9;

  // Same formula as liquidationPrice() in keeper/src/perps.js.
  const liq = useMemo(() => {
    const move = (liquidationPct / 100) / lev;
    return dir === "long" ? entry * (1 - move) : entry * (1 + move);
  }, [entry, lev, dir, liquidationPct]);

  const liqPct = ((liq - entry) / entry) * 100;

  const closeOne = async (p: (typeof positions)[number]) => {
    setPending(true);
    push("Sign in your wallet to close…", "pending");
    const r = await closePosition(p.id);
    setPending(false);
    if (r.ok && r.position) {
      const pnl = r.position.pnlUsd;
      push(`Closed ${p.symbol} · ${pnl >= 0 ? "+" : ""}${fmtUSD(pnl)} · ${fmtUSD(r.position.returnedUsd)} back to accrued`, pnl >= 0 ? "success" : "error");
    } else {
      push(r.error ?? "Could not close", "error");
    }
  };

  const requestOpen = () => {
    if (!FEATURES.perpsLive) return; // preview only - trading unlocks with the keeper
    if (!wallet.connected) return connect();
    if (numMargin <= 0 || overBalance || underMin || overMax) return;
    if (!ack) {
      setShowRisk(true);
      return;
    }
    doOpen();
  };

  const doOpen = async () => {
    setShowRisk(false);
    setPending(true);
    push("Sign the position in your wallet…", "pending");
    const r = await openPosition({ market, direction: dir, leverage: lev, marginUsd: numMargin });
    setPending(false);
    if (r.ok && r.position) {
      push(`Opened ${lev}× ${dir.toUpperCase()} ${market} · ${fmtUSD(r.position.sizeUsd)} @ ${fmtUSD(r.position.entry)}`, "success");
      setMargin("");
    } else {
      push(r.error ?? "Could not open", "error");
    }
  };

  return (
    <div>
      <ViewHeader
        title="Perps"
        subtitle="Pick a market, then speculate on its next oracle mark using your accrued rewards as margin."
        right={
          <span className="flex items-center gap-2">
            <span className="chip" title={keeperMark?.at ? `Keeper mark · ${fmtDate(keeperMark.at)}` : "Site quote - keeper mark once live"}>
              Mark: {fmtUSD(entry)}
            </span>
            {FEATURES.perpsLive && perps && !perps.enabled && (
              <span className="chip !border-warn/50 !text-warn">Paused</span>
            )}
            {!FEATURES.perpsLive && (
              <span className="chip !border-tendie !bg-tendie !text-ink-950">
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
        <div className="panel mb-6 flex flex-col items-start justify-between gap-3 border-tendie/30 bg-tendie/5 p-5 sm:flex-row sm:items-center">
          <div>
            <div className="font-bold text-tendie">
              Perps go live with the token
            </div>
            <div className="mt-1 text-sm text-mist-300">
              The ticket below is a live preview: play with direction, leverage
              and liquidation math. Opening positions unlocks the moment the
              keeper is wired up at launch.
            </div>
          </div>
          <a href="/#roadmap" className="chip shrink-0 hover:bg-tendie/15">
            View roadmap →
          </a>
        </div>
      )}

      {/* market selector - pick what you trade */}
      <div className="mb-5 flex flex-wrap gap-2">
        {PAYOUT_STOCKS.map((st) => {
          const price = quotePrice(quotes, st.symbol);
          const chg = quotes[st.symbol]?.changePct ?? 0;
          const active = market === st.symbol;
          return (
            <button
              key={st.symbol}
              onClick={() => setMarket(st.symbol)}
              className={`flex items-center gap-3 rounded-md border px-4 py-2.5 font-mono transition-all ${
                active
                  ? "border-tendie/60 bg-tendie/10"
                  : "border-tendie/15 bg-ink-900/60 hover:border-tendie/35"
              }`}
            >
              <span className={`text-sm font-black uppercase ${active ? "text-tendie" : "text-mist-200"}`}>
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
            <span className="absolute right-[-38px] top-[22px] rotate-45 bg-tendie px-12 py-1 text-center font-mono text-xs font-black uppercase tracking-widest text-ink-950">
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
              <span className="label">Margin (from accrued)</span>
              <button
                onClick={() => setMargin(String(Math.floor(claimUsd)))}
                className="text-xs text-tendie hover:underline"
              >
                Avail: {fmtUSD(claimUsd)} · Max
              </button>
            </div>
            <div
              className={`flex items-center gap-3 rounded-xl border bg-ink-900/60 px-4 py-3 ${
                overBalance ? "border-short/50" : "border-tendie/10 focus-within:border-tendie/40"
              }`}
            >
              <input
                inputMode="decimal"
                value={margin}
                onChange={(e) => setMargin(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0.00"
                className="num w-full bg-transparent text-2xl font-semibold text-white outline-none placeholder:text-mist-500"
              />
              <span className="shrink-0 rounded-lg bg-tendie/10 px-3 py-1.5 text-sm font-semibold text-tendie">
                USD value
              </span>
            </div>
            <p className="mt-2 font-mono text-[11px] text-mist-500">
              ≈ {marginInQuote.toLocaleString("en-US", { maximumFractionDigits: 5 })} {DEFAULT_STOCK.token} · rewards
              accrue in {DEFAULT_STOCK.token} and are swapped to your pick only at payout · held in dollars while open
            </p>
            {overBalance && (
              <p className="mt-2 text-xs text-short">Exceeds your accrued balance.</p>
            )}
            {underMin && (
              <p className="mt-2 text-xs text-short">Minimum margin is {fmtUSD(minMargin)}.</p>
            )}
            {overMax && (
              <p className="mt-2 text-xs text-short">
                Max position right now is {fmtUSD(maxPosition ?? 0)} - the house reserve caps size.
              </p>
            )}
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="label">Leverage</span>
              <span className="num text-sm font-semibold text-tendie">{lev}×</span>
            </div>
            <div className="flex gap-2">
              {LEVERAGES.map((l) => (
                <button
                  key={l}
                  onClick={() => setLev(l)}
                  className={`num flex-1 rounded-lg border py-2 text-sm font-semibold transition-all ${
                    lev === l
                      ? "border-tendie/40 bg-tendie/15 text-tendie"
                      : "border-tendie/10 bg-ink-900/60 text-mist-300 hover:text-mist-50"
                  }`}
                >
                  {l}×
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 space-y-2.5 rounded-xl border border-tendie/10 bg-ink-900/40 p-4 text-sm">
            <Row label="Direction" value={dir === "long" ? "Long ▲" : "Short ▼"} accent={dir === "long" ? "long" : "short"} />
            <Row label="Entry mark" value={fmtUSD(entry)} />
            <Row label="Position size" value={fmtUSD(size)} />
            <Row
              label="Est. liquidation"
              value={`${fmtUSD(liq)} (${fmtPct(liqPct, 1)})`}
              accent="short"
            />
            <Row
              label={`Funding / ${fundingHours}h`}
              value={`${fmtUSD(fundingUsd)} (${(fundingBps / 100).toFixed(2)}%)`}
            />
            {maxPosition != null && (
              <Row label="Max position now" value={`${fmtUSD(maxPosition)} · reserve ${fmtUSD(perps?.reserveUsd ?? 0)}`} />
            )}
          </div>
          <p className="mt-2 text-xs text-mist-500">
            Funding is a flat {(fundingBps / 100).toFixed(2)}% of position size every {fundingHours}h,
            charged to your margin and kept by the treasury. Positions have no expiry -
            funding is what makes holding leverage cost something.
          </p>

          {/* acknowledgement */}
          <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm text-mist-300">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#69AAC1]"
            />
            <span>
              I understand perps are high-risk, leveraged, and can be fully
              liquidated. <button type="button" onClick={() => setShowRisk(true)} className="text-tendie underline">Read disclosure</button>.
            </span>
          </label>

          <button
            onClick={requestOpen}
            disabled={
              !FEATURES.perpsLive ||
              pending ||
              (perps ? !perps.enabled : false) ||
              (wallet.connected && (numMargin <= 0 || overBalance || underMin || overMax))
            }
            className={`mt-4 w-full rounded-xl py-4 text-base font-semibold transition-all active:scale-[0.98] disabled:opacity-40 ${
              !FEATURES.perpsLive
                ? "border border-dashed border-tendie/50 bg-tendie/10 !opacity-100 text-tendie"
                : dir === "long"
                  ? "bg-long text-ink-950 hover:brightness-110"
                  : "bg-short text-ink-950 hover:brightness-110"
            }`}
          >
            {!FEATURES.perpsLive
              ? "Live at launch"
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
                  ? "Set your direction, margin, and leverage on the left to open your first position on the current mark."
                  : "Perps are in preview - positions unlock when trading goes live. Meanwhile, rehearse your setup on the left."
              }
            />
          ) : (
            <div className="space-y-3">
              {positions.map((p) => {
                const dirUp = p.side === "long";
                // Marked by the keeper against its last published mark.
                const pnl = p.pnlUsd;
                const pnlPct = (pnl / p.marginUsd) * 100;
                return (
                  <div key={p.id} className="panel p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                            dirUp ? "bg-long/15 text-long" : "bg-short/15 text-short"
                          }`}
                        >
                          {dirUp ? "LONG" : "SHORT"} {p.leverage}× {p.symbol}
                        </span>
                        <span className="text-xs text-mist-400">#{p.id}</span>
                      </div>
                      <div className={`num text-right text-sm font-semibold ${pnl >= 0 ? "text-long" : "text-short"}`}>
                        {pnl >= 0 ? "+" : ""}
                        {fmtUSD(pnl)}{" "}
                        <span className="opacity-70">({fmtPct(pnlPct, 1)})</span>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                      <Cell label="Margin" value={fmtUSD(p.marginUsd)} />
                      <Cell label="Size" value={fmtUSD(p.sizeUsd)} />
                      <Cell label="Entry → Mark" value={`${fmtUSD(p.entry)} → ${fmtUSD(p.mark)}`} />
                      <Cell label="Liq." value={fmtUSD(p.liqPrice)} accent="short" />
                    </div>
                    <div className="mt-3 flex flex-wrap justify-between gap-2 font-mono text-[11px] text-mist-500">
                      <span>Equity {fmtUSD(p.equityUsd)} · funding paid {fmtUSD(p.fundingPaidUsd)}</span>
                      <span>Next funding {fmtDate(p.nextFundingAt)}</span>
                    </div>
                    <button
                      onClick={() => void closeOne(p)}
                      disabled={pending}
                      className="btn-ghost mt-4 w-full disabled:opacity-40"
                    >
                      Close at mark {fmtUSD(p.mark)}
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
      <div className="animate-fade-up w-full max-w-md rounded-t-3xl border border-tendie/15 bg-ink-850 p-6 shadow-glow sm:rounded-3xl">
        <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-warn/30 bg-warn/10 text-warn">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 9v4M12 17h.01M10.3 3.9l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3l-8-14a2 2 0 0 0-3.4 0z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-white">Risk disclosure</h3>
        <p className="mt-2 text-sm leading-relaxed text-mist-300">
          Perpetual futures on tokenized-stock oracle marks are highly speculative.
          Please acknowledge before continuing:
        </p>
        <ul className="mt-4 space-y-2.5 text-sm text-mist-200">
          {[
            "Leverage amplifies both gains and losses.",
            "Your position can be fully liquidated, losing 100% of margin.",
            "Marks print every few minutes and can gap sharply between them.",
            "Funding is charged on position size every 8 hours while it stays open.",
            "The treasury is the counterparty - your margin is your accrued rewards.",
            "This is synthetic exposure - not direct share ownership.",
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
          <button onClick={onAccept} className="btn-tendie flex-1">
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
  const c = accent === "long" ? "text-long" : accent === "short" ? "text-short" : "text-mist-50";
  return (
    <div className="flex items-center justify-between">
      <span className="text-mist-300">{label}</span>
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
      <div className={`num mt-0.5 font-medium ${accent === "short" ? "text-short" : "text-mist-50"}`}>
        {value}
      </div>
    </div>
  );
}
