"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { TREASURY, FEATURES } from "@/lib/mock";
import { BUY_TENDIE_URL } from "@/lib/config";
import { fmtUSD, fmtNum } from "@/lib/format";
import { Segmented, ViewHeader } from "../ui";
import { useToast } from "../Toast";

type Side = "buy" | "sell";

export function Trade() {
  const { wallet, connect, walletUsdc, tendieBalance, buyToken, sellToken } =
    useStore();
  const { push } = useToast();
  const [side, setSide] = useState<Side>("buy");
  const [amount, setAmount] = useState("");
  const [pending, setPending] = useState(false);

  const taxRate = TREASURY.taxRateBps / 10_000;
  const price = TREASURY.tokenPriceUsd;
  const numAmount = parseFloat(amount) || 0;

  const calc = useMemo(() => {
    if (side === "buy") {
      const tax = numAmount * taxRate;
      const net = numAmount - tax;
      const tokens = price > 0 ? net / price : 0;
      return { tax, net, tokens, outLabel: `${TREASURY.tokenSymbol} received` };
    } else {
      const gross = numAmount * price;
      const tax = gross * taxRate;
      const net = gross - tax;
      return { tax, net, tokens: net, outLabel: "USDC received" };
    }
  }, [numAmount, side, taxRate, price]);

  const max = side === "buy" ? walletUsdc : tendieBalance;
  const overBalance = numAmount > max + 1e-9;
  const unit = side === "buy" ? "USDC" : TREASURY.tokenSymbol;

  const submit = () => {
    if (!FEATURES.tradeLive) return; // unlocks with the token launch
    if (!wallet.connected) return connect();
    if (numAmount <= 0 || overBalance) return;
    setPending(true);
    push("Confirm in wallet…", "pending");
    setTimeout(() => {
      if (side === "buy") {
        buyToken(numAmount);
        push(`Bought ${fmtNum(calc.tokens)} ${TREASURY.tokenSymbol}`, "success");
      } else {
        sellToken(numAmount);
        push(`Sold for ${fmtUSD(calc.net)}`, "success");
      }
      setAmount("");
      setPending(false);
    }, 1100);
  };

  return (
    <div className="mx-auto max-w-xl">
      <ViewHeader
        title="Trade"
        subtitle={`Buy or sell ${TREASURY.tokenSymbol}. A ${TREASURY.taxRateBps / 100}% tax routes to the treasury on every trade.`}
        right={
          !FEATURES.tradeLive ? (
            <span className="chip !border-tendie !bg-tendie !text-ink-950">Soon</span>
          ) : undefined
        }
      />

      {!FEATURES.tradeLive && (
        <div className="panel mb-6 flex flex-col items-start justify-between gap-3 border-tendie/30 bg-tendie/5 p-5 sm:flex-row sm:items-center">
          <div>
            <div className="font-bold text-tendie">
              In-app trading unlocks with the TENDIE launch
            </div>
            <div className="mt-1 text-sm text-mist-300">
              Until then, TENDIE trades on its stonkfun launchpad page - the
              button below takes you there.
            </div>
          </div>
          <a
            href={BUY_TENDIE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="chip shrink-0 hover:bg-tendie/15"
          >
            Buy on stonkfun →
          </a>
        </div>
      )}

      <div className="panel relative overflow-hidden p-6">
        {!FEATURES.tradeLive && (
          <span className="absolute right-[-38px] top-[22px] rotate-45 bg-tendie px-12 py-1 text-center font-mono text-xs font-black uppercase tracking-widest text-ink-950">
            Soon
          </span>
        )}
        <Segmented<Side>
          value={side}
          onChange={(v) => {
            setSide(v);
            setAmount("");
          }}
          options={[
            { label: "Buy", value: "buy" },
            { label: "Sell", value: "sell" },
          ]}
        />

        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <span className="label">You pay</span>
            <button
              onClick={() => setAmount(String(max))}
              className="text-xs text-tendie hover:underline"
            >
              Balance: {fmtNum(max)} {unit} · Max
            </button>
          </div>
          <div
            className={`flex items-center gap-3 rounded-xl border bg-ink-900/60 px-4 py-3 transition-colors ${
              overBalance ? "border-short/50" : "border-tendie/10 focus-within:border-tendie/40"
            }`}
          >
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) =>
                setAmount(e.target.value.replace(/[^0-9.]/g, ""))
              }
              placeholder="0.00"
              className="num w-full bg-transparent text-2xl font-semibold text-white outline-none placeholder:text-mist-500"
            />
            <span className="shrink-0 rounded-lg bg-tendie/10 px-3 py-1.5 text-sm font-semibold text-tendie">
              {unit}
            </span>
          </div>
          {overBalance && (
            <p className="mt-2 text-xs text-short">Insufficient balance.</p>
          )}
        </div>

        <div className="my-5 flex items-center justify-center">
          <div className="grid h-9 w-9 place-items-center rounded-full border border-tendie/15 bg-ink-900 text-tendie">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M6 13l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        <div>
          <span className="label">You receive (est.)</span>
          <div className="mt-2 flex items-center justify-between rounded-xl border border-tendie/10 bg-ink-900/40 px-4 py-3">
            <span className="num text-2xl font-semibold text-tendie">
              {fmtNum(calc.tokens)}
            </span>
            <span className="shrink-0 rounded-lg bg-white/5 px-3 py-1.5 text-sm font-semibold text-mist-200">
              {side === "buy" ? TREASURY.tokenSymbol : "USDC"}
            </span>
          </div>
        </div>

        <div className="mt-5 space-y-2.5 rounded-xl border border-tendie/10 bg-ink-900/40 p-4 text-sm">
          <Row label={`Treasury tax (${TREASURY.taxRateBps / 100}%)`} value={fmtUSD(calc.tax)} accent />
          <Row label={`${TREASURY.tokenSymbol} price`} value={price > 0 ? fmtUSD(price) : "TBA at launch"} />
          <Row label="Network" value="Solana" />
          <Row label="Est. network fee" value="~$0.004" />
        </div>

        <button
          onClick={submit}
          disabled={
            !FEATURES.tradeLive ||
            pending ||
            (wallet.connected && (numAmount <= 0 || overBalance))
          }
          className={`mt-5 w-full py-4 text-base ${
            !FEATURES.tradeLive
              ? "rounded-md border border-dashed border-tendie/50 bg-tendie/10 font-mono text-sm font-bold uppercase tracking-wide text-tendie"
              : "btn-tendie"
          }`}
        >
          {!FEATURES.tradeLive
            ? "Coming Soon - Token Launch"
            : !wallet.connected
              ? "Connect Wallet"
              : pending
                ? "Confirming…"
                : side === "buy"
                  ? `Buy ${TREASURY.tokenSymbol}`
                  : `Sell ${TREASURY.tokenSymbol}`}
        </button>

        <p className="mt-3 text-center text-xs text-mist-400">
          The {TREASURY.taxRateBps / 100}% tax is split between treasury growth
          and holder claims.
        </p>
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
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-mist-300">{label}</span>
      <span className={`num font-medium ${accent ? "text-tendie" : "text-mist-50"}`}>
        {value}
      </span>
    </div>
  );
}
