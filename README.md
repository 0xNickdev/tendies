# Tendies

Tokenized-stock exposure (TSLA · NVDA · SPCX) on **Solana** — a mobile-first
DeFi app. $TENDIE launches on the **stonkfun** launchpad; hold it and the
treasury pays you **real xStocks** of your choice every **30 minutes**, then
speculate on the next oracle mark with on-chain perps.

> Synthetic exposure only. No equity, no shareholder rights. Not affiliated
> with Tesla, NVIDIA, SpaceX, Backed Finance or stonkfun.

**KOL / marketing one-pager: [PITCH.md](PITCH.md)**

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS** — palette lifted from stonkfun: steel-blue (`#69AAC1`)
  accent on cold teal-black (`#071013`), cool blue-grey type (`mist` scale),
  brand gradient `#ABC4CE → #78A9BF → #5C8394` at 215° (`bg-brand`)
- Brand art generated in Flow (Nano Banana), alpha-keyed to WebP in `public/`:
  `logo-mark`, `wordmark`, `hero-tenders` — prompts in [BRAND_PROMPTS.md](BRAND_PROMPTS.md)
- Hero backdrop — `components/landing/HeroArt.tsx` splits the one hero plate
  into two parallax planes (soft/behind, sharp/front); the inline SVG stays as
  the fallback if `HERO_LAYERS` is emptied
- In-SVG candlestick chart, no chart dependency — real Nasdaq OHLC from
  `/api/candles`, wheel to zoom, drag to pan, seeded preview as the fallback
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
| `/`          | Landing — Hero, Markets listing, About, Mission, Mechanics, Roadmap, Stats, FAQ |
| `/terminal`  | The app — Dashboard / Trade / Treasury / Perps / History              |

The hero's **Enter Terminal** button (and the header CTA) route to `/terminal`.

## Structure

```
app/
  api/rpc/route.ts      # backend — Solana RPC proxy, keeps the paid key server-side
  api/prices/route.ts   # backend — live quotes (Yahoo q1 → q2 → CNBC → seed)
  api/candles/route.ts  # backend — real OHLC history (Yahoo q1 → q2), 4H folded from 1h
  page.tsx              # landing composition
  icon.png              # favicon — the tender mark
  terminal/             # terminal route (StoreProvider + ToastProvider)
components/
  landing/              # Header, Hero, HeroArt, Markets, Sections, Roadmap
  terminal/             # TerminalShell, Toast, views/*  (Dashboard, Trade, …)
  AreaChart.tsx, Logo.tsx
lib/
  stocks.ts             # payout stocks, market listing, 30-min distribution
  useQuotes.ts          # client hook polling /api/prices
  useCandles.ts         # client hook polling /api/candles
  mock.ts               # HOOD price marks, treasury, positions
  store.tsx             # client-side state (wallet, balances, perps actions)
  format.ts             # currency / number / % formatting
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
  client-side until the keeper is wired to the live mint.

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
