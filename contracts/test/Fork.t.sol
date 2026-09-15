// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
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
    address constant ROUTER = 0xCaf681a66D020601342297493863E78C959E5cb2;

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

    /// The exact call RewardDistributor._swap makes, against the real router:
    /// quote, approve, exactInput with a 3% floor, for every payout stock and
    /// for the WETH -> USDG tax leg. `deal` writes the balances via storage.
    function test_RealSwapsThroughSwapRouter02() public {
        if (block.chainid != 4663) return;
        address[3] memory stocks = [TSLA, NVDA, SPCX];
        uint24[3] memory fees = [uint24(3000), uint24(500), uint24(3000)];
        for (uint256 i = 0; i < 3; i++) {
            bytes memory path = abi.encodePacked(USDG, fees[i], stocks[i]);
            deal(USDG, address(this), 1_000e6);
            (uint256 quoted, , , ) = IQuoterV2(QUOTER).quoteExactInput(path, 1_000e6);
            IERC20(USDG).approve(ROUTER, 1_000e6);
            uint256 out = ISwapRouter02(ROUTER).exactInput(
                ISwapRouter02.ExactInputParams({
                    path: path,
                    recipient: address(this),
                    amountIn: 1_000e6,
                    amountOutMinimum: (quoted * 9_700) / 10_000
                })
            );
            emit log_named_decimal_uint("swapped 1000 USDG ->", out, 18);
            assertEq(IERC20(stocks[i]).balanceOf(address(this)), out);
            assertGe(out, (quoted * 9_700) / 10_000);
        }
        // tax leg: WETH -> USDG at 0.01%
        deal(WETH, address(this), 1e18);
        bytes memory tax = abi.encodePacked(WETH, uint24(100), USDG);
        (uint256 q, , , ) = IQuoterV2(QUOTER).quoteExactInput(tax, 1e18);
        IERC20(WETH).approve(ROUTER, 1e18);
        uint256 usdgOut = ISwapRouter02(ROUTER).exactInput(
            ISwapRouter02.ExactInputParams({path: tax, recipient: address(this), amountIn: 1e18, amountOutMinimum: (q * 9_700) / 10_000})
        );
        emit log_named_decimal_uint("swapped 1 WETH -> USDG", usdgOut, 6);
        assertGt(usdgOut, 1_000e6);
    }
}
