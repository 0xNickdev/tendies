// Tiny HTTP server (no deps): Railway health checks, a public /status the
// frontend reads for real treasury numbers, and the payout-choice endpoints.

import http from "node:http";
import { config } from "./config.js";
import { log } from "./log.js";
import { ethBalance, rpcHost, escrowPending } from "./chain.js";
import { feeBalance, feeDecimals, buybackReserve, feeUnitsPerDollar } from "./swap.js";
import { state, ledgerSummary, holderInfo } from "./keeper.js";
import { applyChoice, canonicalOwner } from "./choice.js";
import { accruedOf, choiceOf, profileOf, allMarks, markHistoryOf, positionHistoryOf } from "./store.js";
import { openPosition, closePosition, positionsOf, view, summary as perpsSummary } from "./perps.js";
import { markets } from "./oracle.js";

// The origin to echo for this request: "*" if anything goes, the request's
// own origin if it is on the list, else the first listed one - which the
// browser will then refuse, which is the point.
function corsOrigin(req) {
  const list = config.allowOrigins;
  if (list.includes("*")) return "*";
  const origin = (req.headers.origin || "").replace(/\/+$/, "");
  return list.includes(origin) ? origin : list[0];
}

function json(res, code, body, req) {
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": corsOrigin(req),
    Vary: "Origin",
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
  // Holders come from the last epoch snapshot: a fresh one means a log scan
  // and a getCode per new account, far too much for a polled endpoint.
  const holders = holderInfo("").holders;
  const [fee, eth, decimals, reserve, perDollar, pendingClaim] = await Promise.all([
    feeBalance().catch(() => 0n),
    ethBalance().catch(() => 0),
    feeDecimals().catch(() => 6),
    buybackReserve().catch(() => 0n),
    feeUnitsPerDollar().catch(() => null),
    escrowPending().catch(() => 0n),
  ]);

  const ledger = ledgerSummary();
  const toUnits = (raw) => Number(BigInt(raw)) / 10 ** decimals;
  // Every figure below is counted in fee-token units (WETH). The site renders
  // these as money — so publish the dollar value rather than leave the UI to
  // multiply by a rate it does not have.
  const toUsd = (raw) => (perDollar ? Number(BigInt(raw)) / Number(perDollar) : null);

  const lastEpoch = state.lastEpochAt ? new Date(state.lastEpochAt).getTime() : 0;
  const nextAt = lastEpoch + config.epochMinutes * 60_000;

  return {
    ok: true,
    dryRun: config.dryRun,
    chainId: config.chainId,
    keeper: {
      treasury: state.treasury,
      ethBalance: eth,
      bootedAt: state.bootedAt,
      lastError: state.lastError,
    },
    treasury: {
      token: config.token || null,
      feeToken: config.feeToken,
      pendingFee: toUnits(fee.toString()),
      pendingFeeUsd: toUsd(fee.toString()),
      // Creator fee Pons is holding for the treasury but that has not been
      // claimed yet - real money owed, just not countable as fee until the
      // next epoch pulls it in.
      unclaimedFee: Number(pendingClaim) / 1e18,
      payoutStocks: config.payoutTokens.map((p) => p.symbol),
      holders,
      // The ROBX side of the creator fee. Never distributed — it accumulates
      // as the buyback reserve, in ROBX's own 18 decimals, not the fee token's.
      buybackReserve: Number(reserve) / 1e18,
    },
    ledger: {
      owedAccounts: ledger.owedAccounts,
      owed: toUnits(ledger.owedRaw),
      owedUsd: toUsd(ledger.owedRaw),
      paidOut: toUnits(ledger.paidOutRaw),
      paidOutUsd: toUsd(ledger.paidOutRaw),
      // the perps house bankroll - held back, never owed to anyone
      reserve: toUnits(ledger.reserveRaw),
      reserveUsd: toUsd(ledger.reserveRaw),
      minPayoutUsd: config.minPayoutUsd,
      epochsRun: ledger.epochsRun,
      lastEpoch: ledger.lastEpoch,
    },
    epoch: {
      intervalMinutes: config.epochMinutes,
      lastEpochAt: state.lastEpochAt,
      secondsUntilNext: lastEpoch ? Math.max(0, Math.round((nextAt - Date.now()) / 1000)) : 0,
    },
    perps: { ...(await perpsSummary()), marks: allMarks() },
    // Host only — an RPC URL may carry a paid API key in its query string,
    // and /status is public.
    rpc: rpcHost(),
    updatedAt: new Date().toISOString(),
  };
}

export function startServer() {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://localhost");
    const path = url.pathname;

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": corsOrigin(req),
        Vary: "Origin",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      });
      return res.end();
    }

    if (path === "/health" || path === "/") {
      return json(res, 200, { ok: true, service: "robinx-keeper" }, req);
    }

    if (path === "/status") {
      try {
        return json(res, 200, await buildStatus(), req);
      } catch (e) {
        return json(res, 500, { ok: false, error: e.message }, req);
      }
    }

    // What one wallet is owed and which stock it is set to receive.
    if (path === "/account") {
      const owner = canonicalOwner(url.searchParams.get("owner") ?? "");
      if (!owner) return json(res, 400, { ok: false, error: "owner (an address) required" }, req);
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
        totalPaidUsd: perDollar ? Number(BigInt(prof.totalPaid)) / Number(perDollar) : null,
        streak: prof.streak,
        epochsHeld: prof.firstEpoch ? prof.lastEpoch - prof.firstEpoch + 1 : 0,
        payouts: prof.payouts.map((x) => ({
          epoch: x.epoch,
          at: x.at,
          symbol: x.symbol,
          value: Number(BigInt(x.paidRaw)) / 10 ** decimals,
          valueUsd: perDollar ? Number(BigInt(x.paidRaw)) / Number(perDollar) : null,
          signature: x.signature,
        })),
      }, req);
    }

    // Set the payout stock — body carries the wallet's signature.
    if (path === "/choice" && req.method === "POST") {
      try {
        const body = await readBody(req);
        const result = applyChoice(body);
        return json(res, result.ok ? 200 : 400, result, req);
      } catch (e) {
        return json(res, 400, { ok: false, error: e.message }, req);
      }
    }

    // ── perps ────────────────────────────────────────────────────────────
    if (path === "/perps") {
      return json(res, 200, {
        ok: true,
        ...(await perpsSummary()),
        markets: markets().map((m) => m.market),
        marks: allMarks(),
      }, req);
    }

    if (path === "/perps/marks") {
      const symbol = url.searchParams.get("symbol") ?? "";
      const limit = Math.min(2000, Number(url.searchParams.get("limit") || 288));
      if (!symbol) return json(res, 400, { ok: false, error: "symbol required" }, req);
      return json(res, 200, { ok: true, symbol, marks: markHistoryOf(symbol, limit) }, req);
    }

    if (path === "/perps/positions") {
      const owner = canonicalOwner(url.searchParams.get("owner") ?? "");
      if (!owner) return json(res, 400, { ok: false, error: "owner (an address) required" }, req);
      return json(res, 200, {
        ok: true,
        owner,
        open: positionsOf(owner).map(view),
        history: positionHistoryOf(owner),
      }, req);
    }

    if (path === "/perps/open" && req.method === "POST") {
      try {
        const result = await openPosition(await readBody(req));
        return json(res, result.ok ? 200 : 400, result, req);
      } catch (e) {
        return json(res, 400, { ok: false, error: e.message }, req);
      }
    }

    if (path === "/perps/close" && req.method === "POST") {
      try {
        const result = await closePosition(await readBody(req));
        return json(res, result.ok ? 200 : 400, result, req);
      } catch (e) {
        return json(res, 400, { ok: false, error: e.message }, req);
      }
    }

    return json(res, 404, { ok: false, error: "not found" }, req);
  });

  server.listen(config.port, () => {
    log.info(`http server on :${config.port} (/health, /status, /account, /choice, /perps/*)`);
  });
  return server;
}
