"use client";

import { KEEPER_URL, explorerTx } from "./config";
import type { StockSym } from "./stocks";

// Talks to the keeper service: what a wallet is owed, which stock it has
// chosen to be paid in, and the perps book. Every write is authenticated by
// a wallet signature (EIP-191 personal_sign) — no transaction, no gas, and
// nobody can act for a wallet they don't control. Message strings below must
// match keeper/src/choice.js and keeper/src/perps.js byte for byte.

export type Account = {
  owner: string;
  choice: string | null; // stock symbol, e.g. "NVDA"
  accrued: number; // in fee-token units (WETH)
  // The same balance in dollars, converted by the keeper at the live rate.
  // null when the fee token could not be priced this request.
  accruedUsd: number | null;
  minPayoutUsd: number;
  balance: number; // ROBX held at the last epoch snapshot
  shareBps: number; // share of circulating supply, basis points
  snapshotAt: string | null;
  // measured by the keeper, never assigned
  totalPaid: number;
  totalPaidUsd: number | null;
  streak: number;
  epochsHeld: number;
  payouts: Payout[];
};

export type Payout = {
  epoch: number;
  at: string;
  symbol: string;
  value: number; // in fee-token units
  valueUsd: number | null; // the same, in dollars, converted by the keeper
  signature: string; // the transfer's tx hash
};

export const payoutTx = (hash: string) => explorerTx(hash);

// Treasury numbers the site shows. Everything here is measured by the keeper —
// nothing is projected or annualised, because there is no honest basis for it
// until the token has traded for a while.
export type KeeperStatus = {
  dryRun: boolean;
  chainId: number;
  treasury: {
    token: string | null;
    pendingFee: number; // WETH
    pendingFeeUsd: number | null; // the same in dollars, null if unpriced
    buybackReserve: number; // ROBX held back, never distributed
    holders: number;
    payoutStocks: string[];
  };
  ledger: {
    owed: number;
    owedUsd: number | null;
    paidOut: number;
    paidOutUsd: number | null;
    reserveUsd: number | null;
    owedAccounts: number;
    epochsRun: number;
    minPayoutUsd: number;
  };
  epoch: { intervalMinutes: number; secondsUntilNext: number; lastEpochAt: string | null };
};

export async function fetchStatus(): Promise<KeeperStatus | null> {
  if (!KEEPER_URL) return null;
  try {
    const res = await fetch(`${KEEPER_URL}/status`);
    const json = await res.json();
    return json?.ok ? (json as KeeperStatus) : null;
  } catch {
    return null;
  }
}

// Must match choiceMessage() in keeper/src/choice.js, byte for byte.
export function choiceMessage(symbol: string, ts: number) {
  return `RobinX payout choice\nstock: ${symbol}\nts: ${ts}`;
}

export async function fetchAccount(owner: string): Promise<Account | null> {
  if (!KEEPER_URL) return null;
  try {
    const res = await fetch(`${KEEPER_URL}/account?owner=${encodeURIComponent(owner)}`);
    const json = await res.json();
    return json?.ok ? (json as Account) : null;
  } catch {
    return null;
  }
}

// personal_sign over a UTF-8 message; the wallet returns the 65-byte hex
// signature the keeper verifies with ethers.verifyMessage.
export type SignMessage = (message: string) => Promise<string>;

async function signed(signMessage: SignMessage, message: string): Promise<string | null> {
  try {
    return await signMessage(message);
  } catch {
    return null;
  }
}

async function post<T>(path: string, body: unknown): Promise<{ ok: boolean; error?: string; data?: T }> {
  try {
    const res = await fetch(`${KEEPER_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    return json?.ok ? { ok: true, data: json as T } : { ok: false, error: json?.error ?? "Rejected" };
  } catch {
    return { ok: false, error: "Payout service unreachable" };
  }
}

export async function submitChoice(
  owner: string,
  symbol: StockSym,
  signMessage: SignMessage,
): Promise<{ ok: boolean; error?: string }> {
  if (!KEEPER_URL) return { ok: false, error: "Payout service is not configured yet" };
  const ts = Date.now();
  const signature = await signed(signMessage, choiceMessage(symbol, ts));
  if (!signature) return { ok: false, error: "Signature rejected in the wallet" };
  const r = await post("/choice", { owner, symbol, ts, signature });
  return r.ok ? { ok: true } : r;
}

// ── perps ─────────────────────────────────────────────────────────────────
// Positions live in the keeper, margined from the accrued balance. Every
// figure below is computed there against its last mark; the UI only shows.

export type PerpPosition = {
  id: string;
  owner: string;
  symbol: string; // market, e.g. "TSLA"
  side: "long" | "short";
  leverage: number;
  marginUsd: number;
  sizeUsd: number;
  entry: number;
  mark: number;
  markAt: string | null;
  pnlUsd: number;
  equityUsd: number;
  fundingPaidUsd: number;
  liqPrice: number;
  openedAt: string;
  nextFundingAt: string;
};

export type ClosedPerp = {
  id: string;
  symbol: string;
  side: "long" | "short";
  leverage: number;
  marginUsd: number;
  sizeUsd: number;
  entry: number;
  exit: number;
  reason: "closed" | "liquidated";
  pnlUsd: number;
  fundingPaidUsd: number;
  returnedUsd: number;
  openedAt: string;
  closedAt: string;
};

export type PerpMark = {
  symbol: string;
  price: number;
  at: string;
  source: "nasdaq" | "dex" | string;
  signature: string | null;
};

export type PerpsInfo = {
  enabled: boolean;
  openPositions: number;
  openInterestUsd: number;
  // the house bankroll and what it allows right now; null while unpriced
  reserveUsd: number | null;
  maxPositionUsd: number | null;
  maxOpenInterestUsd: number | null;
  maxLeverage: number;
  minMarginUsd: number;
  fundingRateBps: number;
  fundingIntervalHours: number;
  liquidationPct: number;
  maxPositionPct: number;
  maxOpenInterestPct: number;
  markets: string[];
  marks: Record<string, PerpMark>;
};

export async function fetchPerps(): Promise<PerpsInfo | null> {
  if (!KEEPER_URL) return null;
  try {
    const res = await fetch(`${KEEPER_URL}/perps`);
    const json = await res.json();
    return json?.ok ? (json as PerpsInfo) : null;
  } catch {
    return null;
  }
}

export async function fetchPositions(
  owner: string,
): Promise<{ open: PerpPosition[]; history: ClosedPerp[] } | null> {
  if (!KEEPER_URL) return null;
  try {
    const res = await fetch(`${KEEPER_URL}/perps/positions?owner=${encodeURIComponent(owner)}`);
    const json = await res.json();
    return json?.ok ? { open: json.open ?? [], history: json.history ?? [] } : null;
  } catch {
    return null;
  }
}

// Must match openMessage() / closeMessage() in keeper/src/perps.js, byte for byte.
export function perpOpenMessage(p: {
  market: string;
  side: "long" | "short";
  leverage: number;
  marginUsd: number;
  ts: number;
}) {
  return (
    `RobinX perp open\nmarket: ${p.market}\nside: ${p.side}\n` +
    `leverage: ${p.leverage}\nmargin: ${p.marginUsd.toFixed(2)}\nts: ${p.ts}`
  );
}

export function perpCloseMessage(id: string, ts: number) {
  return `RobinX perp close\nposition: ${id}\nts: ${ts}`;
}

export async function openPerp(
  owner: string,
  p: { market: string; side: "long" | "short"; leverage: number; marginUsd: number },
  signMessage: SignMessage,
): Promise<{ ok: boolean; error?: string; position?: PerpPosition }> {
  if (!KEEPER_URL) return { ok: false, error: "Perps service is not configured yet" };
  const marginUsd = Math.round(p.marginUsd * 100) / 100;
  const ts = Date.now();
  const signature = await signed(signMessage, perpOpenMessage({ ...p, marginUsd, ts }));
  if (!signature) return { ok: false, error: "Signature rejected in the wallet" };
  const r = await post<{ position: PerpPosition }>("/perps/open", {
    owner, ...p, marginUsd, ts, signature,
  });
  return r.ok ? { ok: true, position: r.data?.position } : r;
}

export async function closePerp(
  owner: string,
  id: string,
  signMessage: SignMessage,
): Promise<{ ok: boolean; error?: string; position?: ClosedPerp }> {
  if (!KEEPER_URL) return { ok: false, error: "Perps service is not configured yet" };
  const ts = Date.now();
  const signature = await signed(signMessage, perpCloseMessage(id, ts));
  if (!signature) return { ok: false, error: "Signature rejected in the wallet" };
  const r = await post<{ position: ClosedPerp }>("/perps/close", { owner, id, ts, signature });
  return r.ok ? { ok: true, position: r.data?.position } : r;
}
