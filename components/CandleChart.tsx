"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fmtUSD } from "@/lib/format";
import { useCandles } from "@/lib/useCandles";

// Real OHLC from /api/candles. The seeded generator below stays as the
// fallback: if the feed is unreachable the chart still draws something and
// says so, instead of collapsing to an empty box.

type TF = "15m" | "1H" | "4H" | "1D";

type Candle = {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  label: string; // x-axis time label
};

function symbolSeed(symbol: string): number {
  let h = 0;
  for (const ch of symbol) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h % 1000) + 7;
}

const TF_CONFIG: Record<
  TF,
  { seed: number; vol: number; count: number; stepMin: number }
> = {
  "15m": { seed: 11, vol: 0.0045, count: 72, stepMin: 15 },
  "1H": { seed: 23, vol: 0.009, count: 72, stepMin: 60 },
  "4H": { seed: 37, vol: 0.016, count: 72, stepMin: 240 },
  "1D": { seed: 51, vol: 0.026, count: 72, stepMin: 1440 },
};

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function timeLabel(i: number, count: number, stepMin: number): string {
  // walk back from a fixed 16:00 close, purely arithmetic → no TZ drift
  const minutesBack = (count - 1 - i) * stepMin;
  const total = 16 * 60 - (minutesBack % (24 * 60));
  const m = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  if (stepMin >= 1440) {
    const day = ((i * 1) % 28) + 1;
    return `${String(day).padStart(2, "0")}.06`;
  }
  return `${hh}:${mm}`;
}

function genCandles(tf: TF, symbol: string, basePrice: number): Candle[] {
  const { seed, vol, count, stepMin } = TF_CONFIG[tf];
  const rnd = mulberry32(seed * symbolSeed(symbol));
  // random-walk backwards from the market's current price
  const closes: number[] = [basePrice];
  for (let i = 1; i < count; i++) {
    const drift = (rnd() - 0.52) * vol; // slight downward bias backwards = uptrend forwards
    closes.push(closes[i - 1] * (1 - drift));
  }
  closes.reverse();

  const candles: Candle[] = [];
  for (let i = 0; i < count; i++) {
    const open = i === 0 ? closes[0] * (1 - (rnd() - 0.5) * vol) : closes[i - 1];
    const close = closes[i];
    const hi = Math.max(open, close) * (1 + rnd() * vol * 0.7);
    const lo = Math.min(open, close) * (1 - rnd() * vol * 0.7);
    const volume = 0.25 + rnd() * 0.75 + (Math.abs(close - open) / open / vol) * 0.6;
    candles.push({
      open,
      high: hi,
      low: lo,
      close,
      volume,
      label: timeLabel(i, count, stepMin),
    });
  }
  return candles;
}

const UP = "#3CE3AB";
const DOWN = "#F23674";

const VISIBLE_DEFAULT = 72; // candles in the window the reader drags along

function labelFor(t: number, tf: TF): string {
  const d = new Date(t * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return tf === "1D"
    ? `${p(d.getDate())}.${p(d.getMonth() + 1)}`
    : `${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function CandleChart({
  symbol = "TSLA",
  basePrice,
  height = 320,
}: {
  symbol?: string;
  basePrice: number;
  height?: number;
}) {
  const [tf, setTf] = useState<TF>("1H");
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const { bars, live } = useCandles(symbol, tf);

  // Real bars when the feed answers, seeded preview when it doesn't.
  const all = useMemo<Candle[]>(() => {
    if (bars.length) {
      return bars.map((b) => ({
        open: b.o,
        high: b.h,
        low: b.l,
        close: b.c,
        volume: b.v,
        label: labelFor(b.t, tf),
      }));
    }
    return genCandles(tf, symbol, basePrice);
  }, [bars, tf, symbol, basePrice]);

  // Viewport over the series: null means "stick to the right edge".
  const [view, setView] = useState<{ start: number; count: number } | null>(null);
  useEffect(() => setView(null), [symbol, tf]);

  const count = Math.min(
    all.length,
    view?.count ?? Math.min(VISIBLE_DEFAULT, all.length),
  );
  const maxStart = Math.max(0, all.length - count);
  const start = Math.min(view?.start ?? maxStart, maxStart);
  const atRightEdge = start >= maxStart;
  // A window that computes to nothing would take `last` down with it, and the
  // whole view renders off `last`.
  const sliced = all.slice(start, start + count);
  const candles = sliced.length ? sliced : all;

  // ── pan on drag ─────────────────────────────────────────────────────────
  // No wheel zoom: on a trackpad a pinch arrives as a ctrl-wheel event, and
  // intercepting it fought the browser's own gesture handling hard enough to
  // kill the renderer. The window is a fixed width that the reader drags along.

  const drag = useRef<{ x: number; start: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    drag.current = { x: e.clientX, start };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    drag.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  const resetView = () => setView(null);

  const w = 760;
  const h = height;
  const padR = 58; // right price axis
  const padT = 10;
  const volH = 48;
  const gapV = 14;
  const axisH = 20;
  const plotW = w - padR;
  const plotH = h - padT - volH - gapV - axisH;

  const min = Math.min(...candles.map((c) => c.low));
  const max = Math.max(...candles.map((c) => c.high));
  const span = max - min || 1;
  const maxVol = Math.max(...candles.map((c) => c.volume));

  const xStep = plotW / candles.length;
  const bodyW = Math.max(2, xStep * 0.58);
  const cx = (i: number) => i * xStep + xStep / 2;
  const py = (v: number) => padT + (1 - (v - min) / span) * plotH;
  const vy = (v: number) => padT + plotH + gapV + (1 - v / maxVol) * volH;

  const last = candles[candles.length - 1];
  const shown = hover != null ? candles[hover] : last;
  // the "current price" marker belongs to the live quote, so it is only drawn
  // while the window is parked at the right edge of the series
  const markPrice = live && isFinite(basePrice) && basePrice > 0 ? basePrice : last.close;
  const showMark = atRightEdge && markPrice >= min && markPrice <= max;
  const chg = ((shown.close - shown.open) / shown.open) * 100;
  const chgUp = chg >= 0;

  const gridLevels = [0.1, 0.35, 0.6, 0.85];

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();

    // dragging pans the window; the cursor never leaves the candle it grabbed
    if (drag.current) {
      const pxPerCandle = rect.width / count;
      const moved = Math.round((e.clientX - drag.current.x) / pxPerCandle);
      const next = Math.min(
        Math.max(0, drag.current.start - moved),
        Math.max(0, all.length - count),
      );
      if (next !== start) setView({ start: next, count });
      setHover(null);
      return;
    }

    const x = ((e.clientX - rect.left) / rect.width) * w;
    if (x > plotW) return setHover(null);
    const i = Math.min(candles.length - 1, Math.max(0, Math.floor(x / xStep)));
    setHover(i);
  };

  return (
    <div>
      {/* header: pair + OHLC readout + timeframes */}
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="font-mono text-sm font-black uppercase tracking-wide text-white">
          {symbol}-PERP
        </span>
        <span className="num flex flex-wrap gap-x-3 font-mono text-[11px] text-mist-400">
          <span>
            O <span className="text-mist-200">{shown.open.toFixed(2)}</span>
          </span>
          <span>
            H <span className="text-mist-200">{shown.high.toFixed(2)}</span>
          </span>
          <span>
            L <span className="text-mist-200">{shown.low.toFixed(2)}</span>
          </span>
          <span>
            C <span className="text-mist-200">{shown.close.toFixed(2)}</span>
          </span>
          <span style={{ color: chgUp ? UP : DOWN }}>
            {chgUp ? "+" : ""}
            {chg.toFixed(2)}%
          </span>
        </span>
        <div className="ml-auto flex items-center gap-1">
          {view && (
            <button
              onClick={resetView}
              className="mr-1 rounded border border-tendie/30 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-tendie hover:bg-tendie/10"
            >
              Reset
            </button>
          )}
          {(Object.keys(TF_CONFIG) as TF[]).map((t) => (
            <button
              key={t}
              onClick={() => setTf(t)}
              className={`rounded px-2.5 py-1 font-mono text-[11px] font-bold transition-colors ${
                tf === t
                  ? "border border-tendie/50 bg-tendie/15 text-tendie"
                  : "border border-transparent text-mist-400 hover:text-mist-200"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${w} ${h}`}
        className="w-full touch-pan-y select-none"
        style={{ cursor: drag.current ? "grabbing" : "crosshair" }}
        role="img"
        aria-label={`${symbol} price chart - ${live ? "real OHLC" : "simulated preview"}, drag to pan`}
        onPointerMove={onMove}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={resetView}
        onPointerLeave={(e) => {
          onPointerUp(e);
          setHover(null);
        }}
      >
        {/* grid + price axis */}
        {gridLevels.map((g) => {
          const price = max - g * span;
          const y = py(price);
          return (
            <g key={g}>
              <line x1={0} x2={plotW} y1={y} y2={y} stroke="rgba(105, 170, 193,0.07)" />
              <text
                x={w - padR + 8}
                y={y + 3.5}
                className="fill-zinc-600"
                fontSize="10"
                fontFamily="var(--font-mono)"
              >
                {price.toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* candles */}
        {candles.map((c, i) => {
          const up = c.close >= c.open;
          const color = up ? UP : DOWN;
          const x = cx(i);
          const yO = py(c.open);
          const yC = py(c.close);
          return (
            <g key={i} opacity={hover != null && hover !== i ? 0.55 : 1}>
              <line x1={x} x2={x} y1={py(c.high)} y2={py(c.low)} stroke={color} strokeWidth="1.1" />
              <rect
                x={x - bodyW / 2}
                y={Math.min(yO, yC)}
                width={bodyW}
                height={Math.max(1.2, Math.abs(yC - yO))}
                fill={color}
              />
              <rect
                x={x - bodyW / 2}
                y={vy(c.volume)}
                width={bodyW}
                height={padT + plotH + gapV + volH - vy(c.volume)}
                fill={color}
                opacity="0.35"
              />
            </g>
          );
        })}

        {/* current price line + tag */}
        {showMark && (
          <>
            <line
              x1={0}
              x2={plotW}
              y1={py(markPrice)}
              y2={py(markPrice)}
              stroke="#69AAC1"
              strokeWidth="1"
              strokeDasharray="4 4"
              opacity="0.8"
            />
            <g>
              <rect x={plotW + 2} y={py(markPrice) - 9} width={padR - 4} height={18} rx={3} fill="#69AAC1" />
              <text
                x={plotW + padR / 2}
                y={py(markPrice) + 3.5}
                textAnchor="middle"
                fontSize="10"
                fontWeight="700"
                fontFamily="var(--font-mono)"
                fill="#071013"
              >
                {markPrice.toFixed(2)}
              </text>
            </g>
          </>
        )}

        {/* crosshair */}
        {hover != null && (
          <g pointerEvents="none">
            <line
              x1={cx(hover)}
              x2={cx(hover)}
              y1={padT}
              y2={padT + plotH + gapV + volH}
              stroke="rgba(105, 170, 193,0.35)"
              strokeDasharray="3 3"
            />
            <line
              x1={0}
              x2={plotW}
              y1={py(candles[hover].close)}
              y2={py(candles[hover].close)}
              stroke="rgba(105, 170, 193,0.35)"
              strokeDasharray="3 3"
            />
          </g>
        )}

        {/* x-axis time labels */}
        {candles.map((c, i) =>
          i % Math.max(6, Math.round(count / 6)) === 0 ? (
            <text
              key={`t${i}`}
              x={cx(i)}
              y={h - 4}
              textAnchor="middle"
              fontSize="9.5"
              fontFamily="var(--font-mono)"
              className="fill-zinc-600"
            >
              {c.label}
            </text>
          ) : null,
        )}
      </svg>

      <p className="mt-2 font-mono text-[11px] text-mist-500">
        {live ? (
          <>
            Nasdaq OHLC · {all.length} bars, delayed ~15 min · drag to pan · perps settle against oracle mark{" "}
            <span className="text-mist-300">{fmtUSD(basePrice)}</span>
          </>
        ) : (
          <>
            Feed unavailable - simulated preview candles · settles against
            oracle mark <span className="text-mist-300">{fmtUSD(basePrice)}</span>
          </>
        )}
      </p>
    </div>
  );
}
