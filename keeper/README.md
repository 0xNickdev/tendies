# RobinX Keeper (Railway server)

The server-side of RobinX. One always-on Node service that:

1. **Distributes rewards** — calls `RewardDistributor.distribute()` every 30
   minutes (swaps the collected ROBX tax into USDG and credits holders).
2. **Heals share desyncs** — watches ROBX transfers and calls `syncShare()` on
   any account whose ledger share drifts from its true balance (AUDIT M-1).
3. **Serves health/status** — HTTP endpoints for Railway monitoring and for the
   frontend to read real treasury numbers.

It holds **no privileges** — the keeper wallet only pays gas to call public
functions. If it goes down, distributions pause until it restarts (or anyone
calls `distribute()`); nothing is ever lost.

## Layout

```
keeper/
  index.js          # entry: boots chain, server, loops
  src/
    config.js       # env parsing + validation
    chain.js        # provider, wallet, contracts (reads ROBX/USDG from distributor)
    keeper.js       # distribute loop + syncShare sweep
    server.js       # /health + /status HTTP
    log.js
  railway.json      # Railway build/deploy + healthcheck
  .env.example
```

## Env vars

| Var | Required | Default | Notes |
| --- | --- | --- | --- |
| `DISTRIBUTOR` | ✅ | — | RewardDistributor address (ROBX & USDG are read from it) |
| `KEEPER_PRIVATE_KEY` | ✅ | — | Keeper wallet key — fund with ~0.01 ETH |
| `RPC_URL` | — | Robinhood Chain mainnet | |
| `CHECK_INTERVAL_MS` | — | `60000` | distribute poll cadence |
| `SWEEP_INTERVAL_MS` | — | `300000` | syncShare sweep cadence |
| `MIN_GAS_WARN` | — | `0.002` | warn when keeper gas dips below this |
| `PORT` | — | Railway-provided | HTTP port |

## HTTP endpoints

- `GET /health` → `{ ok: true }` — Railway healthcheck.
- `GET /status` → live JSON: keeper gas, treasury USDG balance, pending tax,
  total distributed, epoch count, `secondsUntilNext`, `canDistributeNow`,
  chainId. CORS-open so the Vercel frontend can fetch it for the real
  "next payout" countdown and treasury stats.

## Run locally

```bash
cd keeper
npm install
cp .env.example .env   # fill DISTRIBUTOR + KEEPER_PRIVATE_KEY
npm start
```

## Deploy on Railway

1. **New Project → Deploy from GitHub repo** → pick this repo.
2. Settings → **Root Directory** = `keeper`.
3. Variables → add `DISTRIBUTOR`, `KEEPER_PRIVATE_KEY` (+ optional overrides).
4. Railway reads `railway.json`: builds with Nixpacks, runs `npm start`,
   health-checks `/health`, restarts on failure.
5. Fund the keeper wallet with ~0.01 ETH on Robinhood Chain.

Keep it a **Service** (always-on), not a Cron — it needs the live event
subscription for the syncShare sweep and to serve `/status`.

## Wiring the frontend to /status (optional)

Once deployed, point the app at the keeper URL to show real treasury data:
set `NEXT_PUBLIC_KEEPER_URL=https://<your-service>.up.railway.app` in Vercel
and the Treasury tab can read live `secondsUntilNext`, `usdgBalance`, and
`totalDistributed` instead of placeholders.
