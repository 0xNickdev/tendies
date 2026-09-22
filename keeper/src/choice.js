// Payout-choice registry.
//
// A holder picks their reward stock in the app; the app asks their wallet to
// SIGN a short message (EIP-191 personal_sign — no transaction, no fee) and
// posts it here. We recover the signer and compare it to the owner, so nobody
// can set a choice for a wallet they don't control.

import { ethers } from "ethers";
import { config } from "./config.js";
import { choiceTs, setChoice } from "./store.js";

// Exactly what the wallet is asked to sign, rebuilt server-side.
export function choiceMessage(symbol, ts) {
  return `RobinX payout choice\nstock: ${symbol}\nts: ${ts}`;
}

// Checksummed address, or null when it is not an address at all. Every place
// the keeper keys by owner goes through this so a lowercase address from a
// URL and a checksummed one from a wallet land on the same ledger entry.
export function canonicalOwner(owner) {
  try {
    return ethers.getAddress(String(owner));
  } catch {
    return null;
  }
}

export function verifySigned(message, owner, signature) {
  try {
    return ethers.verifyMessage(message, signature).toLowerCase() === owner.toLowerCase();
  } catch {
    return false;
  }
}

export function applyChoice({ owner, symbol, ts, signature }) {
  if (!owner || !symbol || !ts || !signature) {
    return { ok: false, error: "owner, symbol, ts and signature are required" };
  }
  const account = canonicalOwner(owner);
  if (!account) return { ok: false, error: "owner is not an address" };

  const known = config.payoutTokens.some((p) => p.symbol === symbol);
  if (!known) {
    return { ok: false, error: `unknown payout stock: ${symbol}` };
  }

  const age = Date.now() - Number(ts);
  if (!isFinite(age) || age > config.choiceTtlMs || age < -60_000) {
    return { ok: false, error: "signature expired — sign again" };
  }

  // a replayed older message must never overwrite a newer choice
  if (Number(ts) <= choiceTs(account)) {
    return { ok: false, error: "stale choice" };
  }

  if (!verifySigned(choiceMessage(symbol, ts), account, signature)) {
    return { ok: false, error: "signature does not match owner" };
  }

  setChoice(account, symbol, Number(ts));
  return { ok: true, owner: account, symbol };
}
