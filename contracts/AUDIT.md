# RobinX Phase 01 — Internal Security Review

**Scope:** `src/ROBX.sol`, `src/RewardDistributor.sol` (commit of 2026-07-09)
**Method:** manual line-by-line review, attack-pattern checklist
(fee-on-transfer tokens, dividend trackers, MEV, access control, reentrancy),
28-test Foundry suite with production-faithful mocks.
**Reviewer:** internal (Claude). ⚠️ This does **not** replace an independent
external audit — commission one before real liquidity.

## Findings

| # | Severity | Finding | Status |
|---|----------|---------|--------|
| M-1 | **Medium** | **Share-desync griefing via the 63/64 gas rule.** The token syncs holder shares through a `try/catch` hook so a distributor fault can never brick transfers — but that also lets an attacker gas-starve the hook: craft the tx gas limit so the transfer succeeds while `setShare` reverts OOG and is swallowed. Result: sell ROBX, keep stale shares, keep farming other holders' rewards. | **Fixed** — permissionless `syncShare(account)` reads the true token balance (0 for reward-exempt accounts) and heals any desync; anyone/bots/keeper can call. Regression test `test_SyncShareHealsDesync`. |
| L-1 | Low | **Bricked claims after a reward token is disallowed.** `claim()` swapped into `rewardChoice` unconditionally; if the owner delisted a stock (e.g. pool drained), affected holders' claims reverted until they manually changed choice. | **Fixed** — claim falls back to USDG when the chosen token is no longer allowed. Test `test_ClaimFallsBackToUsdgWhenStockDisallowed`. |
| L-2 | Low | **MEV/sandwich on `distribute()` and stock claims.** `minOut` derives from `getAmountsOut` in the same tx, so it tracks a manipulated pool — the slippage guard protects against fee drift, not sandwiches. | **Accepted / documented.** Mitigations: Robinhood Chain (Arbitrum Orbit) has a FCFS sequencer and no public mempool, making classic sandwiching impractical; 30-min epochs keep pots small. Hardening option if volume grows: keeper-supplied `minOut` from an off-chain quote or a TWAP check. |
| L-3 | Low | **Ledger requires pairs/routers to be reward-exempt.** Any non-exempt contract holding ROBX (router mid-swap, future pools) accrues shares and dilutes holders. | **Documented + tested** — `setMarketPair` auto-exempts pairs; deploy guide mandates `setRewardExempt(router)`; caught live by the test suite during development. |
| I-1 | Info | `allowedRewardTokens` list could accumulate duplicates on re-allow. Informational array only. | **Fixed** — `_everListed` guard. Test `test_ReallowingTokenDoesNotDuplicateList`. |
| I-2 | Info | **Owner powers**: set tax (≤5% hard cap), swap router/path/slippage (≤10% cap), keeper, reward list; cannot mint, cannot exceed caps, cannot rescue ROBX/USDG held for holders. Replacing the distributor abandons the old ledger (shares rebuild on each holder's next transfer or via `syncShare`). | **Accepted** — move ownership to a multisig + timelock before liquidity (deploy guide step 7). |
| I-3 | Info | Accumulator rounding dust (≤2 USDG units per op) accrues to the contract, never to holders' detriment beyond dust. | **By design** — asserted in tests. |

## What was checked and found sound

- **Reentrancy:** `claim`/`distribute`/`performUpkeep` guarded; state zeroed
  before external calls; `setShare` callable only by the token.
- **Tax logic:** applies only when a market pair is `from`/`to`; exemptions
  honored; hard cap 500 bps enforced in `setTaxBps`; no tax path when the
  distributor is unset (nothing burned to the void).
- **Accounting:** MasterChef-style accumulator; pro-rata splits, mid-epoch
  transfers, zero-balance accounts, `totalShares == 0` epochs, dust-carryover
  epochs all covered by tests; no loops over holders anywhere.
- **Overflow envelope:** `usdcReceived × 1e36` and `shares × acc` stay far
  below 2²⁵⁶ for any realistic supply/volume.
- **Approvals:** `forceApprove` for exact `amountIn`, consumed in full by the
  router each swap.
- **Keeper access:** `distribute` and `performUpkeep` share one gate; open to
  anyone when `keeper == 0` (deliberate fallback mode).

## Residual requirements before mainnet

1. Independent external audit (this review is not one).
2. Ownership → multisig + timelock **before** adding liquidity.
3. Verify USDG-pair liquidity for each stock before `setAllowedRewardToken`.
4. Run a `syncShare` sweeper alongside the keeper (cheap cron; heals M-1-style
   desyncs proactively).
