"use client";

import { useEffect, useState } from "react";
import type { Bar } from "@/app/api/candles/route";

export type { Bar };

// Pulls real OHLC for one symbol/timeframe. An empty array means the feed is
// unavailable — the chart then draws its seeded preview instead of nothing.
export function useCandles(symbol: string, tf: string) {
  const [bars, setBars] = useState<Bar[]>([]);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const load = async () => {
      try {
        const res = await fetch(
          `/api/candles?symbol=${encodeURIComponent(symbol)}&tf=${encodeURIComponent(tf)}`,
        );
        const json = await res.json();
        if (cancelled) return;
        setBars(Array.isArray(json?.candles) ? json.candles : []);
        setLive(Boolean(json?.live));
      } catch {
        if (!cancelled) {
          setBars([]);
          setLive(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    // intraday frames move during the session; daily doesn't need chasing
    const ms = tf === "1D" ? 10 * 60_000 : 60_000;
    const timer = setInterval(load, ms);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [symbol, tf]);

  return { bars, live, loading };
}
