// Tiny HTTP server (no deps): Railway health checks, a public /status the
// frontend reads for real treasury numbers, and the payout-choice endpoints.

import http from "node:http";
import { config } from "./config.js";
import { log } from "./log.js";
import { snapshotHolders, solBalance } from "./solana.js";
import { feeBalance, feeDecimals, buybackReserve, feeUnitsPerDollar } from "./swap.js";
import { state, ledgerSummary, holderInfo } from "./keeper.js";
import { applyChoice } from "./choice.js";
import { accruedOf, choiceOf, profileOf } from "./store.js";

function json(res, code, body) {
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": config.allowOrigin,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body, null, 2));
}

function readBody(req, limit = 4096) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > limit) reject(new Error("body too large"));
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error("invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

async function buildStatus() {
  const [holders, fee, sol, decimals, reserve] = await Promise.all([
    snapshotHolders().catch(() => []),
    feeBalance().catch(() => 0n),
    solBalance().catch(() => 0),
    feeDecimals().catch(() => 6),
    buybackReserve().catch(() => 0n),
  ]);

  const ledger = ledgerSummary();
  const toUnits = (raw) => Number(BigInt(raw)) / 10 ** decimals;

  const lastEpoch = state.lastEpochAt ? new Date(state.lastEpochAt).getTime() : 0;
  const nextAt = lastEpoch + config.epochMinutes * 60_000;

  return {
    ok: true,
    dryRun: config.dryRun,
    keeper: {
      treasury: state.treasury,
      solBalance: sol,
      bootedAt: state.bootedAt,
      lastError: state.lastError,
    },
    treasury: {
      mint: config.mint || null,
      feeMint: config.feeMint,
      pendingFee: toUnits(fee.toString()),
      payoutStocks: config.payoutMints.map((p) => p.symbol),
      holders: holders.length,
      // The TENDIE side of the creator fee. Never distributed — it accumulates
      // as the buyback reserve, in TENDIE's own 6 decimals, not the fee token's.
      buybackReserve: Number(reserve) / 10 ** 6,
    },
    ledger: {
      owedAccounts: ledger.owedAccounts,
      owed: toUnits(ledger.owedRaw),
      paidOut: toUnits(ledger.paidOutRaw),
      minPayoutUsd: config.minPayoutUsd,
      epochsRun: ledger.epochsRun,
      lastEpoch: ledger.lastEpoch,
    },
    epoch: {
      intervalMinutes: config.epochMinutes,
      lastEpochAt: state.lastEpochAt,
      secondsUntilNext: lastEpoch ? Math.max(0, Math.round((nextAt - Date.now()) / 1000)) : 0,
    },
    // Host only — config.rpcUrl carries a paid API key in its query string,
    // and /status is public.
    cluster: rpcHost(),
    updatedAt: new Date().toISOString(),
  };
}

// The RPC endpoint without credentials: the URL holds a paid API key that
// must never leave the server, but the host itself is useful in /status.
function rpcHost() {
  try {
    return new URL(config.rpcUrl).host;
  } catch {
    return "invalid-rpc-url";
  }
}

export function startServer() {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://localhost");
    const path = url.pathname;

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": config.allowOrigin,
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      });
      return res.end();
    }

    if (path === "/health" || path === "/") {
      return json(res, 200, { ok: true, service: "tendies-keeper" });
    }

    if (path === "/status") {
      try {
        return json(res, 200, await buildStatus());
      } catch (e) {
        return json(res, 500, { ok: false, error: e.message });
      }
    }

    // What one wallet is owed and which stock it is set to receive.
    if (path === "/account") {
      const owner = url.searchParams.get("owner") ?? "";
      if (!owner) return json(res, 400, { ok: false, error: "owner required" });
      const decimals = await feeDecimals().catch(() => 6);
      // The ledger counts fee-token units. Once the fee accrues in a stock
      // those are nothing like dollars, and the site labels this field as
      // money — so convert here rather than letting the UI guess.
      const perDollar = await feeUnitsPerDollar().catch(() => null);
      const info = holderInfo(owner);
      const prof = profileOf(owner);
      return json(res, 200, {
        ok: true,
        owner,
        choice: choiceOf(owner),
        accrued: Number(accruedOf(owner)) / 10 ** decimals,
        accruedUsd: perDollar ? Number(accruedOf(owner)) / Number(perDollar) : null,
        minPayoutUsd: config.minPayoutUsd,
        // доля из последнего снимка эпохи, не из живого запроса
        balance: info.balance,
        shareBps: Math.round(info.share * 10_000),
        snapshotAt: info.snapshotAt,
        // measured, never assigned
        totalPaid: Number(BigInt(prof.totalPaid)) / 10 ** decimals,
        streak: prof.streak,
        epochsHeld: prof.firstEpoch ? prof.lastEpoch - prof.firstEpoch + 1 : 0,
        payouts: prof.payouts.map((x) => ({
          epoch: x.epoch,
          at: x.at,
          symbol: x.symbol,
          value: Number(BigInt(x.paidRaw)) / 10 ** decimals,
          signature: x.signature,
        })),
      });
    }

    // Set the payout stock — body carries the wallet's signature.
    if (path === "/choice" && req.method === "POST") {
      try {
        const body = await readBody(req);
        const result = applyChoice(body);
        return json(res, result.ok ? 200 : 400, result);
      } catch (e) {
        return json(res, 400, { ok: false, error: e.message });
      }
    }

    return json(res, 404, { ok: false, error: "not found" });
  });

  server.listen(config.port, () => {
    log.info(`http server on :${config.port} (/health, /status, /account, /choice)`);
  });
  return server;
}
