// Tiny HTTP server (no deps) for Railway health checks and a public /status
// the frontend can read for real treasury numbers.

import http from "node:http";
import { ethers } from "ethers";
import { config } from "./config.js";
import { log } from "./log.js";
import { distributor, chain, gasBalanceEth } from "./chain.js";
import { state } from "./keeper.js";

function json(res, code, body) {
  const data = JSON.stringify(body, null, 2);
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*", // let the Vercel frontend read it
    "Cache-Control": "public, max-age=15",
  });
  res.end(data);
}

async function buildStatus() {
  const [
    canDist,
    last,
    interval,
    epochCount,
    totalDistributed,
    totalShares,
    robxTax,
    usdgBal,
    gas,
    rewardCount,
  ] = await Promise.all([
    distributor.canDistribute().catch(() => false),
    distributor.lastDistribution().catch(() => 0n),
    distributor.epochInterval().catch(() => 1800n),
    distributor.epochCount().catch(() => 0n),
    distributor.totalDistributedUsdc().catch(() => 0n),
    distributor.totalShares().catch(() => 0n),
    chain.robx ? chain.robx.balanceOf(config.distributor).catch(() => 0n) : 0n,
    chain.usdg ? chain.usdg.balanceOf(config.distributor).catch(() => 0n) : 0n,
    gasBalanceEth().catch(() => 0),
    distributor.allowedRewardTokensLength().catch(() => 0n),
  ]);

  const lastN = Number(last);
  const intervalN = Number(interval);
  const nextAt = lastN + intervalN;
  const secondsUntilNext = Math.max(0, nextAt - Math.floor(Date.now() / 1000));
  const dec = chain.usdgDecimals;

  return {
    ok: true,
    keeper: {
      address: state.keeper,
      gasBalanceEth: gas,
      bootedAt: state.bootedAt,
      distributionsSent: state.distributionsSent,
      syncsSent: state.syncsSent,
      lastDistributionTx: state.lastDistributionTx,
      lastError: state.lastError,
    },
    treasury: {
      distributor: config.distributor,
      pendingTaxRobx: ethers.formatUnits(robxTax, 18),
      usdgBalance: ethers.formatUnits(usdgBal, dec),
      totalDistributed: ethers.formatUnits(totalDistributed, dec),
      totalShares: ethers.formatUnits(totalShares, 18),
      rewardTokenCount: Number(rewardCount),
    },
    epoch: {
      count: Number(epochCount),
      intervalSeconds: intervalN,
      lastDistribution: lastN,
      nextDistributionAt: nextAt,
      secondsUntilNext,
      canDistributeNow: canDist,
    },
    chainId: state.chainId,
    updatedAt: new Date().toISOString(),
  };
}

export function startServer() {
  const server = http.createServer(async (req, res) => {
    const url = (req.url || "/").split("?")[0];

    if (req.method === "OPTIONS") {
      res.writeHead(204, { "Access-Control-Allow-Origin": "*" });
      return res.end();
    }

    if (url === "/health" || url === "/") {
      return json(res, 200, { ok: true, service: "robinx-keeper" });
    }

    if (url === "/status") {
      try {
        return json(res, 200, await buildStatus());
      } catch (e) {
        return json(res, 500, { ok: false, error: e.message });
      }
    }

    return json(res, 404, { ok: false, error: "not found" });
  });

  server.listen(config.port, () => {
    log.info(`http server on :${config.port} (/health, /status)`);
  });
  return server;
}
