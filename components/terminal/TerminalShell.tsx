"use client";

import { useState } from "react";
import Link from "next/link";
import { Wordmark, LogoMark } from "@/components/Logo";
import { useStore } from "@/lib/store";
import { NETWORK } from "@/lib/mock";
import { shortAddr } from "@/lib/format";
import {
  IconDashboard,
  IconTrade,
  IconTreasury,
  IconPerps,
  IconHistory,
  IconWallet,
  type IconProps,
} from "./icons";
import { Dashboard } from "./views/Dashboard";
import { Trade } from "./views/Trade";
import { Treasury } from "./views/Treasury";
import { Perps } from "./views/Perps";
import { History } from "./views/History";

export type View = "dashboard" | "trade" | "treasury" | "perps" | "history";

const NAV: { view: View; label: string; soon?: boolean; Icon: (p: IconProps) => React.ReactNode }[] = [
  { view: "dashboard", label: "Dashboard", Icon: IconDashboard },
  { view: "trade", label: "Trade", soon: true, Icon: IconTrade },
  { view: "treasury", label: "Treasury", Icon: IconTreasury },
  { view: "perps", label: "Perps", soon: true, Icon: IconPerps },
  { view: "history", label: "History", Icon: IconHistory },
];

export function TerminalShell() {
  const [view, setView] = useState<View>("dashboard");
  const { wallet, walletMissing, connect, disconnect } = useStore();

  return (
    <div className="min-h-[100svh] lg:flex">
      {/* desktop sidebar */}
      <aside className="sticky top-0 hidden h-[100svh] w-60 shrink-0 flex-col border-r border-tendie/10 bg-ink-900/40 px-3 py-5 lg:flex">
        <Link href="/" className="px-3">
          <Wordmark />
        </Link>
        <nav className="mt-8 flex flex-col gap-1">
          {NAV.map(({ view: v, label, soon, Icon }) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`flex items-center gap-3 rounded-md px-3 py-2.5 font-mono text-sm font-bold uppercase tracking-wide transition-all ${
                view === v
                  ? "border border-tendie/50 bg-tendie/10 text-tendie"
                  : "border border-transparent text-mist-300 hover:bg-white/[0.03] hover:text-mist-50"
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
              {soon && (
                <span className="ml-auto rounded border border-tendie/50 bg-tendie/10 px-1.5 py-0.5 font-mono text-[9px] font-black tracking-wider text-tendie">
                  SOON
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="mt-auto space-y-3">
          <div className="rounded-xl border border-tendie/10 bg-ink-900/60 p-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-long opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-long" />
              </span>
              <span className="text-mist-300">{NETWORK.name}</span>
              <span className="ml-auto font-mono text-mist-500">{NETWORK.cluster}</span>
            </div>
          </div>
          <Link href="/" className="block px-3 text-xs text-mist-500 hover:text-tendie">
            ← Back to site
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* topbar */}
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-tendie/10 bg-ink-950/70 px-4 backdrop-blur-xl sm:px-6">
          <Link href="/" className="lg:hidden">
            <LogoMark />
          </Link>
          <div className="hidden lg:block">
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-mist-300">
              // {view}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {walletMissing ? (
              <a
                href="https://phantom.app/download"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg border border-short/60 bg-short/10 px-3 py-2 text-xs font-bold text-short transition-colors hover:bg-short/20"
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-short opacity-70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-short" />
                </span>
                No wallet · Get Phantom
              </a>
            ) : (
              <span className="hidden items-center gap-2 rounded-lg border border-tendie/10 bg-ink-900/60 px-3 py-2 text-xs text-mist-300 sm:flex">
                <span className="h-2 w-2 rounded-full bg-long" />
                {NETWORK.name}
              </span>
            )}
            <WalletButton
              connected={wallet.connected}
              address={wallet.address}
              onConnect={connect}
              onDisconnect={disconnect}
            />
          </div>
        </header>

        {/* view */}
        <main className="flex-1 px-4 pb-28 pt-6 sm:px-6 lg:pb-10">
          <div className="mx-auto max-w-6xl">
            {view === "dashboard" && <Dashboard go={setView} />}
            {view === "trade" && <Trade />}
            {view === "treasury" && <Treasury />}
            {view === "perps" && <Perps />}
            {view === "history" && <History go={setView} />}
          </div>
        </main>
      </div>

      {/* mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-tendie/10 bg-ink-950/90 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-md items-stretch justify-around px-2 py-2">
          {NAV.map(({ view: v, label, soon, Icon }) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`relative flex flex-1 flex-col items-center gap-1 rounded-lg py-1.5 font-mono text-[10px] font-bold uppercase tracking-wide transition-colors ${
                view === v ? "text-tendie" : "text-mist-400"
              }`}
            >
              <Icon className={`h-5 w-5 ${view === v ? "drop-shadow-[0_0_6px_rgba(105, 170, 193,0.6)]" : ""}`} />
              {label}
              {soon && (
                <span className="absolute right-[22%] top-1 h-1.5 w-1.5 animate-pulse rounded-full bg-tendie" />
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

function WalletButton({
  connected,
  address,
  onConnect,
  onDisconnect,
}: {
  connected: boolean;
  address: string;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const [open, setOpen] = useState(false);

  if (!connected) {
    return (
      <button onClick={onConnect} className="btn-tendie !px-4 !py-2">
        <IconWallet className="h-4 w-4" />
        Connect
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-md border border-tendie/40 bg-tendie/5 px-3 py-2 font-mono text-sm font-bold text-tendie"
      >
        <span className="h-2 w-2 rounded-full bg-long" />
        <span className="num">{shortAddr(address)}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-48 rounded-md border border-tendie/30 bg-ink-800 p-1.5" style={{ }}>
            <button
              onClick={() => {
                onDisconnect();
                setOpen(false);
              }}
              className="w-full rounded px-3 py-2 text-left font-mono text-sm font-bold uppercase text-mist-200 hover:bg-short/10 hover:text-short"
            >
              Disconnect
            </button>
          </div>
        </>
      )}
    </div>
  );
}
