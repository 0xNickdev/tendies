"use client";

import { KEEPER_URL } from "./config";
import { PAYOUT_STOCKS, type StockSym } from "./stocks";

// Talks to the keeper service: what a wallet is owed, and which xStock it has
// chosen to be paid in. The choice is authenticated by a wallet signature —
// no transaction, no fee, and nobody can set a choice for someone else.

export type Account = {
  owner: string;
  choice: string | null; // xStock ticker, e.g. "NVDAx"
  accrued: number; // in fee-token units (USDC)
  minPayoutUsd: number;
};

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
