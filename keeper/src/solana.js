// Solana wiring: connection, treasury signer, and the holder snapshot.
// The distribution model needs no custom program — the treasury simply reads
// who holds TENDIE and sends xStocks out pro-rata.

import {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import bs58 from "bs58";
import { config } from "./config.js";
import { log } from "./log.js";

export const connection = new Connection(config.rpcUrl, "confirmed");

export const treasury = config.treasurySecret
  ? Keypair.fromSecretKey(bs58.decode(config.treasurySecret))
  : null;

// The mint sits at offset 0 of every token account, so one getProgramAccounts
// call per program enumerates every holder.
//
// Deliberately NOT filtered by dataSize. A classic SPL account is always 165
// bytes, but a Token-2022 account grows with its extensions, and the
// associated-token program stamps ImmutableOwner on every ATA it creates —
// which makes real holders 170 bytes. stonkfun mints on Token-2022 even for a
// standard launch, so a dataSize:165 filter matches only accounts the program
// opened itself: the bonding-curve vault, holding ~99% of supply, and nobody
// else. That is the difference between paying every holder and paying an
// unspendable PDA everything.
const OWNER_OFFSET = 32;

// A wallet this large is almost certainly the pool, not a person.
const SUSPICIOUS_SHARE = 0.15;

export async function snapshotHolders() {
  if (!config.mint) return [];
  const mint = new PublicKey(config.mint);
  const excluded = new Set(config.exclude);

  const perProgram = await Promise.all(
    [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID].map((programId) =>
      connection
        .getParsedProgramAccounts(programId, {
          filters: [{ memcmp: { offset: 0, bytes: mint.toBase58() } }],
        })
        .catch(() => []),
    ),
  );

  const byOwner = new Map();
  for (const account of perProgram.flat()) {
    const parsed = account.account?.data?.parsed;
    // Without a dataSize filter the mint account itself can come back; only
    // token accounts have an owner and a balance.
    if (parsed?.type !== "account") continue;
    const info = parsed.info;
    const owner = info?.owner;
    const amount = Number(info?.tokenAmount?.uiAmount ?? 0);
    if (!owner || amount <= 0) continue;
    // Excluding by owner alone is a trap: the pool's owner is a PDA, while the
    // address a human copies off Solscan is usually the token account. Accept
    // either, so a correct-looking entry cannot silently do nothing.
    if (excluded.has(owner) || excluded.has(account.pubkey.toBase58())) continue;
    // one owner can hold the mint in several accounts
    byOwner.set(owner, (byOwner.get(owner) ?? 0) + amount);
  }

  const holders = [...byOwner.entries()].map(([owner, balance]) => ({
    owner,
    balance,
  }));
  const supplyHeld = holders.reduce((sum, h) => sum + h.balance, 0);
  const withShare = holders.map((h) => ({
    ...h,
    share: supplyHeld > 0 ? h.balance / supplyHeld : 0,
  }));

  // The net promised in the README: forgetting EXCLUDE_ACCOUNTS is quiet, and
  // rewards sent to a program are gone while every real holder is diluted by
  // exactly that share.
  for (const h of withShare) {
    if (h.share > SUSPICIOUS_SHARE) {
      log.warn(
        `${h.owner} holds ${(h.share * 100).toFixed(1)}% and is NOT excluded — ` +
          `if that is the launchpad pool, add it to EXCLUDE_ACCOUNTS before paying`,
      );
    }
  }

  return withShare;
}

export async function solBalance() {
  if (!treasury) return 0;
  const lamports = await connection.getBalance(treasury.publicKey);
  return lamports / LAMPORTS_PER_SOL;
}

// xStocks are Token-2022 mints, not classic SPL. The associated-token address
// is derived from the program id, so using the wrong one computes a different
// account and the transfer lands nowhere. Ask the chain which program owns the
// mint instead of assuming.
const programCache = new Map();

export async function tokenProgramFor(mint) {
  const key = mint.toBase58 ? mint.toBase58() : String(mint);
  if (programCache.has(key)) return programCache.get(key);
  const info = await connection.getAccountInfo(new PublicKey(key));
  const owner = info?.owner ?? TOKEN_PROGRAM_ID;
  const program = owner.equals(TOKEN_2022_PROGRAM_ID)
    ? TOKEN_2022_PROGRAM_ID
    : TOKEN_PROGRAM_ID;
  programCache.set(key, program);
  log.info(
    `  ${key.slice(0, 6)}… is ${program.equals(TOKEN_2022_PROGRAM_ID) ? "Token-2022" : "SPL Token"}`,
  );
  return program;
}

export function ownerOffsetNote() {
  // kept as documentation for the filter above
  return OWNER_OFFSET;
}

export function logIdentity() {
  log.info(`rpc         ${config.rpcUrl}`);
  log.info(`mint        ${config.mint || "— not launched yet"}`);
  log.info(`treasury    ${treasury?.publicKey.toBase58() ?? "— no signer"}`);
  log.info(
    `payouts     ${config.payoutMints.map((p) => p.symbol).join(" · ") || "— none configured"}`,
  );
}
