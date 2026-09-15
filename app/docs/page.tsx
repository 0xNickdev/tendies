import Link from "next/link";
import type { Metadata } from "next";
import { Wordmark } from "@/components/Logo";

export const metadata: Metadata = {
  title: "RobinX Docs — How it works",
  description:
    "Full documentation for RobinX: the ROBX token, the 4% treasury tax, 30-minute tokenized-stock rewards (TSLA · NVDA · SPCX), perps, the smart contracts, and security.",
};

const TSLA = "0x322F0929c4625eD5bAd873c95208D54E1c003b2d";
const NVDA = "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC";
const SPCX = "0x4a0E65A3EcceC6dBe60AE065F2e7bb85Fae35eEa";

const NAV = [
  ["overview", "Overview"],
  ["how", "How it works"],
  ["tokenomics", "Tokenomics"],
  ["rewards", "Rewards & distribution"],
  ["stocks", "The stocks"],
  ["perps", "Perps"],
  ["network", "Network"],
  ["contracts", "Contracts & security"],
  ["faq", "FAQ"],
] as const;

function Section({
  id,
  n,
  title,
  children,
}: {
  id: string;
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t-2 border-robin/15 pt-10">
      <div className="chip mb-4">
        // {n} · {title}
      </div>
      <div className="space-y-4 text-pretty leading-relaxed text-zinc-300">
        {children}
      </div>
    </section>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-robin/10 py-3 text-sm">
      <span className="font-mono uppercase tracking-wide text-zinc-400">{k}</span>
      <span className="text-right font-semibold text-zinc-100">{v}</span>
    </div>
  );
}

function Addr({ children }: { children: string }) {
  return (
    <code className="break-all rounded bg-ink-900/80 px-1.5 py-0.5 font-mono text-[11px] text-robin">
      {children}
    </code>
  );
}

export default function DocsPage() {
  return (
    <main className="relative min-h-[100svh]">
      {/* top bar */}
      <header className="sticky top-0 z-50 border-b-2 border-robin/25 bg-ink-950/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-6">
          <Link href="/">
            <Wordmark />
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/" className="btn-ghost !px-4 !py-2">
              ← Home
            </Link>
            <Link href="/terminal" className="btn-robin !px-4 !py-2">
              Enter Terminal
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-6 lg:grid lg:grid-cols-[220px_1fr] lg:gap-12">
        {/* side nav */}
        <aside className="mb-10 lg:sticky lg:top-24 lg:mb-0 lg:h-fit">
          <nav className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
            {NAV.map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                className="rounded-md px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider text-zinc-400 transition-colors hover:bg-robin/5 hover:text-robin"
              >
                {label}
              </a>
            ))}
          </nav>
        </aside>

        {/* content */}
        <div>
          <h1 className="display text-4xl text-white sm:text-5xl">
            RobinX <span className="text-robin">Docs</span>
          </h1>
          <p className="mt-4 max-w-2xl text-pretty leading-relaxed text-zinc-400">
            Everything about how RobinX works — the token, the treasury, the
            30-minute stock rewards, the perps layer, and the on-chain
            contracts that run it. Built on Robinhood Chain.
          </p>

          <div className="mt-10 space-y-10">
            <Section id="overview" n="01" title="Overview">
              <p>
                <b className="text-white">RobinX</b> is a DeFi protocol on
                Robinhood Chain that turns trading activity into{" "}
                <b className="text-robin">real tokenized stocks</b>. Hold the{" "}
                <b className="text-white">ROBX</b> token and the treasury pays
                you tokenized Tesla, NVIDIA or SpaceX — your pick — every{" "}
                <b className="text-white">30 minutes</b>, straight to your
                wallet.
              </p>
              <p>
                No brokerage account, no borders, no market hours — 24/7,
                self-custodied. Rewards are funded purely by a small trade tax,
                so there are no emissions and no inflation.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ["Hold", "Buy & hold ROBX"],
                  ["Earn", "Tokenized stocks every 30 min"],
                  ["Pick", "TSLA · NVDA · SPCX"],
                ].map(([h, b]) => (
                  <div key={h} className="panel p-4">
                    <div className="font-mono text-xs font-black uppercase text-robin">{h}</div>
                    <div className="mt-1 text-sm text-zinc-300">{b}</div>
                  </div>
                ))}
              </div>
            </Section>

            <Section id="how" n="02" title="How it works">
              <p>The whole loop is three steps:</p>
              <ol className="ml-1 space-y-3">
                {[
                  ["Trade tax → treasury", "Every buy and sell of ROBX pays a 4% tax into a shared treasury contract."],
                  ["Treasury → stocks", "Every 30 minutes a keeper converts the collected tax and credits every holder pro-rata. Payouts are in tokenized stocks, not farm tokens."],
                  ["Claim → your wallet", "You pick your payout stock and claim; the treasury swaps into that stock at claim time and sends it to you. Or let it accrue and use it as perps margin (Phase 02)."],
                ].map(([t, b], i) => (
                  <li key={t} className="panel flex gap-4 p-5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border-2 border-robin/40 bg-robin/5 font-mono text-sm font-black text-robin">
                      {i + 1}
                    </span>
                    <div>
                      <div className="font-black uppercase tracking-tight text-white">{t}</div>
                      <div className="mt-1 text-sm text-zinc-400">{b}</div>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="rounded-lg border-2 border-robin/20 bg-robin/5 p-4 text-sm text-zinc-300">
                <b className="text-robin">Under the hood:</b> rewards are
                accounted internally in USDG (a stablecoin) so your claimable
                value is stable and the swap into a stock is a single hop. USDG
                is just the unit of account — you receive stocks, not USDG
                (a USDG fallback only kicks in if a stock&apos;s pool is ever
                unavailable).
              </p>
            </Section>

            <Section id="tokenomics" n="03" title="Tokenomics">
              <div className="panel p-6">
                <Row k="Token" v="ROBX" />
                <Row k="Total supply" v="100,000,000 (fixed, no mint)" />
                <Row k="Buy tax" v="4% → treasury" />
                <Row k="Sell tax" v="4% → treasury" />
                <Row k="Max tax (hard cap)" v="5% — owner can never exceed" />
                <Row k="Wallet ↔ wallet" v="0% (tax-free transfers)" />
                <Row k="Emissions" v="None — rewards come only from volume" />
              </div>
              <p className="text-sm text-zinc-400">
                The tax rate is adjustable by the owner but capped at 5% in the
                contract itself, so it can never be raised beyond that — a
                built-in protection for holders.
              </p>
            </Section>

            <Section id="rewards" n="04" title="Rewards & distribution">
              <div className="panel p-6">
                <Row k="Reward assets" v="tTSLA · tNVDA · tSPCX" />
                <Row k="Backing" v="1:1-backed stock tokens on Robinhood Chain" />
                <Row k="Frequency" v="Every 30 minutes, automatic" />
                <Row k="Eligibility" v="Pro-rata to every ROBX holder" />
                <Row k="Custody" v="Sent to your own wallet on claim" />
                <Row k="Default payout" v="Tesla (tTSLA) if you never pick" />
              </div>
              <p>
                Distribution accounting is O(1) — it scales to any number of
                holders with no loops, using a standard accumulator. A keeper
                bot triggers the 30-minute epoch; if it ever stops, anyone can
                trigger a distribution, and nothing is lost in the meantime.
              </p>
            </Section>

            <Section id="stocks" n="05" title="The stocks — and why these three">
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  ["tTSLA", "Tesla", "The most-traded retail stock on Earth — cult following, huge volatility."],
                  ["tNVDA", "NVIDIA", "The AI trade itself — the most-watched company on the planet."],
                  ["tSPCX", "SpaceX", "The biggest IPO in history (June 2026) — Elon\u2019s rocket company, freshly public and one of the most hyped tickers on the market."],
                ].map(([tok, name, why]) => (
                  <div key={tok} className="panel p-5">
                    <div className="font-mono text-lg font-black text-robin">{tok}</div>
                    <div className="text-sm font-semibold text-white">{name}</div>
                    <div className="mt-2 text-sm text-zinc-400">{why}</div>
                  </div>
                ))}
              </div>
              <p className="text-sm text-zinc-400">
                All three are canonical Robinhood Stock Tokens, verified live on
                Robinhood Chain mainnet, tracking their Nasdaq-listed shares.
              </p>
            </Section>

            <Section id="perps" n="06" title="Perps (Phase 02)">
              <p>
                A perpetual-futures layer on the reward stocks. You post your
                accrued treasury claim as margin, go long or short with 1–10×
                leverage, and settle against the next published oracle mark. A
                mandatory risk disclosure gates every position.
              </p>
              <p className="text-sm text-zinc-400">
                Perps are currently a live preview in the terminal — you can
                explore the order ticket and charts. Opening real positions
                unlocks with Phase 02.
              </p>
            </Section>

            <Section id="network" n="07" title="Network">
              <div className="panel p-6">
                <Row k="Chain" v="Robinhood Chain (Arbitrum Orbit L2)" />
                <Row k="Chain ID" v="4663" />
                <Row k="RPC" v={<Addr>https://rpc.mainnet.chain.robinhood.com</Addr>} />
                <Row k="Explorer" v={<Addr>robinhoodchain.blockscout.com</Addr>} />
                <Row k="Gas token" v="ETH" />
                <Row k="Reward stable" v="USDG (internal accounting only)" />
              </div>
              <p className="text-sm text-zinc-400">
                Connect any EVM wallet (MetaMask, Rabby). The terminal will
                prompt you to add and switch to Robinhood Chain automatically.
              </p>
            </Section>

            <Section id="contracts" n="08" title="Contracts & security">
              <p>Two contracts run the whole thing:</p>
              <ul className="space-y-2 text-sm">
                <li className="panel p-4">
                  <b className="text-white">ROBX</b> — the token. Fixed supply,
                  4% DEX tax (5% hard cap), no mint function after deploy.
                </li>
                <li className="panel p-4">
                  <b className="text-white">RewardDistributor</b> — the
                  treasury. Converts tax and pays holders in stocks every 30
                  minutes with O(1) accounting.
                </li>
              </ul>
              <p className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Reward stock tokens (verified on-chain)</p>
              <div className="panel p-5 text-sm">
                <div className="flex flex-col gap-2">
                  <span>tTSLA <Addr>{TSLA}</Addr></span>
                  <span>tNVDA <Addr>{NVDA}</Addr></span>
                  <span>tSPCX <Addr>{SPCX}</Addr></span>
                </div>
              </div>
            </Section>

            <Section id="faq" n="09" title="FAQ">
              {[
                ["Do I own real shares?", "No. Rewards are tokenized stocks (1:1-backed) held in your wallet; ROBX itself is a utility token with no equity or shareholder rights. Not affiliated with the underlying companies."],
                ["Where do rewards come from?", "Purely from the 4% trade tax. No emissions, no inflation — if there's no trading, there are simply no rewards that epoch."],
                ["What if I never pick a stock?", "You receive the default (tTSLA). You can change your payout stock any time in the Treasury tab."],
                ["Can the team rug the tax?", "The tax is hard-capped at 5% in the contract and can't be exceeded. There is no mint function. Ownership goes to a multisig before liquidity."],
                ["Is this live?", "The token & treasury (Phase 01) are built and tested; perps are a preview. Trading unlocks at token launch — the contract address will appear here and on the dashboard."],
              ].map(([q, a]) => (
                <details key={q} className="panel group px-5 py-1 [&_summary]:list-none">
                  <summary className="flex cursor-pointer items-center justify-between py-4 font-bold text-zinc-100">
                    {q}
                    <span className="ml-4 text-robin transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="pb-4 text-sm leading-relaxed text-zinc-400">{a}</p>
                </details>
              ))}
            </Section>
          </div>

          {/* CTA */}
          <div className="mt-14 flex flex-wrap gap-3">
            <Link href="/terminal" className="btn-robin !px-6 !py-3">
              Enter Terminal
            </Link>
            <a href="https://x.com/robinxtech" target="_blank" rel="noopener noreferrer" className="btn-ghost !px-6 !py-3">
              Follow on X
            </a>
          </div>

          <p className="mt-10 border-t-2 border-robin/10 pt-6 font-mono text-xs text-zinc-600">
            Synthetic exposure only · No equity · Not investment advice · DeFi
            carries risk of total loss. Not affiliated with Robinhood Markets,
            Inc., Tesla, Inc., NVIDIA Corp. or SpaceX.
          </p>
        </div>
      </div>
    </main>
  );
}
