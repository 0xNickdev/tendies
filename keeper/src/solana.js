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

// SPL token accounts are a fixed 165-byte layout with the mint at offset 0 and
// the owner at 32 — so one getProgramAccounts call enumerates every holder.
const ACCOUNT_SIZE = 165;
const OWNER_OFFSET = 32;

export async function snapshotHolders() {
  if (!config.mint) return [];
  const mint = new PublicKey(config.mint);
  const excluded = new Set(config.exclude);

  const perProgram = await Promise.all(
    [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID].map((programId) =>
      connection
        .getParsedProgramAccounts(programId, {
          filters: [
            { dataSize: ACCOUNT_SIZE },
            { memcmp: { offset: 0, bytes: mint.toBase58() } },
          ],
        })
        .catch(() => []),
    ),
  );

  const byOwner = new Map();
  for (const account of perProgram.flat()) {
    const info = account.account?.data?.parsed?.info;
    const owner = info?.owner;
    const amount = Number(info?.tokenAmount?.uiAmount ?? 0);
    if (!owner || amount <= 0) continue;
    if (excluded.has(owner)) continue;
    // one owner can hold the mint in several accounts
    byOwner.set(owner, (byOwner.get(owner) ?? 0) + amount);
  }

  const holders = [...byOwner.entries()].map(([owner, balance]) => ({
    owner,
    balance,
  }));
  const supplyHeld = holders.reduce((sum, h) => sum + h.balance, 0);
  return holders.map((h) => ({
    ...h,
    share: supplyHeld > 0 ? h.balance / supplyHeld : 0,
  }));
}

export async function solBalance() {
  if (!treasury) return 0;
  const lamports = await connection.getBalance(treasury.publicKey);
  return lamports / LAMPORTS_PER_SOL;
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
