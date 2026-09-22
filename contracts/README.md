# RobinX contracts — Phase 01 (Token & Treasury)

> ⚠️ **НЕ ИСПОЛЬЗУЕТСЯ.** RobinX запускается на [Pons](https://www.ponsfamily.com/launchpad):
> токен там выпускает сам лончпад (обычный ERC-20, без налога), а казна — это
> сервис `keeper/`, а не контракт. Эти контракты писались под самостоятельный
> запуск и оставлены для истории. Актуальное: [../LAUNCH_GUIDE.md](../LAUNCH_GUIDE.md),
> [../keeper/README.md](../keeper/README.md).

Two contracts implement the whole phase:

| Contract | What it does |
| --- | --- |
| `src/ROBX.sol` | ERC-20, fixed 100M supply. Takes a 4% tax on DEX buys/sells (hard-capped at 5%, wallet↔wallet transfers free) and streams it to the distributor. Reports every holder's balance to the distributor via hooks. |
| `src/RewardDistributor.sol` | The treasury. Once per 30-minute epoch converts accumulated ROBX tax → USDC and credits all holders pro-rata in O(1) (accumulator pattern — no loops over holders). Each holder picks a payout asset (tHOOD / tTSLA / tTTWO or USDC); stock payouts are swapped at claim time. Chainlink-Automation compatible (`checkUpkeep` / `performUpkeep`). |

## Compile

Verified with solc **0.8.28** + OpenZeppelin **v5** (already in `devDependencies`):

```bash
npx solcjs --optimize --bin --abi \
  contracts/src/ROBX.sol contracts/src/RewardDistributor.sol \
  --base-path . --include-path node_modules -o build/
```

(Foundry works too: remap `@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/`.)

## Tests

Full Foundry suite in `test/RobinX.t.sol` — **25 tests, all passing**
(tax on buys/sells only, share sync on every transfer path, epoch math,
pro-rata splits, claim-in-stock swaps, keeper gating, rescue protections,
an end-to-end two-holder journey):

```bash
cd contracts && forge test
```

Mocks mirror production faithfully: USDG with 6 decimals, a fixed-rate
UniswapV2-style router, a reward-exempt pair. Accumulator rounding dust
(≤2 units of USDG) is asserted explicitly — it stays in the contract by
design and is never lost by holders.

## Robinhood Chain mainnet — verified 2026-07-09

Checked live against the public RPC (all contracts confirmed deployed):

| Thing | Value |
| --- | --- |
| Chain ID | **4663** · RPC `https://rpc.mainnet.chain.robinhood.com` |
| Explorer | https://robinhoodchain.blockscout.com |
| Deployment | Permissionless — anyone can deploy |
| Stable (rewards) | **USDG** `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` — 6 decimals; pass as the `usdc_` constructor arg |
| Uniswap **v3** SwapRouter02 | `0xCaf681a66D020601342297493863E78C959E5cb2` (factory `0x1f7d…2EfA`, verified via `router.factory()`); QuoterV2 `0x33e885eD…A9E7`. v2 pairs for the stocks are empty — depth is on v3: TSLA/USDG 0.3% ~$700k, NVDA/USDG 0.05% ~$1.8M, SPCX/USDG 0.3% ~$340k, WETH/USDG 0.01% ~$9.6M (2026-09-15) |
| WETH | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` |
| TSLA stock token | `0x322F0929c4625eD5bAd873c95208D54E1c003b2d` — canonical, verified on-chain |
| NVDA stock token | `0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC` — canonical, verified on-chain |
| SPCX stock token | `0x4a0E65A3EcceC6dBe60AE065F2e7bb85Fae35eEa` — "SpaceX • Robinhood Token", verified on-chain |
| HOOD / TTWO | **Not tokenized** on Robinhood Chain (not in the canonical 20). Beware copycats: a "Take-Two • Robinhood Token" at `0x5e81…9786` is fake. Add real ones later via `setAllowedRewardToken` if Robinhood issues them |
| Stock tokens | Standard ERC-20, 18 decimals. Each is enabled with the fee tier of its USDG v3 pool (`setAllowedRewardToken(token, true, fee)`); `test/Fork.t.sol` quotes all three against the live chain (`forge test --match-contract ForkTest --fork-url <rpc>`) |
| Keeper | Chainlink listed for price feeds; Automation support unconfirmed — fallback: leave `keeper = 0` and run a cron bot calling `distribute()` |

## Deploy & wire (in this order)

1. **Deploy `ROBX`** — deployer receives 100M and is tax/reward-exempt.
2. **Deploy `RewardDistributor(robx, usdc, router, path)`**
   - `usdc` — the stable on Robinhood Chain
   - `router` — UniswapV2-style router of the DEX you launch on
   - `path` — `[ROBX, USDC]` (or `[ROBX, WETH, USDC]` if that's the liquid route)
3. **`robx.setDistributor(distributor)`** — also auto-exempts it.
4. Create the DEX pair, add liquidity, then **`robx.setMarketPair(pair, true)`** and **`robx.setRewardExempt(router, true)`** — pairs/routers must never accrue holder rewards.
5. **`distributor.setAllowedRewardToken(TSLA, true)`** (+ NVDA, SPCX — addresses above) — each
   needs a liquid USDC pair on the same router. Can be added later as
   liquidity appears; until then holders receive USDC.
6. Register the distributor as a **Chainlink Automation** upkeep (or Gelato
   task) and call `distributor.setKeeper(registryForwarder)`. With no keeper
   set, `distribute()` is callable by anyone — also fine.
7. Transfer ownership of both contracts to a **multisig/timelock**.
8. Frontend: paste the ROBX address into `lib/config.ts`
   (`ROBX_TOKEN_ADDRESS`) and the swap link (`BUY_ROBX_URL`).

## Frontend mapping

| UI element | Contract call |
| --- | --- |
| Treasury → "Receive rewards as" | `setRewardChoice(token)` |
| Treasury → "Claimable now" | `pendingUsdc(account)` |
| Treasury → "Claim tHOOD" | `claim()` |
| Treasury → "Next payout in" | `lastDistribution + epochInterval` |
| Dashboard → token balance | `balanceOf` (already wired via eth_call) |

## Before mainnet — non-negotiable

- **Audit.** This code is unaudited. It follows well-worn patterns
  (fee-on-transfer + dividend accumulator), but money code gets attacked on
  day one.
- **Confirm the reward stocks are composable.** Robinhood's own stock tokens
  are currently permissioned; use freely tradable tokenized equities (e.g.
  xStocks) with real USDC liquidity, or launch with USDC payouts and add
  stocks later — the contract supports both.
- Ownership on a multisig + timelock before liquidity goes in.
