# RobinX

Synthetic **tokenized-stock exposure** (TSLA · NVDA · SPCX) on **Robinhood
Chain** — a mobile-first DeFi app. Hold the ROBX token, get treasury rewards
paid in **real tokenized stocks** of your choice every **30 minutes**, and
speculate on the next oracle mark with treasury-backed perps.

ROBX launches on **[Pons](https://www.ponsfamily.com/launchpad)**: a plain
fixed-supply ERC-20 in a Uniswap v3 pool whose 1% swap fee is split 70/30 with
the creator. That 70% — 0.7% of volume — is the treasury. **No contract of
ours runs on chain**; the treasury is the `keeper/` service, which collects
the fee, accrues it to holders and pays them out.

> Synthetic exposure only. No equity, no shareholder rights. Not affiliated
> with Robinhood Markets, Inc.

**KOL / marketing one-pager: [PITCH.md](PITCH.md)**

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS** — neon-lime (`#D9FF4D`) accent on warm near-black, matching
  the hooded-archer logo (`public/logo.jpg`)
- Static hero backdrop — hooded-archer art (`public/hero-archer.png`)
- Lightweight in-SVG charts (no chart dependency) — area + candlestick
- **Real Nasdaq quotes** served by the built-in backend (`/api/prices`);
  wallet balances read from the chain, treasury numbers from the keeper
- **`keeper/`** — Node service (ethers, no framework): the treasury itself.
  See [keeper/README.md](keeper/README.md)

## Run

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
```

## Routes

| Route        | What it is                                                            |
| ------------ | --------------------------------------------------------------------- |
| `/`          | Landing — UnicornStudio hero, About, Mission, Mechanics, Stats, FAQ   |
| `/terminal`  | The app — Dashboard / Treasury / Perps / History                      |
| `/docs`      | Full protocol documentation                                           |

The hero's **Enter Terminal** button (and the header CTA) route to `/terminal`.

## Structure

```
app/
  api/prices/route.ts   # backend — live quotes (Yahoo → Stooq → seed fallback)
  page.tsx              # landing composition
  icon.png              # favicon generated from the logo image
  terminal/             # terminal route (StoreProvider + ToastProvider)
components/
  landing/              # Header, Hero, Sections
  terminal/             # TerminalShell, Toast, views/*  (Dashboard, Trade, …)
  AreaChart.tsx, Logo.tsx
lib/
  stocks.ts             # payout stocks, ticker basket, 30-min distribution
  useQuotes.ts          # client hook polling /api/prices
  keeper.ts             # keeper API client (/status /account /choice /perps)
  useKeeperStatus.ts    # polls the keeper for live treasury numbers
  mock.ts               # feature flags + protocol constants
  store.tsx             # wallet (EIP-1193) + keeper-backed account state
  format.ts             # currency / number / % formatting
keeper/                 # the treasury service — see keeper/README.md
public/
  logo.jpg              # hooded-archer brand image (header mark + favicon)
  hero-archer.png       # hero backdrop art
```

## Launch pack

Frontend and backend ship together — the Next.js app *is* the full stack:

- **Backend**: `app/api/prices/route.ts` serves live quotes for
  TSLA/NVDA/SPCX/NVDA/AAPL/GME/PLTR/COIN. Primary source Yahoo Finance,
  fallback Stooq, final fallback seed prices (flagged `live:false`).
  No API keys or env vars required. Responses cache for 30s.
- **Frontend**: landing ticker, perps market tabs, candle chart and treasury
  payout pricing all poll `/api/prices` every 60s via `lib/useQuotes.ts`.
- **Deploy**: `npm run build && npm start` on any Node host, or push to
  Vercel (zero config). Set `NEXT_PUBLIC_KEEPER_URL` to the deployed keeper —
  that one variable turns on live treasury numbers and perps.
- **Keeper**: deploy `keeper/` on Railway with a mounted Volume. Step by step
  in [LAUNCH_GUIDE.md](LAUNCH_GUIDE.md).

## Notes

- **Oracle marks, not ticks.** HOOD trades in real time on Nasdaq, but the
  on-chain token settles against official oracle prints (closing prices at
  earnings, index events, and month-ends), so every price surface shows a
  clear "last updated" timestamp instead of a live ticker.
- **Risk gating.** Opening a perps position requires acknowledging a mandatory
  risk disclosure modal.
- **Signatures, not transactions.** Picking a payout stock and opening or
  closing a perp cost a wallet signature (EIP-191 `personal_sign`), never gas.
  The keeper recovers the signer with `ethers.verifyMessage`.
- **Nothing to claim.** Payouts are pushed by the keeper once a holder's
  accrued balance passes `MIN_PAYOUT_USD` ($1 by default); below that it keeps
  accruing so gas never costs more than the payout.
- **`contracts/` is unused on Pons.** The ROBX tax token and RewardDistributor
  were built for a self-deployed launch; Pons mints the token itself, so they
  are kept for reference only.
