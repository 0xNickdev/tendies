// Payout-choice registry.
//
// A holder picks their reward stock in the app; the app asks their wallet to
// SIGN a short message (no transaction, no fee) and posts it here. We verify
// the ed25519 signature against the owner's public key, so nobody can set a
// choice for a wallet they don't control.

import nacl from "tweetnacl";
import bs58 from "bs58";
import { config } from "./config.js";
import { choiceTs, setChoice } from "./store.js";

// Exactly what the wallet is asked to sign, rebuilt server-side.
export function choiceMessage(symbol, ts) {
  return `Tendies payout choice\nstock: ${symbol}\nts: ${ts}`;
}

export function applyChoice({ owner, symbol, ts, signature }) {
  if (!owner || !symbol || !ts || !signature) {
    return { ok: false, error: "owner, symbol, ts and signature are required" };
  }

  const known = config.payoutMints.some((p) => p.symbol === symbol);
  if (!known) {
    return { ok: false, error: `unknown payout stock: ${symbol}` };
  }

  const age = Date.now() - Number(ts);
  if (!isFinite(age) || age > config.choiceTtlMs || age < -60_000) {
    return { ok: false, error: "signature expired — sign again" };
  }

  // a replayed older message must never overwrite a newer choice
  if (Number(ts) <= choiceTs(owner)) {
    return { ok: false, error: "stale choice" };
  }

  let valid = false;
  try {
    valid = nacl.sign.detached.verify(
      new TextEncoder().encode(choiceMessage(symbol, ts)),
      bs58.decode(signature),
      bs58.decode(owner),
    );
  } catch {
    return { ok: false, error: "malformed signature or owner" };
  }
  if (!valid) return { ok: false, error: "signature does not match owner" };

  setChoice(owner, symbol, Number(ts));
  return { ok: true, owner, symbol };
}
