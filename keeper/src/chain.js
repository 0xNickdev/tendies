// Chain wiring for Robinhood Chain: provider, treasury signer, ERC-20 helpers,
// the Pons fee collect, and the holder snapshot.
//
// The distribution model needs no custom contract — Pons mints a plain
// ERC-20, the treasury simply reads who holds it and sends stocks out
// pro-rata. Holders come from a Transfer-event scan kept up to date in a
// cache file: there is no holder index on the RPC, and Blockscout's API sits
// behind Cloudflare.

import fs from "node:fs";
import path from "node:path";
import { ethers } from "ethers";
import { config } from "./config.js";
import { log } from "./log.js";

export const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 value) returns (bool)",
  "function transfer(address to, uint256 value) returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];

const LOCKER_ABI = [
  "function collectFees(address token)",
  "function feeRedirects(address token) view returns (address)",
  "function getLaunchedToken(address token) view returns (tuple(address token,address deployer,address pairedToken,address positionManager,uint256 positionId,uint256 dexId,uint256 launchConfigId,uint256 reserved,uint256 supply,bool isToken0,uint24 poolFee,bool exists,uint256 initialBuyAmount))",
  "error NoFeesToCollect()",
  "error NotAuthorized()",
  "error TokenNotFound()",
  "event FeesClaimed(address indexed token,address caller,address token0,address token1,uint256 recipientAmount0,uint256 recipientAmount1,uint256 protocolAmount0,uint256 protocolAmount1)",
];

const V3_FACTORY_ABI = [
  "function getPool(address a, address b, uint24 fee) view returns (address)",
];

// The Robinhood RPC answers 403 to some default user agents; say who we are.
const request = new ethers.FetchRequest(config.rpcUrl);
request.setHeader("User-Agent", "RobinXKeeper/1.0 (+https://robinx.tech)");
export const provider = new ethers.JsonRpcProvider(request, undefined, {
  staticNetwork: true,
  batchMaxCount: 1,
});

export const treasury = config.treasuryKey
  ? new ethers.Wallet(config.treasuryKey, provider)
  : null;

export const erc20 = (address, signer = provider) =>
  new ethers.Contract(address, ERC20_ABI, signer);

export const token = config.token ? erc20(config.token) : null;

const locker = config.locker
  ? new ethers.Contract(config.locker, LOCKER_ABI, treasury ?? provider)
  : null;

const decimalsCache = new Map();
export async function decimalsOf(address) {
  const key = address.toLowerCase();
  if (decimalsCache.has(key)) return decimalsCache.get(key);
  const d = Number(await erc20(address).decimals());
  decimalsCache.set(key, d);
  return d;
}

// Raw integer units — the ledger never touches floats.
export async function treasuryBalance(tokenAddress) {
  if (!treasury || !tokenAddress) return 0n;
  try {
    return await erc20(tokenAddress).balanceOf(treasury.address);
  } catch {
    return 0n;
  }
}

export async function ethBalance() {
  if (!treasury) return 0;
  const wei = await provider.getBalance(treasury.address);
  return Number(ethers.formatEther(wei));
}

export async function gasPriceWei() {
  const fee = await provider.getFeeData();
  return fee.maxFeePerGas ?? fee.gasPrice ?? 0n;
}

// ── Pons fee collect ──────────────────────────────────────────────────────
// The locker only pays fees out when someone calls collectFees(token); the
// deployer, the payout wallet and Pons' own automation may. Calling it
// ourselves before every epoch means the fee is in the treasury when the
// accrual step looks, not whenever Pons gets round to it. NoFeesToCollect
// is the normal outcome on a quiet half hour, not an error.
export async function collectPonsFees() {
  if (!locker || !treasury || !config.token) return null;
  try {
    await locker.collectFees.staticCall(config.token);
  } catch (e) {
    const why = e.revert?.name || e.shortMessage || e.message || "";
    if (/NoFeesToCollect/.test(why)) {
      log.info("  pons: no fees to collect yet");
      return null;
    }
    if (/NotAuthorized/.test(why)) {
      log.warn(
        `  pons: ${treasury.address} may not collect fees for ${config.token} — ` +
          "it must be the deployer or the payout wallet (setFeeRedirect)",
      );
      return null;
    }
    log.warn(`  pons: collect check failed (${why}) — skipping this epoch`);
    return null;
  }
  const tx = await locker.collectFees(config.token);
  const rcpt = await tx.wait();
  let claimed = null;
  for (const l of rcpt.logs) {
    try {
      const parsed = locker.interface.parseLog(l);
      if (parsed?.name === "FeesClaimed") {
        claimed = {
          token0: parsed.args.token0,
          token1: parsed.args.token1,
          amount0: parsed.args.recipientAmount0,
          amount1: parsed.args.recipientAmount1,
        };
      }
    } catch {
      /* not ours */
    }
  }
  log.info(
    `  pons: collected ${tx.hash}` +
      (claimed ? ` · ${claimed.amount0} of ${short(claimed.token0)} + ${claimed.amount1} of ${short(claimed.token1)}` : ""),
  );
  return { hash: tx.hash, ...claimed };
}

// ── holder snapshot ───────────────────────────────────────────────────────
//
// Balances are rebuilt from Transfer events and persisted with the block the
// scan reached, so each epoch only reads what happened since. The cache is a
// separate file from the ledger: throwing it away costs one full rescan and
// nothing else.

const CACHE = path.join(config.stateDir, "holders-cache.json");
const TRANSFER_TOPIC = ethers.id("Transfer(address,address,uint256)");
// The RPC caps a getLogs answer at 10 000 logs regardless of block range, so
// the scan asks for everything and halves the range when told it is too much.
const TOO_MANY = /exceeds limit|too many|query returned more|response size|timed out/i;

// A wallet this large is almost certainly a pool or a CEX, not a person.
const SUSPICIOUS_SHARE = 0.15;

let cache = null; // { token, block, balances: { addr: string }, contracts: { addr: bool } }

function loadCache() {
  if (cache) return cache;
  try {
    const parsed = JSON.parse(fs.readFileSync(CACHE, "utf8"));
    if (parsed.token?.toLowerCase() === config.token.toLowerCase()) {
      cache = parsed;
      log.info(`holder cache · ${Object.keys(cache.balances).length} accounts · block ${cache.block}`);
      return cache;
    }
    log.warn("holder cache is for another token — rescanning");
  } catch {
    /* no cache yet */
  }
  cache = { token: config.token, block: null, balances: {}, contracts: {} };
  return cache;
}

function saveCache() {
  fs.mkdirSync(config.stateDir, { recursive: true });
  const tmp = `${CACHE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(cache));
  fs.renameSync(tmp, CACHE);
}

const rpcMessage = (e) => e.error?.message || e.shortMessage || e.message || "";

// The block the token's first Transfer (the mint) landed in, without asking
// anyone. The RPC is not an archive node, so getCode at an old block is not
// available — but the log index is: bisect on whether [0, mid] holds any
// Transfer of this token. "Too many logs" is a yes.
export async function findDeployBlock(address, latest) {
  let lo = 0;
  let hi = latest;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    let any;
    try {
      const logs = await provider.getLogs({
        address,
        topics: [TRANSFER_TOPIC],
        fromBlock: lo,
        toBlock: mid,
      });
      any = logs.length > 0;
    } catch (e) {
      if (!TOO_MANY.test(rpcMessage(e))) throw e;
      any = true;
    }
    if (any) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

// Bring the balance map up to the latest block. Balances are tracked as raw
// units in strings; a holder whose balance returns to zero is dropped.
//
// The window is adaptive: ask for everything left, halve when the node says
// the answer is too big or too slow, grow back after a success. The cursor is
// saved after every chunk, so a long first scan survives a restart.
const applyTransfers = (bal, logs) => {
  const iface = new ethers.Interface(ERC20_ABI);
  const add = (addr, delta) => {
    const key = addr.toLowerCase();
    const next = BigInt(bal[key] ?? "0") + delta;
    if (next <= 0n) delete bal[key];
    else bal[key] = next.toString();
  };
  for (const l of logs) {
    const { args } = iface.parseLog(l);
    if (args.from !== ethers.ZeroAddress) add(args.from, -args.value);
    if (args.to !== ethers.ZeroAddress) add(args.to, args.value);
  }
};

// One scan at a time: /status and the epoch loop both want holders, and two
// loops advancing the same cursor would double-apply transfers.
let syncing = null;
function syncBalances() {
  if (!syncing) {
    syncing = syncBalancesNow().finally(() => {
      syncing = null;
    });
  }
  return syncing;
}

async function syncBalancesNow() {
  const c = loadCache();
  const latest = await provider.getBlockNumber();
  if (c.block == null) {
    c.block = config.tokenStartBlock > 0
      ? config.tokenStartBlock - 1
      : (await findDeployBlock(config.token, latest)) - 1;
    log.info(`holder scan starts at block ${c.block + 1}`);
  }
  if (latest <= c.block) return c;

  let step = latest - c.block;
  let seen = 0;
  while (c.block < latest) {
    const from = c.block + 1;
    const to = Math.min(latest, from + step - 1);
    let logs;
    try {
      logs = await provider.getLogs({
        address: config.token,
        topics: [TRANSFER_TOPIC],
        fromBlock: from,
        toBlock: to,
      });
    } catch (e) {
      if (!TOO_MANY.test(rpcMessage(e)) || step < 2) throw e;
      step = Math.floor(step / 2);
      continue;
    }
    applyTransfers(c.balances, logs);
    c.block = to;
    seen += logs.length;
    saveCache();
    if (to < latest) log.info(`  holder scan: block ${to} · ${seen} transfers so far`);
    step = Math.min(step * 2, latest - c.block || 1);
  }
  if (seen) log.info(`  holder scan: ${seen} transfers → block ${latest}`);
  return c;
}

// Contracts never earn: the pool, the locker, the position manager, a CEX
// hot wallet that is a contract — paying one would send rewards nowhere. The
// answer is kept in the cache file per address, because a wallet does not
// become a contract later (EIP-7702 aside) and asking twice is pure cost.
async function isContract(address) {
  const c = loadCache();
  c.contracts ??= {};
  if (address in c.contracts) return c.contracts[address];
  const code = await provider.getCode(address);
  const yes = Boolean(code && code !== "0x");
  c.contracts[address] = yes;
  return yes;
}

// Classify every unknown address, a few at a time, then save once.
async function classifyUnknown(addresses) {
  const c = loadCache();
  c.contracts ??= {};
  const todo = addresses.filter((a) => !(a in c.contracts));
  if (!todo.length) return;
  const WIDTH = 32;
  for (let i = 0; i < todo.length; i += WIDTH) {
    await Promise.all(todo.slice(i, i + WIDTH).map((a) => isContract(a)));
  }
  saveCache();
  log.info(`  classified ${todo.length} new accounts (${todo.filter((a) => c.contracts[a]).length} contracts)`);
}

let poolAddress = null;
export async function poolFor() {
  if (poolAddress !== null || !config.token) return poolAddress;
  try {
    let fee = 10_000; // Pons pools are 1%
    if (locker) {
      const launched = await locker.getLaunchedToken(config.token);
      if (launched.exists) fee = Number(launched.poolFee);
    }
    const factory = new ethers.Contract(config.v3Factory, V3_FACTORY_ABI, provider);
    const pool = await factory.getPool(config.token, config.weth, fee);
    poolAddress = pool && pool !== ethers.ZeroAddress ? pool.toLowerCase() : "";
  } catch {
    poolAddress = "";
  }
  return poolAddress;
}

export async function snapshotHolders() {
  if (!config.token) return [];
  const c = await syncBalances();

  const excluded = new Set(config.exclude);
  // The treasury holds the ROBX side of the creator fee as the buyback
  // reserve. Left in the snapshot it would pay itself a share of every epoch,
  // so it is excluded whether or not the operator remembered to list it.
  if (treasury) excluded.add(treasury.address.toLowerCase());
  const pool = await poolFor();
  if (pool) excluded.add(pool);

  // A copy: a scan for a later request may move balances while this
  // snapshot is still being classified.
  const balances = { ...c.balances };
  const candidates = Object.keys(balances).filter((a) => !excluded.has(a));
  await classifyUnknown(candidates);
  const holders = [];
  let contracts = 0;
  for (const owner of candidates) {
    if (c.contracts[owner]) {
      contracts++;
      continue;
    }
    holders.push({ owner: ethers.getAddress(owner), balanceRaw: BigInt(balances[owner]) });
  }
  if (contracts) log.info(`  skipped ${contracts} contract accounts (pool, router, vaults)`);

  const supplyHeld = holders.reduce((sum, h) => sum + h.balanceRaw, 0n);
  const withShare = holders.map((h) => ({
    owner: h.owner,
    balance: Number(ethers.formatUnits(h.balanceRaw, 18)),
    // share as a float 0..1, scaled through BigInt so 1e18-unit balances
    // do not lose precision on the way
    share: supplyHeld > 0n ? Number((h.balanceRaw * 1_000_000_000n) / supplyHeld) / 1e9 : 0,
  }));

  for (const h of withShare) {
    if (h.share > SUSPICIOUS_SHARE) {
      log.warn(
        `${h.owner} holds ${(h.share * 100).toFixed(1)}% and is NOT excluded — ` +
          `if that is an exchange or a vault, add it to EXCLUDE_ACCOUNTS before paying`,
      );
    }
  }
  return withShare;
}

const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "?");

export function logIdentity() {
  log.info(`rpc         ${rpcHost()}`);
  log.info(`token       ${config.token || "— not launched yet"}`);
  log.info(`treasury    ${treasury?.address ?? "— no signer"}`);
  log.info(`locker      ${config.locker || "— collect off"}`);
  log.info(
    `payouts     ${config.payoutTokens.map((p) => p.symbol).join(" · ") || "— none configured"}`,
  );
}

// The RPC endpoint without credentials: a URL may carry a paid API key that
// must never leave the server, but the host itself is useful in /status.
export function rpcHost() {
  try {
    return new URL(config.rpcUrl).host;
  } catch {
    return "invalid-rpc-url";
  }
}
