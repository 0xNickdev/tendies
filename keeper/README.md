# Tendies Keeper (Railway server)

The server-side of Tendies on **Solana**. One always-on Node service that:

1. **Snapshots holders** — enumerates every TENDIE token account straight from
   the cluster (`getProgramAccounts` on the mint), sums per owner, and drops
   the excluded accounts (launchpad curve/pool, treasury, LPs, CEX wallets).
2. **Accrues** — credits the fee that arrived since the last epoch to every
   holder by share, into a durable ledger. Everyone accrues, however small.
3. **Falls back rather than skipping** - if Jupiter has no route after
   `SWAP_ATTEMPTS` tries (tolerance widening each time), that group is paid in
   the fee token they can already use instead of losing the epoch. Thin
   weekend liquidity shouldn't cost a holder their payout.
4. **Pays whoever cleared the floor** — swaps through Jupiter into the xStock
   each holder chose, then sends batched `transferChecked` transfers, creating
   recipient token accounts idempotently. Balances under `MIN_PAYOUT_USD` keep
   accruing instead: opening a token account costs the treasury ~0.002 SOL of
   rent, which would dwarf a few-cent payout.
5. **Records** — every confirmed batch settles those owners in the ledger
   immediately and is written to the epoch journal, so a crash mid-epoch can
   neither double-pay nor lose what is owed.
6. **Serves health/status/choices** — HTTP endpoints for Railway monitoring,
   for the frontend to read real treasury numbers, and for holders to set
   their payout stock with a wallet signature.

No custom on-chain program is involved: TENDIE is minted by the **stonkfun**
launchpad, and distribution is plain SPL transfers signed by the treasury
keypair. That key can move treasury funds and nothing else — it is not a mint
authority, and it cannot touch holder wallets.

If the keeper goes down, distributions pause until it restarts; nothing is
lost, the fee just keeps accruing in the treasury.

## Layout

```
keeper/
  index.js          # entry: boots server + epoch loop
  src/
    config.js       # env parsing, dry-run detection
    store.js        # durable state: accrual ledger, choices, epoch journal
    choice.js       # signature-verified payout choices
    solana.js       # connection, treasury signer, holder snapshot
    swap.js         # Jupiter quote + swap of the accrued fee
    payout.js       # epoch plan → batched SPL transfers
    keeper.js       # the 30-minute epoch loop
    server.js       # /health + /status HTTP
    log.js
  railway.json      # Railway build/deploy + healthcheck
```

## Env vars

| Var | Required | Default | Notes |
| --- | --- | --- | --- |
| `TENDIE_MINT` | ✅ | — | SPL mint from the stonkfun launch |
| `TREASURY_SECRET_KEY` | ✅ | — | base58 secret key of the treasury wallet (signs swaps + payouts) |
| `PAYOUT_MINTS` | ✅ | — | `TSLAx:<mint>,NVDAx:<mint>,SPCXx:<mint>` — xStock mints, pasted from the official list |
| `SOLANA_RPC` | — | public mainnet RPC | use Helius/QuickNode/Triton in production; the public endpoint is rate-limited |
| `FEE_MINT` | — | USDC | what the fee accrues in before the swap |
| `EXCLUDE_ACCOUNTS` | — | — | comma-separated pubkeys that must never earn (curve/pool/treasury/LP/CEX) |
| `STATE_DIR` | — | `./data` | **mount a Railway Volume here** — see below |
| `MIN_PAYOUT_USD` | — | `1` | balances under this keep accruing instead of being sent |
| `ALLOW_ORIGIN` | — | `*` | set to the site origin so only it can POST choices |
| `SLIPPAGE_BPS` | — | `100` | Jupiter slippage tolerance on the first try |
| `SWAP_ATTEMPTS` | — | `3` | route attempts before paying that group in the fee token |
| `CHOICE_TTL_MS` | — | `600000` | how long a signed choice message stays valid |
| `EPOCH_MINUTES` | — | `30` | accrual cadence |
| `CHECK_INTERVAL_MS` | — | `60000` | how often the loop checks whether an epoch is due |
| `TRANSFERS_PER_TX` | — | `8` | transfers batched per transaction |
| `MIN_SOL_WARN` | — | `0.05` | warn when treasury SOL runs low (fees + ATA rent) |
| `PORT` | — | `3333` | Railway sets this automatically |

**Until `TENDIE_MINT`, `TREASURY_SECRET_KEY` and `PAYOUT_MINTS` are all set the
keeper boots in DRY-RUN**: it snapshots and computes the full epoch plan, logs
what it *would* send, and sends nothing. Deploy it before launch and watch the
plan build up.

## ⚠️ State must survive redeploys

The accrual ledger, the payout choices and the epoch journal live in
`STATE_DIR/keeper-state.json`. Railway containers have an **ephemeral
filesystem** — without a mounted Volume, every redeploy wipes the ledger and
holders lose whatever they had accrued but not yet been paid.

In the Railway service: **Settings → Volumes → add a volume**, mount it at
`/data`, and set `STATE_DIR=/data`.

The file is written atomically (temp + rename), and the keeper refuses to boot
on a corrupt ledger rather than paying out wrong numbers.

## Endpoints

| Method | Path | What |
| --- | --- | --- |
| GET | `/health` | Railway healthcheck |
| GET | `/status` | treasury, holders, ledger totals, next epoch |
| GET | `/account?owner=<pubkey>` | one wallet: accrued balance + payout choice |
| POST | `/choice` | set payout stock — `{owner, symbol, ts, signature}` |

The choice signature is ed25519 over the exact string:

```
Tendies payout choice
stock: NVDAx
ts: 1789041600000
```

Verified against the owner's public key, rejected if older than `CHOICE_TTL_MS`
or if `ts` is not newer than the stored one. Signing is free — it is a message,
not a transaction.

## Tests

```bash
npm test    # accrual maths, the dollar floor, crash-safety, signature checks
```

## Run

```bash
cd keeper
npm install
npm start            # dry-run until the env vars above are set
curl localhost:3333/status
```

## Before going live

- Fund the treasury wallet with SOL (~0.1) — it pays transaction fees and the
  rent for holder ATAs it has to create.
- Verify every mint you paste (TENDIE, the xStocks, `FEE_MINT`) on solscan.io.
  These are funds-bearing addresses; a typo sends real money to a stranger.
- Fill `EXCLUDE_ACCOUNTS` with the stonkfun curve/pool accounts before the
  first epoch, or the pool earns rewards alongside real holders.
- Dry-run one full epoch against mainnet with the real mint and no
  `TREASURY_SECRET_KEY` first, and read the plan in the logs.
