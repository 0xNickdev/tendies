// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ROBX} from "../src/ROBX.sol";
import {RewardDistributor} from "../src/RewardDistributor.sol";

/// @notice Deploys ROBX + RewardDistributor to Robinhood Chain and wires them.
///
/// Does NOT create the DEX pair or add liquidity — do that manually on Uniswap
/// after this runs, then call setMarketPair / setRewardExempt (printed below).
///
/// Run (dry):  forge script script/Deploy.s.sol --rpc-url $RPC
/// Run (live): forge script script/Deploy.s.sol --rpc-url $RPC \
///               --private-key $PK --broadcast --verify \
///               --verifier blockscout \
///               --verifier-url https://robinhoodchain.blockscout.com/api
contract Deploy is Script {
    // ── Robinhood Chain mainnet (chain id 4663), verified on-chain 2026-07-09 ──
    address constant USDG = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168; // 6 dec
    address constant ROUTER = 0x89e5DB8B5aA49aA85AC63f691524311AEB649eba; // Uni v2
    address constant WETH = 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73;

    // Canonical Robinhood Stock Tokens (payout options)
    address constant TSLA = 0x322F0929c4625eD5bAd873c95208D54E1c003b2d;
    address constant NVDA = 0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC;
    address constant SPCX = 0x4a0E65A3EcceC6dBe60AE065F2e7bb85Fae35eEa;

    function run() external {
        vm.startBroadcast();

        // 1. Token — deployer receives 100M, is tax/reward exempt.
        ROBX robx = new ROBX();
        console2.log("ROBX             :", address(robx));

        // 2. Distributor. Trading pair is ROBX/WETH (buyers pay with ETH, no
        //    USDG needed), but rewards are accounted in USDG for stable value
        //    and 1-hop stock swaps. Tax therefore routes ROBX -> WETH -> USDG.
        address[] memory path = new address[](3);
        path[0] = address(robx);
        path[1] = WETH;
        path[2] = USDG;
        RewardDistributor dist = new RewardDistributor(address(robx), USDG, ROUTER, path);
        console2.log("RewardDistributor:", address(dist));

        // 3. Wire them (auto-exempts the distributor).
        robx.setDistributor(address(dist));

        // 4. Reward-exempt the router so mid-swap holdings never accrue shares
        //    (AUDIT L-3). The DEX pair is exempted later via setMarketPair.
        robx.setRewardExempt(ROUTER, true);

        // 5. Allow the stock payout options. Uses the canonical tokens; each
        //    only pays out once a USDG pair exists on the router — until then
        //    holders receive USDG automatically (AUDIT L-1 fallback).
        // Payouts are strictly tokenized stocks — no USDG/WETH to holders.
        dist.setAllowedRewardToken(TSLA, true);
        dist.setAllowedRewardToken(NVDA, true);
        dist.setAllowedRewardToken(SPCX, true);
        // Holders who never pick a stock get this one by default.
        dist.setDefaultRewardToken(TSLA);

        vm.stopBroadcast();

        console2.log("");
        console2.log("=== NEXT STEPS (manual) ===");
        console2.log("1. Create ROBX/WETH pair on Uniswap + add liquidity");
        console2.log("2. robx.setMarketPair(<pairAddress>, true)   // enables 4%% tax");
        console2.log("3. Set distributor keeper: dist.setKeeper(<keeperEOA or 0>)");
        console2.log("4. Transfer ownership of BOTH to the multisig/timelock");
        console2.log("5. Paste ROBX + buy link into frontend lib/config.ts");
        console2.log("");
        console2.log("USDG :", USDG);
        console2.log("ROUTER:", ROUTER);
    }
}
