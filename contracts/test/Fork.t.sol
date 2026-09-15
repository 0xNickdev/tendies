// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IQuoterV2, ISwapRouter02} from "../src/RewardDistributor.sol";

/// Runs only with --fork-url: proves the v3 interfaces and fee tiers in
/// Deploy.s.sol against Robinhood Chain itself.
contract ForkTest is Test {
    address constant USDG = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168;
    address constant WETH = 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73;
    address constant TSLA = 0x322F0929c4625eD5bAd873c95208D54E1c003b2d;
    address constant NVDA = 0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC;
    address constant SPCX = 0x4a0E65A3EcceC6dBe60AE065F2e7bb85Fae35eEa;
    address constant QUOTER = 0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7;

    function test_QuotesOnRealPools() public {
        if (block.chainid != 4663) return; // not forked - skip
        IQuoterV2 q = IQuoterV2(QUOTER);
        (uint256 tsla, , , ) = q.quoteExactInput(abi.encodePacked(USDG, uint24(3000), TSLA), 1_000e6);
        (uint256 nvda, , , ) = q.quoteExactInput(abi.encodePacked(USDG, uint24(500), NVDA), 1_000e6);
        (uint256 spcx, , , ) = q.quoteExactInput(abi.encodePacked(USDG, uint24(3000), SPCX), 1_000e6);
        (uint256 usdg, , , ) = q.quoteExactInput(abi.encodePacked(WETH, uint24(100), USDG), 1e18);
        emit log_named_decimal_uint("1000 USDG -> TSLA", tsla, 18);
        emit log_named_decimal_uint("1000 USDG -> NVDA", nvda, 18);
        emit log_named_decimal_uint("1000 USDG -> SPCX", spcx, 18);
        emit log_named_decimal_uint("1 WETH -> USDG", usdg, 6);
        // sane: $1000 buys between 1 and 10 TSLA, between 3 and 8 NVDA, 5-9 SPCX
        assertGt(tsla, 1e18); assertLt(tsla, 10e18);
        assertGt(nvda, 3e18); assertLt(nvda, 8e18);
        assertGt(spcx, 4e18); assertLt(spcx, 10e18);
        assertGt(usdg, 1_000e6);
    }
}
