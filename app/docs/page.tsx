import Link from "next/link";
import type { Metadata } from "next";
import { Wordmark } from "@/components/Logo";
import { TENDIE_MINT, TREASURY_WALLET, explorerAccount } from "@/lib/config";

export const metadata: Metadata = {
  title: "Tendies Docs - How it works",
  description:
    "Full documentation for Tendies: the TENDIE token on Solana, the 1.5% treasury fee, 30-minute tokenized-stock rewards (OpenAI · TSLA · NVDA · SPCX), perps, the keeper, and security.",
};

// xStock mints get pasted in from the official xStocks list at launch — see
// PAYOUT_STOCKS in lib/stocks.ts. Blank renders as "TBA".
import { PAYOUT_STOCKS } from "@/lib/stocks";

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
    <section id={id} className="scroll-mt-24 border-t border-tendie/15 pt-10">
      <div className="chip mb-4">
        // {n} · {title}
      </div>
      <div className="space-y-4 text-pretty leading-relaxed text-mist-200">
        {children}
      </div>
    </section>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-tendie/10 py-3 text-sm">
      <span className="font-mono uppercase tracking-wide text-mist-300">{k}</span>
      <span className="text-right font-semibold text-mist-50">{v}</span>
    </div>
  );
}

function Addr({ children }: { children: string }) {
  return (
    <code className="break-all rounded bg-ink-900/80 px-1.5 py-0.5 font-mono text-[11px] text-tendie">
      {children}
    </code>
  );
}

// Same chip, but clickable through to the explorer. Used for the addresses a
// reader should be able to audit rather than just read.
function AddrLink({ address, label }: { address: string; label: string }) {
  return (
    <span>
      {label}{" "}
      {address ? (
        <a
          href={explorerAccount(address)}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          <Addr>{address}</Addr>
        </a>
      ) : (
        <span className="text-mist-400">TBA at launch</span>
      )}
    </span>
  );
}

export default function DocsPage() {
  return (
    <main className="relative min-h-[100svh]">
      {/* top bar */}
      <header className="sticky top-0 z-50 border-b border-tendie/25 bg-ink-950/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-6">
          <Link href="/">
            <Wordmark />
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/" className="btn-ghost !px-4 !py-2">
              ← Home
            </Link>
            <Link href="/terminal" className="btn-tendie !px-4 !py-2">
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
                className="rounded-md px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider text-mist-300 transition-colors hover:bg-tendie/5 hover:text-tendie"
              >
                {label}
              </a>
            ))}
          </nav>
        </aside>

        {/* content */}
        <div>
          <h1 className="display text-4xl text-white sm:text-5xl">
            Tendies <span className="text-tendie">Docs</span>
          </h1>
          <p className="mt-4 max-w-2xl text-pretty leading-relaxed text-mist-300">
            Everything about how Tendies works - the token, the treasury, the
            30-minute stock rewards, the perps layer, and the on-chain
            contracts that run it. Launched on stonkfun, settled on Solana.
          </p>

          <div className="mt-10 space-y-10">
            <Section id="overview" n="01" title="Overview">
              <p>
                <b className="text-white">Tendies</b> is a DeFi protocol on
                Solana that turns trading activity into{" "}
                <b className="text-tendie">real tokenized stocks</b>. Hold the{" "}
                <b className="text-white">TENDIE</b> token and the treasury pays
                you tokenized OpenAI, Tesla, NVIDIA or SpaceX - your pick - every{" "}
                <b className="text-white">30 minutes</b>, straight to your
                wallet.
              </p>
              <p>
                No brokerage account, no borders, no market hours - 24/7,
                self-custodied. Rewards are funded purely by a small trade tax,
                so there are no emissions and no inflation.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ["Hold", "Buy & hold TENDIE"],
                  ["Earn", "Tokenized stocks every 30 min"],
                  ["Pick", "OPENAI · TSLA · NVDA · SPCX"],
                ].map(([h, b]) => (
                  <div key={h} className="panel p-4">
                    <div className="font-mono text-xs font-black uppercase text-tendie">{h}</div>
                    <div className="mt-1 text-sm text-mist-200">{b}</div>
                  </div>
                ))}
              </div>
            </Section>

            <Section id="how" n="02" title="How it works">
              <p>The whole loop is three steps:</p>
              <ol className="ml-1 space-y-3">
                {[
                  ["Trade fee → treasury", "TENDIE itself is untaxed. Its pool on stonkfun charges 2% per trade, of which 1.5% is routed to the treasury and 0.5% kept by the launchpad."],
                  ["Treasury → stocks", "Every 30 minutes a keeper credits every holder pro-rata. Balances are sent out in tokenized stocks - not farm tokens - once they clear a small floor, so network fees never cost more than the payout itself."],
                  ["Stocks → your wallet", "There is no claim button. You pick your payout stock by signing a message; the treasury swaps and sends automatically once your balance clears the floor. Or let it keep accruing and use it as perps margin (Phase 02)."],
                ].map(([t, b], i) => (
                  <li key={t} className="panel flex gap-4 p-5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-tendie/40 bg-tendie/5 font-mono text-sm font-black text-tendie">
                      {i + 1}
                    </span>
                    <div>
                      <div className="font-black uppercase tracking-tight text-white">{t}</div>
                      <div className="mt-1 text-sm text-mist-300">{b}</div>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="rounded-lg border border-tendie/20 bg-tendie/5 p-4 text-sm text-mist-200">
                <b className="text-tendie">Under the hood:</b> the fee arrives
                in the token TENDIE is paired against - OPENAI - so that is what
                the ledger counts until payout. Your balance is therefore held
                in OpenAI, not in dollars, and moves with it; the payout floor is
                converted from dollars at the live rate each epoch. If a stock&apos;s
                pool is ever unroutable, that group is paid in OPENAI instead of
                waiting.
              </p>
            </Section>

            <Section id="tokenomics" n="03" title="Tokenomics">
              <div className="panel p-6">
                <Row k="Token" v="TENDIE" />
                <Row k="Total supply" v="1,000,000,000 (fixed, no mint)" />
                <Row k="Quote pair" v="OPENAI (PreStocks) - permanent, set at launch" />
                <Row k="Pool fee" v="2% per trade" />
                <Row k="→ Treasury" v="1.5% of every trade" />
                <Row k="→ Launchpad" v="0.5% of every trade" />
                <Row k="Token transfer tax" v="None - the mint carries no fee extension" />
                <Row k="Wallet ↔ wallet" v="0% (free transfers)" />
                <Row k="Emissions" v="None - rewards come only from volume" />
              </div>
              <p className="text-sm text-mist-300">
                Nobody can raise the fee after launch: the pool&apos;s rate is
                fixed by the launchpad when the pool is created, and the mint
                carries no transfer-fee extension for anyone to turn on later.
              </p>
            </Section>

            <Section id="rewards" n="04" title="Rewards & distribution">
              <div className="panel p-6">
                <Row k="Reward assets" v="OPENAI · TSLAx · NVDAx · SPCXx" />
                <Row k="Backing" v="xStocks 1:1-backed · OPENAI via PreStocks SPV" />
                <Row k="Accrual" v="Every 30 minutes, automatic" />
                <Row k="Eligibility" v="Pro-rata to every TENDIE holder" />
                <Row k="Sent when" v="Your balance passes the payout floor" />
                <Row k="Custody" v="Straight to your own wallet" />
                <Row k="Default payout" v="OpenAI (OPENAI) if you never pick" />
              </div>
              <p>
                Two things happen on different clocks.{" "}
                <b className="text-white">Accrual</b> is every 30 minutes:
                whatever fee arrived since the last epoch is split across every
                holder by their share of the supply, however small the stake.{" "}
                <b className="text-white">Payment</b> waits until your accrued
                balance clears a floor.
              </p>
              <p>
                The floor exists because Solana charges the treasury rent to
                open a token account for a holder who doesn&apos;t have one yet.
                Sending someone half a cent would cost the treasury far more
                than the payout is worth - so small balances keep accumulating
                until they are worth delivering. Nothing is lost while they
                wait: the ledger is durable, and an unpaid balance is still
                yours.
              </p>
              <p>
                Payouts settle batch by batch. If the keeper dies mid-epoch,
                everything already confirmed is recorded and everything else is
                still owed - nobody is paid twice and nobody is skipped.
              </p>
            </Section>

            <Section id="stocks" n="05" title="The stocks - and why these four">
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  ["OPENAI", "OpenAI", "The most anticipated IPO on the planet, and you cannot buy it on any exchange - this is the only way in before it lists."],
                  ["TSLAx", "Tesla", "The most-traded retail stock on Earth - cult following, huge volatility."],
                  ["NVDAx", "NVIDIA", "The AI trade itself - the most-watched company on the planet."],
                  ["SPCXx", "SpaceX", "The biggest IPO in history (June 2026) - Elon\u2019s rocket company, freshly public and one of the most hyped tickers on the market."],
                ].map(([tok, name, why]) => (
                  <div key={tok} className="panel p-5">
                    <div className="font-mono text-lg font-black text-tendie">{tok}</div>
                    <div className="text-sm font-semibold text-white">{name}</div>
                    <div className="mt-2 text-sm text-mist-300">{why}</div>
                  </div>
                ))}
              </div>
              <p className="text-sm text-mist-300">
                Tesla, NVIDIA and SpaceX are xStocks - Backed Finance&apos;s
                1:1-collateralised equity tokens on Solana, tracking their
                Nasdaq-listed shares. OpenAI is a PreStocks token: it tracks
                shares held by an SPV in a private company, so there is no
                exchange price - it is priced by its on-chain pool - and OpenAI
                has publicly said it does not recognise such transfers. It is
                exposure, not a share.
              </p>
            </Section>

            <Section id="perps" n="06" title="Perps">
              <p>
                A perpetual-futures layer on the reward stocks, run by the same
                keeper that pays you. You post part of your{" "}
                <b className="text-white">accrued rewards</b> as margin - nothing
                leaves your wallet, nothing is deposited - go long or short with
                1-10× leverage, and the position is marked against the keeper&apos;s
                published price every few minutes. Close whenever you like;
                whatever is left of the margin plus PnL goes back to your accrued
                balance and is paid out in stock like everything else.
              </p>
              <div className="panel p-6">
                <Row k="Markets" v="OPENAI · TSLA · NVDA · SPCX" />
                <Row k="Margin" v="Your accrued rewards (min $1)" />
                <Row k="Leverage" v="1× - 10×" />
                <Row k="Mark" v="Every 5 min - exchange quote, or the on-chain pool for OpenAI - signed by the treasury key" />
                <Row k="Funding" v="0.05% of position size every 8h, charged to margin, kept by the treasury" />
                <Row k="Liquidation" v="When losses reach 95% of margin - the remainder stays with the treasury" />
                <Row k="Expiry" v="None - funding is what makes holding leverage cost something" />
                <Row k="Counterparty" v="The treasury - losses go back to all holders as next epoch's fee" />
                <Row k="Limits" v="One position ≤ 10% of the treasury, all open interest ≤ 50%" />
              </div>
              <p className="text-sm text-mist-300">
                Because the treasury is the other side of every trade, the
                limits above are what keep one lucky trader from draining the
                reward pool. Every mark is signed, so a settlement price can be
                checked against the treasury&apos;s public key. Perps go live
                together with the token - the terminal shows a preview until then.
              </p>
            </Section>

            <Section id="network" n="07" title="Network">
              <div className="panel p-6">
                <Row k="Chain" v="Solana mainnet-beta" />
                <Row k="Launchpad" v="stonkfun.xyz" />
                <Row k="Token program" v="SPL Token" />
                <Row k="Explorer" v={<Addr>solscan.io</Addr>} />
                <Row k="Gas token" v="SOL" />
                <Row k="Ledger unit" v="OPENAI - what the fee arrives in" />
              </div>
              <p className="text-sm text-mist-300">
                Connect any Solana wallet - Phantom, Solflare or anything that
                injects the same provider. Nothing to add or switch: the
                terminal reads your balance straight off mainnet-beta.
              </p>
            </Section>

            <Section id="contracts" n="08" title="Programs & security">
              <p>Two moving parts run the whole thing:</p>
              <ul className="space-y-2 text-sm">
                <li className="panel p-4">
                  <b className="text-white">TENDIE</b> - the token. Fixed 1B
                  supply, no transfer tax, no mint authority after launch - the
                  mint is created by the launchpad, not by us.
                </li>
                <li className="panel p-4">
                  <b className="text-white">Distributor keeper</b> - the
                  treasury service. Every 30 minutes it snapshots holders from
                  the mint, credits the new fee to its ledger, then swaps and
                  sends to everyone whose balance cleared the floor. Your payout
                  stock is set by signing a message in your wallet - free, and
                  it can&apos;t be set by anyone but you.
                </li>
              </ul>
              <p className="text-sm font-semibold uppercase tracking-wide text-mist-300">
                Addresses you can audit
              </p>
              <div className="panel p-5 text-sm">
                <div className="flex flex-col gap-2">
                  <AddrLink label="TENDIE mint" address={TENDIE_MINT} />
                  <AddrLink label="Treasury" address={TREASURY_WALLET} />
                </div>
                <p className="mt-3 text-xs text-mist-400">
                  The treasury is the wallet the launchpad forwards the creator
                  fee to, and the one every payout is signed by. Open it in the
                  explorer to see what came in and what went out - the schedule
                  is checkable by anyone, without taking our word for it.
                </p>
              </div>
              <p className="text-sm font-semibold uppercase tracking-wide text-mist-300">Reward stock tokens (verified on-chain)</p>
              <div className="panel p-5 text-sm">
                <div className="flex flex-col gap-2">
                  {PAYOUT_STOCKS.map((st) => (
                    <span key={st.token}>
                      {st.token}{" "}
                      {st.mint ? <Addr>{st.mint}</Addr> : <span className="text-mist-400">TBA at launch</span>}
                    </span>
                  ))}
                </div>
              </div>
            </Section>

            <Section id="faq" n="09" title="FAQ">
              {[
                ["Do I own real shares?", "No. Rewards are tokenized stocks (xStocks 1:1-backed; OPENAI is SPV-backed pre-IPO exposure) held in your wallet; TENDIE itself is a utility token with no equity or shareholder rights. Not affiliated with the underlying companies."],
                ["Where do rewards come from?", "Purely from the 1.5% of every trade the launchpad routes to the treasury. No emissions, no inflation - if there's no trading, there are simply no rewards that epoch."],
                ["What if I never pick a stock?", "You receive the default (OPENAI). You can change your payout stock any time in the Treasury tab."],
                ["Can the team rug the fee?", "TENDIE launches on the stonkfun launchpad, so the mint and the bonding curve are the launchpad's, not ours - mint authority is not ours to abuse. The treasury wallet that receives the fee is published and its payouts are visible on Solscan."],
                ["Is this live?", "The token & treasury (Phase 01) are built and tested; perps are a preview. Trading unlocks at token launch - the mint address will appear here and on the dashboard."],
              ].map(([q, a]) => (
                <details key={q} className="panel group px-5 py-1 [&_summary]:list-none">
                  <summary className="flex cursor-pointer items-center justify-between py-4 font-bold text-mist-50">
                    {q}
                    <span className="ml-4 text-tendie transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="pb-4 text-sm leading-relaxed text-mist-300">{a}</p>
                </details>
              ))}
            </Section>
          </div>

          {/* CTA */}
          <div className="mt-14 flex flex-wrap gap-3">
            <Link href="/terminal" className="btn-tendie !px-6 !py-3">
              Enter Terminal
            </Link>
            <a href="https://x.com/Tendies_Stonk" target="_blank" rel="noopener noreferrer" className="btn-ghost !px-6 !py-3">
              Follow on X
            </a>
          </div>

          <p className="mt-10 border-t border-tendie/10 pt-6 font-mono text-xs text-mist-500">
            Synthetic exposure only · No equity · Not investment advice · DeFi
            carries risk of total loss. Not affiliated with Robinhood Markets,
            Inc., OpenAI, Tesla, Inc., NVIDIA Corp. or SpaceX.
          </p>
        </div>
      </div>
    </main>
  );
}
