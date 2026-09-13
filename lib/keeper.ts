"use client";

import { KEEPER_URL } from "./config";
import { PAYOUT_STOCKS, type StockSym } from "./stocks";

// Talks to the keeper service: what a wallet is owed, and which xStock it has
// chosen to be paid in. The choice is authenticated by a wallet signature —
// no transaction, no fee, and nobody can set a choice for someone else.

export type Account = {
  owner: string;
  choice: string | null; // xStock ticker, e.g. "NVDAx"
  accrued: number; // in fee-token units — OPENAI once paired against it
  // The same balance in dollars, converted by the keeper at the live rate.
  // null when the fee token could not be priced this request.
  accruedUsd: number | null;
  minPayoutUsd: number;
  balance: number; // TENDIE held at the last epoch snapshot
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
  symbol: string; // xStock ticker
  value: number; // in fee-token units — OPENAI once paired against it
  valueUsd: number | null; // the same, in dollars, converted by the keeper
  signature: string;
};

export const solscanTx = (signature: string) =>
  `https://solscan.io/tx/${signature}`;

// Treasury numbers the site shows. Everything here is measured by the keeper —
// nothing is projected or annualised, because there is no honest basis for it
// until the token has traded for a while.
export type KeeperStatus = {
  dryRun: boolean;
  treasury: {
    pendingFee: number; // fee-token units
    pendingFeeUsd: number | null; // the same in dollars, null if unpriced
    buybackReserve: number; // TENDIE held back for buybacks
    holders: number;
    payoutStocks: string[];
  };
  ledger: {
    owed: number;
    owedUsd: number | null;
    paidOut: number;
    paidOutUsd: number | null;
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
export function choiceMessage(token: string, ts: number) {
  return `Tendies payout choice\nstock: ${token}\nts: ${ts}`;
}

export const tokenFor = (symbol: StockSym) =>
  PAYOUT_STOCKS.find((s) => s.symbol === symbol)?.token ?? "";

export const symbolForToken = (token: string | null): StockSym | null =>
  PAYOUT_STOCKS.find((s) => s.token === token)?.symbol ?? null;

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

// Wallets hand back raw signature bytes; the keeper expects base58. Small
// enough to inline rather than pull in a dependency for one call.
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export function toBase58(bytes: Uint8Array): string {
  let digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i] << 8;
      digits[i] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let out = "";
  for (const b of bytes) {
    if (b === 0) out += B58[0];
    else break;
  }
  for (let i = digits.length - 1; i >= 0; i--) out += B58[digits[i]];
  return out;
}

type SignMessage = (message: Uint8Array, encoding?: string) => Promise<{ signature: Uint8Array }>;

export async function submitChoice(
  owner: string,
  symbol: StockSym,
  signMessage: SignMessage,
): Promise<{ ok: boolean; error?: string }> {
  if (!KEEPER_URL) return { ok: false, error: "Payout service is not configured yet" };

  const token = tokenFor(symbol);
  const ts = Date.now();
  const encoded = new TextEncoder().encode(choiceMessage(token, ts));

  let signature: string;
  try {
    const signed = await signMessage(encoded, "utf8");
    signature = toBase58(signed.signature);
  } catch {
    return { ok: false, error: "Signature rejected in the wallet" };
  }

  try {
    const res = await fetch(`${KEEPER_URL}/choice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner, symbol: token, ts, signature }),
    });
    const json = await res.json();
    return json?.ok ? { ok: true } : { ok: false, error: json?.error ?? "Rejected" };
  } catch {
    return { ok: false, error: "Payout service unreachable" };
  }
}

// ── perps ─────────────────────────────────────────────────────────────────
// Positions live in the keeper, margined from the accrued balance. Every
// figure below is computed there against its last mark; the UI only shows.

export type PerpPosition = {
  id: string;
  owner: string;
  symbol: string; // market, e.g. "OPENAI"
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
    `Tendies perp open\nmarket: ${p.market}\nside: ${p.side}\n` +
    `leverage: ${p.leverage}\nmargin: ${p.marginUsd.toFixed(2)}\nts: ${p.ts}`
  );
}

export function perpCloseMessage(id: string, ts: number) {
  return `Tendies perp close\nposition: ${id}\nts: ${ts}`;
}

async function signed(
  signMessage: SignMessage,
  message: string,
): Promise<string | null> {
  try {
    const { signature } = await signMessage(new TextEncoder().encode(message), "utf8");
    return toBase58(signature);
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
    return { ok: false, error: "Perps service unreachable" };
  }
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
