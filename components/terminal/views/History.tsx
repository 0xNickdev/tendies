"use client";

import { useStore } from "@/lib/store";
import { fmtUSD, fmtPct, fmtDate } from "@/lib/format";
import { ViewHeader, EmptyState, Stat } from "../ui";
import { IconHistory } from "../icons";
import type { View } from "../TerminalShell";

export function History({ go }: { go: (v: View) => void }) {
  const { history } = useStore();

  const realized = history.reduce((s, p) => s + p.pnlUsd, 0);
  const wins = history.filter((p) => p.pnlUsd > 0).length;
  const winRate = history.length ? (wins / history.length) * 100 : 0;

  return (
    <div>
      <ViewHeader
        title="Position History"
        subtitle="Settled perps trades against published oracle marks."
      />

      {history.length === 0 ? (
        <EmptyState
          icon={<IconHistory className="h-6 w-6" />}
          title="No settled positions yet"
          body="Perps are in preview — once trading goes live in Phase 02 and a position settles, it'll appear here."
          action={
            <button onClick={() => go("perps")} className="btn-robin">
              Preview perps
            </button>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat
              label="Realized PnL"
              value={`${realized >= 0 ? "+" : ""}${fmtUSD(realized)}`}
              accent={realized >= 0 ? "long" : "short"}
            />
            <Stat label="Settled Trades" value={history.length} />
            <Stat label="Win Rate" value={`${winRate.toFixed(0)}%`} accent="robin" />
          </div>

          <div className="panel mt-6 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-robin/10 bg-ink-900/60 text-left text-zinc-500">
                    <th className="px-5 py-3 font-medium">Position</th>
                    <th className="px-5 py-3 font-medium">Entry → Exit</th>
                    <th className="px-5 py-3 font-medium">Margin</th>
                    <th className="px-5 py-3 font-medium">Settled</th>
                    <th className="px-5 py-3 text-right font-medium">PnL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-robin/5">
                  {history.map((p) => {
                    const dirUp = p.direction === "long";
                    const pct = (p.pnlUsd / p.marginUsdc) * 100;
                    return (
                      <tr key={p.id} className="hover:bg-robin/5">
                        <td className="px-5 py-4">
                          <span
                            className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                              dirUp ? "bg-long/15 text-long" : "bg-short/15 text-short"
                            }`}
                          >
                            {dirUp ? "LONG" : "SHORT"} {p.leverage}×
                          </span>
                          <div className="mt-1 text-xs text-zinc-600">#{p.id}</div>
                        </td>
                        <td className="num px-5 py-4 text-zinc-300">
                          ${p.entryPrice}B → ${p.exitPrice}B
                        </td>
                        <td className="num px-5 py-4 text-zinc-300">{fmtUSD(p.marginUsdc)}</td>
                        <td className="px-5 py-4 text-zinc-400">{fmtDate(p.settledAt)}</td>
                        <td className={`num px-5 py-4 text-right font-semibold ${p.pnlUsd >= 0 ? "text-long" : "text-short"}`}>
                          {p.pnlUsd >= 0 ? "+" : ""}
                          {fmtUSD(p.pnlUsd)}
                          <div className="text-xs font-normal opacity-70">{fmtPct(pct, 1)}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
