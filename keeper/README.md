# RobinX Keeper (Railway server)

The server side of RobinX on Pons. One always-on Node service that, every
30 minutes:

1. **Collects the creator fee** — calls `PonsLaunchLocker.collectFees(ROBX)`;
   the creator's 70% of the 1% pool fee lands in the treasury as WETH (+ ROBX).
2. **Snapshots holders** — rebuilds ROBX balances from `Transfer` events
   (incremental, cached), skipping contracts (the pool, routers, vaults) and
   the treasury itself.
3. **Accrues** — credits the new WETH to every holder pro-rata in a durable
   ledger. Everyone accrues every epoch, however small their stake.
4. **Pays** — only holders whose accrued balance clears the dollar floor
   (`MIN_PAYOUT_USD`, default $1): swaps their share WETH → USDG → stock on
   Uniswap v3 (SwapRouter02) and sends the stock with one ERC-20 transfer
   each. The rest keeps accruing.
5. **Serves HTTP** — health/status for Railway and the site, the signed
   payout-choice endpoint, and the perps engine.

There is **no contract of ours on chain**. ROBX is a fixed-supply ERC-20
minted by Pons; the only privileged key is the treasury (= the Pons payout
wallet), which signs swaps and transfers out of the treasury and nothing else.

## Layout

```
keeper/
  index.js          # entry: state, server, epoch loop, mark loop
  src/
    config.js       # env parsing; DRY-RUN until the launch vars are set
    chain.js        # provider, treasury signer, Pons collect, holder snapshot
    swap.js         # QuoterV2 quotes + SwapRouter02 swaps, $ rate for the floor
    payout.js       # dollar floor, grouping by chosen stock, ERC-20 transfers
    store.js        # durable state: ledger, choices, profiles, positions, epochs
    keeper.js       # the epoch loop: collect → snapshot → accrue → pay
    choice.js       # EIP-191 signed payout choices
    perps.js        # treasury-backed perps (margin = accrued balance)
    oracle.js       # marks: Yahoo quote, v3 pool fallback, signed by treasury
    server.js       # HTTP: /health /status /account /choice /perps/*
  test/
    ledger.test.js  # accrual maths, floor, signatures, crash-safety (offline)
    perps.test.js   # perps engine (offline)
  railway.json
```

## Env vars

| Var | Required | Default | Notes |
| --- | --- | --- | --- |
| `ROBX_TOKEN` | ✅ to go live | — | ROBX address from the Pons launch |
| `TREASURY_PRIVATE_KEY` | ✅ to go live | — | The Pons payout wallet. Fund with ETH on chain 4663 |
| `PAYOUT_TOKENS` | — | TSLA, NVDA, SPCX | `SYMBOL:ADDRESS:USDG_POOL_FEE,…`. A trailing `*` on a symbol means "no ticker, price on the pool" |
| `ROBX_START_BLOCK` | — | auto (bisect) | Block ROBX was deployed in; saves the first scan a few calls |
| `PONS_LOCKER` | — | `0x736D…7F35` | Blank turns the collect step off |
| `EXCLUDE_ACCOUNTS` | — | — | Extra addresses that must never earn (a CEX deposit wallet, say) |
| `STATE_DIR` | — | `./data` | **Mount a Railway Volume here** |
| `ALLOW_ORIGIN` | — | `*` | Comma-separated site origins for CORS |
| `MIN_PAYOUT_USD` | — | `1` | Payout floor, in dollars |
| `EPOCH_MINUTES` | — | `30` | |
| `SLIPPAGE_BPS` | — | `100` | Swap tolerance; widens per retry |
| `PERPS_*` | — | see config.js | `PERPS_ENABLED=false` pauses trading |
| `RPC_URL` | — | Robinhood Chain mainnet | |
| `PORT` | — | Railway-provided | |

Without `ROBX_TOKEN` + `TREASURY_PRIVATE_KEY` the keeper runs in **DRY-RUN**:
it snapshots, accrues and logs what it would pay, but sends nothing.

## ⚠ Railway Volume is mandatory

`STATE_DIR/keeper-state.json` is the accrual ledger — what every holder is
owed but has not been paid yet — plus their payout choices and the epoch
journal. `holders-cache.json` next to it is the Transfer-scan cursor. The
container disk is wiped on every redeploy; without a mounted Volume, holders
lose their unpaid balance on each deploy. The keeper refuses to start on a
corrupt state file rather than pay wrong numbers.

## Pons specifics

- Fees accrue in the locked v3 position and are only paid out on
  `collectFees(token)`. The deployer, the payout wallet (`setFeeRedirect`) and
  Pons' automation may call it. The keeper calls it itself before every
  epoch; `NoFeesToCollect` on a quiet half hour is normal.
- The fee arrives as **WETH + ROBX**. WETH is the fee that gets distributed;
  the ROBX side is kept in the treasury as the buyback reserve and shown in
  `/status` as `buybackReserve`.
- The dollar floor is converted with a live QuoterV2 quote (0.01 WETH → USDG).
  If the quote fails and there was never a rate, nobody is paid that epoch and
  every balance carries — never a wrong floor.
- If a stock has no route after `SWAP_ATTEMPTS`, that group is paid in WETH
  instead of losing the epoch.

## HTTP endpoints

- `GET /health` → `{ ok: true }` — Railway healthcheck.
- `GET /status` → treasury (pending WETH and its $ value, buyback reserve,
  holders), ledger (owed, paid out, house reserve, epochs), epoch timing,
  perps summary and marks.
- `GET /account?owner=0x…` → what one wallet is owed, its choice, its share
  at the last snapshot, streak, payout history.
- `POST /choice` `{ owner, symbol, ts, signature }` — signature is
  `personal_sign` of `RobinX payout choice\nstock: <SYMBOL>\nts: <ms>`.
- `GET /perps`, `GET /perps/marks?symbol=`, `GET /perps/positions?owner=`,
  `POST /perps/open`, `POST /perps/close` — see perps.js for the messages.

## Run locally

```bash
cd keeper
npm install
npm test               # offline: ledger + perps
npm start              # DRY-RUN until the launch vars are set
```

## Deploy on Railway

1. **New Project → Deploy from GitHub repo** → pick this repo.
2. Settings → **Root Directory** = `keeper`.
3. **Volumes → add** one mounted at `/data`, and set `STATE_DIR=/data`.
4. Variables → `ROBX_TOKEN`, `TREASURY_PRIVATE_KEY`, `ALLOW_ORIGIN`
   (+ optional overrides).
5. Railway reads `railway.json`: builds with Nixpacks, runs `npm start`,
   health-checks `/health`, restarts on failure.
6. Fund the treasury with ETH on Robinhood Chain (~0.02 ETH covers hundreds
   of payouts).

Keep it a **Service** (always-on), not a Cron — it serves `/status` and the
perps endpoints and runs the mark loop between epochs.

## Wiring the frontend

Set `NEXT_PUBLIC_KEEPER_URL=https://<service>.up.railway.app` on Vercel; the
Treasury tab reads `/status` and `/account`, and `FEATURES.perpsLive` turns
on with it.
