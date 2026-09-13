// End-to-end over HTTP against a running keeper, the exact path the site
// takes: wallet signs the message from lib/keeper.ts, keeper verifies and
// answers. Seeds the trader's accrued balance through the state file first.
//
//   node test/e2e-perps.mjs seed        # writes the trader's balance + key
//   STATE_DIR=./data-e2e PORT=3344 FEE_MINT=<USDC> PERPS_DRYRUN_RESERVE_USD=200 \
//     PAYOUT_MINTS=... node index.js &
//   node test/e2e-perps.mjs             # trades through the HTTP API
import fs from "node:fs";
import { Keypair } from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";

const API = process.env.API || "http://localhost:3344";
const stateDir = process.env.STATE_DIR || "./data-e2e";
const stateFile = `${stateDir}/keeper-state.json`;
const keyFile = `${stateDir}/trader.json`;

if (process.argv[2] === "seed") {
  const fresh = Keypair.generate();
  fs.mkdirSync(stateDir, { recursive: true });
  const state = fs.existsSync(stateFile)
    ? JSON.parse(fs.readFileSync(stateFile, "utf8"))
    : { version: 1, ledger: {}, profiles: {}, choices: {}, positions: {}, positionHistory: [], marks: {}, markHistory: [], epochs: [], totals: { paidOutRaw: "0", epochsRun: 0 }, lastEpochAt: null };
  state.ledger[fresh.publicKey.toBase58()] = { accrued: String(50n * 10n ** 6n), updatedAt: Date.now() };
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
  fs.writeFileSync(keyFile, JSON.stringify([...fresh.secretKey]));
  console.log(`seeded $50 for ${fresh.publicKey.toBase58()} - now start the keeper with STATE_DIR=${stateDir}`);
  process.exit(0);
}

const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(keyFile, "utf8"))));
const owner = kp.publicKey.toBase58();
const sign = (msg) => bs58.encode(nacl.sign.detached(new TextEncoder().encode(msg), kp.secretKey));

// byte-for-byte copies of lib/keeper.ts
const openMessage = (p) =>
  `Tendies perp open\nmarket: ${p.market}\nside: ${p.side}\n` +
  `leverage: ${p.leverage}\nmargin: ${p.marginUsd.toFixed(2)}\nts: ${p.ts}`;
const closeMessage = (id, ts) => `Tendies perp close\nposition: ${id}\nts: ${ts}`;

const get = async (path) => (await fetch(`${API}${path}`)).json();
const post = async (path, body) =>
  (await fetch(`${API}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();

let failed = 0;
const check = (name, ok, extra = "") => {
  console.log(`  ${ok ? "✓" : "✗"} ${name}${ok ? "" : `  ${extra}`}`);
  if (!ok) failed++;
};

const info = await get("/perps");
check("/perps answers", info.ok);
check("markets listed", (info.markets ?? []).length >= 1, JSON.stringify(info.markets));
const market = info.markets[0];
check(`${market} has a live mark`, Boolean(info.marks?.[market]?.price), JSON.stringify(info.marks));
const mark = info.marks[market].price;

const acct = await get(`/account?owner=${owner}`);
check("accrued $50 visible", Math.abs((acct.accruedUsd ?? 0) - 50) < 0.01, `accruedUsd=${acct.accruedUsd}`);

let ts = Date.now();
let p = { market, side: "long", leverage: 3, marginUsd: 10, ts };
let r = await post("/perps/open", { owner, ...p, signature: sign(openMessage(p)) });
check("open long ×3 $10", r.ok, r.error);
check("entry = mark", r.position?.entry === mark, `${r.position?.entry} vs ${mark}`);
check("size $30", r.position?.sizeUsd === 30);
const id = r.position?.id;

const after = await get(`/account?owner=${owner}`);
check("accrued dropped to $40", Math.abs((after.accruedUsd ?? 0) - 40) < 0.01, `accruedUsd=${after.accruedUsd}`);

const list = await get(`/perps/positions?owner=${owner}`);
check("position listed", list.open?.length === 1 && list.open[0].id === id);
check("liq price below entry for a long", (list.open?.[0]?.liqPrice ?? Infinity) < mark);

// wrong signer
const other = Keypair.generate();
ts = Date.now();
r = await post("/perps/close", { owner, id, ts, signature: bs58.encode(nacl.sign.detached(new TextEncoder().encode(closeMessage(id, ts)), other.secretKey)) });
check("stranger cannot close", !r.ok && r.error === "signature does not match owner", r.error);

ts = Date.now();
r = await post("/perps/close", { owner, id, ts, signature: sign(closeMessage(id, ts)) });
check("owner closes", r.ok, r.error);
check("closed at mark, pnl ~0", Math.abs(r.position?.pnlUsd ?? 1) < 0.5, `pnl=${r.position?.pnlUsd}`);

const final = await get(`/account?owner=${owner}`);
check("accrued back to ~$50", Math.abs((final.accruedUsd ?? 0) - 50) < 0.5, `accruedUsd=${final.accruedUsd}`);
const hist = await get(`/perps/positions?owner=${owner}`);
check("history has the trade", hist.history?.length === 1 && hist.history[0].reason === "closed");

console.log(failed ? `\n✗ ${failed} failed` : "\n✓ e2e passed");
process.exit(failed ? 1 : 0);
