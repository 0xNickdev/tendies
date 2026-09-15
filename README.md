# RobinX

Synthetic **tokenized-stock exposure** (TSLA · NVDA · SPCX) on **Robinhood
Chain** — a mobile-first DeFi app. Hold the ROBX token, get treasury rewards
paid in **real tokenized stocks** of your choice every **30 minutes**, and
speculate on the next oracle mark with on-chain perps.

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
  wallet balances and treasury flows are still simulated

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
| `/terminal`  | The app — Dashboard / Trade / Treasury / Perps / History              |

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
  mock.ts               # HOOD price marks, treasury, positions
  store.tsx             # client-side state (wallet, balances, perps actions)
  format.ts             # currency / number / % formatting
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
  Vercel (zero config). Rewards logic (30-min stock distributions) is mocked
  client-side until the chain contracts land.

## Notes

- **Oracle marks, not ticks.** HOOD trades in real time on Nasdaq, but the
  on-chain token settles against official oracle prints (closing prices at
  earnings, index events, and month-ends), so every price surface shows a
  clear "last updated" timestamp instead of a live ticker.
- **Risk gating.** Opening a perps position requires acknowledging a mandatory
  risk disclosure modal.
- **Wiring real chain logic.** Replace `lib/store.tsx` mock actions and
  `lib/mock.ts` data with wagmi/viem reads + contract writes; the UI is built
  to swap data sources without layout changes.
