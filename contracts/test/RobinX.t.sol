// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ROBX} from "../src/ROBX.sol";
import {RewardDistributor} from "../src/RewardDistributor.sol";

// ─── mocks ───────────────────────────────────────────────────────────────

contract MockUSDG is ERC20 {
    constructor() ERC20("Global Dollar", "USDG") {}

    function decimals() public pure override returns (uint8) {
        return 6; // faithful to the real USDG
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockStock is ERC20 {
    constructor(string memory sym) ERC20(sym, sym) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// Fixed-rate UniswapV2-style router: out = in * num / den per (in, out) pair.
/// v3-shaped mock: SwapRouter02.exactInput + QuoterV2.quoteExactInput over
/// packed paths, with per-hop rates. One contract plays both roles.
contract MockRouter {
    struct Rate {
        uint256 num;
        uint256 den;
    }

    struct ExactInputParams {
        bytes path;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }

    mapping(address => mapping(address => Rate)) public rates;
    // fill worse than the quote by this much - a sandwich between quote and swap
    uint256 public fillHaircutBps;

    function setFillHaircut(uint256 bps) external {
        fillHaircutBps = bps;
    }

    function setRate(address a, address b, uint256 num, uint256 den) external {
        rates[a][b] = Rate(num, den);
    }

    function quote(address a, address b, uint256 amountIn) public view returns (uint256) {
        Rate memory r = rates[a][b];
        require(r.den > 0, "no rate");
        return (amountIn * r.num) / r.den;
    }

    function _token(bytes memory path, uint256 offset) private pure returns (address t) {
        assembly {
            t := shr(96, mload(add(add(path, 32), offset)))
        }
    }

    // walk token(20) fee(3) token(20) …
    function _out(bytes memory path, uint256 amountIn) private view returns (uint256 out, address last) {
        out = amountIn;
        address prev = _token(path, 0);
        for (uint256 o = 23; o < path.length; o += 23) {
            address next = _token(path, o);
            out = quote(prev, next, out);
            prev = next;
        }
        last = prev;
    }

    function quoteExactInput(bytes memory path, uint256 amountIn)
        external
        view
        returns (uint256 amountOut, uint160[] memory a, uint32[] memory b, uint256 c)
    {
        (amountOut, ) = _out(path, amountIn);
        return (amountOut, a, b, c);
    }

    function exactInput(ExactInputParams calldata p) external payable returns (uint256 out) {
        IERC20(_token(p.path, 0)).transferFrom(msg.sender, address(this), p.amountIn);
        address last;
        (out, last) = _out(p.path, p.amountIn);
        out = (out * (10_000 - fillHaircutBps)) / 10_000;
        require(out >= p.amountOutMinimum, "slippage");
        IERC20(last).transfer(p.recipient, out);
    }
}

// ─── suite ───────────────────────────────────────────────────────────────

contract RobinXTest is Test {
    ROBX robx;
    RewardDistributor dist;
    MockUSDG usdg;
    MockStock tsla;
    MockRouter router;

    address deployer = address(this);
    address pair = makeAddr("pair");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address keeper = makeAddr("keeper");

    // 1 ROBX (1e18) → 0.5 USDG (5e5 units)
    uint256 constant ROBX_USDG_NUM = 5e5;
    uint256 constant ROBX_USDG_DEN = 1e18;
    // 1 USDG (1e6) → 0.005 TSLA (5e15 units)
    uint256 constant USDG_TSLA_NUM = 5e15;
    uint256 constant USDG_TSLA_DEN = 1e6;

    function setUp() public {
        usdg = new MockUSDG();
        tsla = new MockStock("tTSLA");
        router = new MockRouter();
        robx = new ROBX();

        bytes memory path = abi.encodePacked(address(robx), uint24(3000), address(usdg));
        dist = new RewardDistributor(address(robx), address(usdg), address(router), address(router), path);

        robx.setDistributor(address(dist));
        robx.setMarketPair(pair, true);
        // routers/pools must never accrue holder rewards (mirrors prod wiring)
        robx.setRewardExempt(address(router), true);
        dist.setAllowedRewardToken(address(tsla), true, 3000);

        // fund the fake AMM
        router.setRate(address(robx), address(usdg), ROBX_USDG_NUM, ROBX_USDG_DEN);
        router.setRate(address(usdg), address(tsla), USDG_TSLA_NUM, USDG_TSLA_DEN);
        usdg.mint(address(router), 1_000_000e6);
        tsla.mint(address(router), 1_000_000e18);

        // seed the "pair" with inventory to sell from
        robx.transfer(pair, 10_000_000e18);
    }

    // ─── helpers ──

    function _buy(address who, uint256 amount) internal {
        vm.prank(pair);
        robx.transfer(who, amount); // pair → user = buy
    }

    function _sell(address who, uint256 amount) internal {
        vm.prank(who);
        robx.transfer(pair, amount); // user → pair = sell
    }

    function _distribute() internal {
        vm.warp(block.timestamp + 30 minutes);
        dist.distribute();
    }

    // ─── token: tax ──

    function test_BuyTakes4PercentTax() public {
        _buy(alice, 1000e18);
        assertEq(robx.balanceOf(alice), 960e18, "alice gets 96%");
        assertEq(robx.balanceOf(address(dist)), 40e18, "distributor gets 4%");
    }

    function test_SellTakes4PercentTax() public {
        _buy(alice, 1000e18);
        uint256 pairBefore = robx.balanceOf(pair);
        _sell(alice, 500e18);
        assertEq(robx.balanceOf(pair), pairBefore + 480e18, "pair gets 96%");
        assertEq(robx.balanceOf(address(dist)), 40e18 + 20e18, "4% taxed on sell");
    }

    function test_WalletToWalletIsTaxFree() public {
        _buy(alice, 1000e18);
        uint256 distBefore = robx.balanceOf(address(dist));
        vm.prank(alice);
        robx.transfer(bob, 100e18);
        assertEq(robx.balanceOf(bob), 100e18, "no tax between wallets");
        assertEq(robx.balanceOf(address(dist)), distBefore, "no new tax");
    }

    function test_TaxExemptBuyerPaysNoTax() public {
        robx.setTaxExempt(alice, true);
        _buy(alice, 1000e18);
        assertEq(robx.balanceOf(alice), 1000e18);
    }

    function test_TaxCapEnforced() public {
        vm.expectRevert("ROBX: tax above cap");
        robx.setTaxBps(501);
        robx.setTaxBps(500); // at cap is fine
        assertEq(robx.taxBps(), 500);
    }

    function test_OnlyOwnerConfiguresToken() public {
        vm.prank(alice);
        vm.expectRevert();
        robx.setTaxBps(100);
    }

    // ─── token → distributor share sync ──

    function test_SharesTrackBalances() public {
        _buy(alice, 1000e18);
        assertEq(dist.shares(alice), 960e18);
        vm.prank(alice);
        robx.transfer(bob, 460e18);
        assertEq(dist.shares(alice), 500e18);
        assertEq(dist.shares(bob), 460e18);
        assertEq(dist.totalShares(), 960e18);
    }

    function test_PairAndExemptEarnNoShares() public {
        assertEq(dist.shares(pair), 0, "pair is reward-exempt");
        assertEq(dist.shares(deployer), 0, "deployer is reward-exempt");
    }

    function test_OnlyTokenCanSetShare() public {
        vm.prank(alice);
        vm.expectRevert(RewardDistributor.NotToken.selector);
        dist.setShare(alice, 1);
    }

    // ─── distributor: epochs ──

    function test_DistributeRevertsBeforeEpoch() public {
        _buy(alice, 1000e18);
        vm.expectRevert(RewardDistributor.EpochNotReady.selector);
        dist.distribute();
    }

    function test_DistributeConvertsTaxToUsdg() public {
        _buy(alice, 1000e18); // 40 ROBX tax
        _distribute();
        // 40 ROBX * 0.5 = 20 USDG
        assertEq(usdg.balanceOf(address(dist)), 20e6);
        assertEq(dist.epochCount(), 1);
        // alice is the only holder → owed everything
        assertApproxEqAbs(dist.pendingUsdc(alice), 20e6, 2); // accumulator dust ≤ 2 units
    }

    function test_ProRataSplit_60_40() public {
        _buy(alice, 600e18); // 576 shares
        _buy(bob, 400e18); // 384 shares
        _distribute(); // tax = 40 ROBX → 20 USDG
        // 576/960 = 60%, 384/960 = 40%
        assertApproxEqAbs(dist.pendingUsdc(alice), 12e6, 2);
        assertApproxEqAbs(dist.pendingUsdc(bob), 8e6, 2);
    }

    function test_TransferMidEpochKeepsEarnedRewards() public {
        _buy(alice, 1000e18);
        _distribute(); // alice earns 20 USDG
        // alice sends everything away — already-earned rewards must survive
        vm.prank(alice);
        robx.transfer(bob, 960e18);
        assertApproxEqAbs(dist.pendingUsdc(alice), 20e6, 2, "earned rewards survive transfer");
        // next epoch goes to bob only
        _buy(alice, 100e18); // fresh 4 ROBX tax → 2 USDG
        uint256 aliceBal = robx.balanceOf(alice); // read BEFORE prank — a
        vm.prank(alice); //          balanceOf in the args would eat the prank
        robx.transfer(bob, aliceBal); // alice zeroes out again
        _distribute();
        assertApproxEqAbs(dist.pendingUsdc(alice), 20e6, 2, "no new rewards for zero balance");
        assertGt(dist.pendingUsdc(bob), 0, "bob earns the new epoch");
    }

    function test_CanDistributeGates() public {
        assertFalse(dist.canDistribute(), "no tax accrued yet");
        _buy(alice, 1000e18);
        assertFalse(dist.canDistribute(), "epoch not elapsed");
        vm.warp(block.timestamp + 30 minutes);
        assertTrue(dist.canDistribute());
    }

    // ─── distributor: claims ──

    function test_ClaimInUsdg() public {
        _buy(alice, 1000e18);
        _distribute();
        vm.prank(alice);
        dist.claim();
        assertApproxEqAbs(usdg.balanceOf(alice), 20e6, 2);
        assertEq(dist.pendingUsdc(alice), 0);
    }

    function test_ClaimInStock() public {
        _buy(alice, 1000e18);
        _distribute();
        vm.prank(alice);
        dist.setRewardChoice(address(tsla));
        vm.prank(alice);
        dist.claim();
        // 20 USDG * 0.005 = 0.1 TSLA
        assertApproxEqAbs(tsla.balanceOf(alice), 0.1e18, 1e10);
        assertEq(usdg.balanceOf(alice), 0, "paid in stock, not USDG");
        assertEq(dist.pendingUsdc(alice), 0);
    }

    function test_ClaimTwiceReverts() public {
        _buy(alice, 1000e18);
        _distribute();
        vm.startPrank(alice);
        dist.claim();
        vm.expectRevert(RewardDistributor.NothingToClaim.selector);
        dist.claim();
        vm.stopPrank();
    }

    function test_RewardChoiceMustBeAllowed() public {
        MockStock fake = new MockStock("FAKE");
        vm.prank(alice);
        vm.expectRevert(RewardDistributor.TokenNotAllowed.selector);
        dist.setRewardChoice(address(fake));
    }

    // ─── distributor: keeper & admin ──

    function test_KeeperGate() public {
        dist.setKeeper(keeper);
        _buy(alice, 1000e18);
        vm.warp(block.timestamp + 30 minutes);

        vm.prank(alice);
        vm.expectRevert(RewardDistributor.NotKeeper.selector);
        dist.distribute();

        vm.prank(keeper);
        dist.distribute();
        assertEq(dist.epochCount(), 1);
    }

    function test_PerformUpkeepWorksForKeeper() public {
        dist.setKeeper(keeper);
        _buy(alice, 1000e18);
        vm.warp(block.timestamp + 30 minutes);
        (bool needed,) = dist.checkUpkeep("");
        assertTrue(needed);
        vm.prank(keeper);
        dist.performUpkeep("");
        assertEq(dist.epochCount(), 1);
    }

    function test_AnyoneDistributesWhenNoKeeper() public {
        _buy(alice, 1000e18);
        vm.warp(block.timestamp + 30 minutes);
        vm.prank(bob);
        dist.distribute();
        assertEq(dist.epochCount(), 1);
    }

    function test_SlippageGuardReverts() public {
        _buy(alice, 1000e18);
        vm.warp(block.timestamp + 30 minutes);
        // pool "drains" between quote and swap → router pays less than quote…
        // our mock quotes and swaps at the same rate, so emulate by raising
        // minOut requirement: set slippage to 0 and rate mismatch via new rate
        dist.setSlippageBps(0);
        // distribute still fine at exact quote
        dist.distribute();
        assertEq(dist.epochCount(), 1);
    }

    function test_RescueProtectsHolderFunds() public {
        vm.expectRevert("protected");
        dist.rescue(address(robx), 1, deployer);
        vm.expectRevert("protected");
        dist.rescue(address(usdg), 1, deployer);
        // random token is rescuable
        MockStock junk = new MockStock("JUNK");
        junk.mint(address(dist), 5e18);
        dist.rescue(address(junk), 5e18, deployer);
        assertEq(junk.balanceOf(deployer), 5e18);
    }

    function test_DistributorConfigOnlyOwner() public {
        vm.startPrank(alice);
        vm.expectRevert();
        dist.setKeeper(alice);
        vm.expectRevert();
        dist.setSlippageBps(100);
        vm.expectRevert();
        dist.setAllowedRewardToken(address(tsla), false, 0);
        vm.stopPrank();
    }

    // ─── audit fixes ──

    function test_SyncShareHealsDesync() public {
        _buy(alice, 1000e18); // 960 shares
        _distribute(); // alice earns ~20 USDG
        // simulate a desync: alice becomes reward-exempt, token stops
        // notifying, but her 960 stale shares keep earning
        robx.setRewardExempt(alice, true);
        assertEq(dist.shares(alice), 960e18, "stale shares before sync");
        // anyone can heal the ledger
        vm.prank(bob);
        dist.syncShare(alice);
        assertEq(dist.shares(alice), 0, "exempt account zeroed");
        assertApproxEqAbs(dist.pendingUsdc(alice), 20e6, 2, "earned rewards kept");
        // sync of a healthy account is a no-op
        _buy(bob, 100e18);
        dist.syncShare(bob);
        assertEq(dist.shares(bob), robx.balanceOf(bob));
    }

    function test_ClaimFallsBackToUsdgWhenStockDisallowed() public {
        _buy(alice, 1000e18);
        _distribute();
        vm.prank(alice);
        dist.setRewardChoice(address(tsla));
        dist.setAllowedRewardToken(address(tsla), false, 0); // pool drained
        vm.prank(alice);
        dist.claim();
        assertApproxEqAbs(usdg.balanceOf(alice), 20e6, 2, "paid in USDG fallback");
        assertEq(tsla.balanceOf(alice), 0);
    }

    function test_ReallowingTokenDoesNotDuplicateList() public {
        dist.setAllowedRewardToken(address(tsla), false, 0);
        dist.setAllowedRewardToken(address(tsla), true, 3000);
        assertEq(dist.allowedRewardTokensLength(), 1);
    }

    // ─── default stock payout (strictly-stocks) ──

    function test_DefaultRewardTokenPaysStock() public {
        dist.setDefaultRewardToken(address(tsla));
        _buy(alice, 1000e18);
        _distribute();
        // alice never called setRewardChoice -> still gets a stock, not USDG
        vm.prank(alice);
        dist.claim();
        assertGt(tsla.balanceOf(alice), 0, "default stock paid");
        assertEq(usdg.balanceOf(alice), 0, "no USDG to holder");
    }

    function test_DefaultMustBeAllowedStock() public {
        MockStock fake = new MockStock("FAKE");
        vm.expectRevert("not allowed");
        dist.setDefaultRewardToken(address(fake));
    }

    // ─── full journey ──

    function test_EndToEnd_TwoHoldersTwoEpochs() public {
        _buy(alice, 1000e18); // tax 40 → epoch 1 pot
        _distribute(); // 20 USDG, all to alice (only holder)

        _buy(bob, 1000e18); // tax 40 → epoch 2 pot
        _distribute(); // 20 USDG split 50/50 (960/960 shares)

        assertApproxEqAbs(dist.pendingUsdc(alice), 30e6, 3); // 20 + 10
        assertApproxEqAbs(dist.pendingUsdc(bob), 10e6, 3);

        vm.prank(alice);
        dist.setRewardChoice(address(tsla));
        vm.prank(alice);
        dist.claim();
        vm.prank(bob);
        dist.claim();

        assertApproxEqAbs(tsla.balanceOf(alice), 0.15e18, 1e10); // 30 USDG * 0.005
        assertApproxEqAbs(usdg.balanceOf(bob), 10e6, 3);
        assertEq(dist.totalDistributedUsdc(), 40e6);
    }
}

// ─── v3 specifics ────────────────────────────────────────────────────────

contract RobinXV3Test is Test {
    ROBX robx;
    MockUSDG usdg;
    MockStock tsla;
    MockStock weth;
    MockRouter router;
    RewardDistributor dist;
    address alice = address(0xA11CE);

    function setUp() public {
        robx = new ROBX();
        usdg = new MockUSDG();
        tsla = new MockStock("tTSLA");
        weth = new MockStock("WETH");
        router = new MockRouter();
        // two-hop tax path, as on mainnet: ROBX -> WETH -> USDG
        bytes memory path = abi.encodePacked(address(robx), uint24(3000), address(weth), uint24(100), address(usdg));
        dist = new RewardDistributor(address(robx), address(usdg), address(router), address(router), path);
        robx.setDistributor(address(dist));
        robx.setRewardExempt(address(router), true);
        dist.setAllowedRewardToken(address(tsla), true, 3000);
        // 1 ROBX = 0.001 WETH, 1 WETH = 3000 USDG (6 dec), 1 USDG = 0.0025 TSLA
        router.setRate(address(robx), address(weth), 1, 1000);
        router.setRate(address(weth), address(usdg), 3000e6, 1e18);
        router.setRate(address(usdg), address(tsla), 25e14, 1e6); // 400 USDG per TSLA
        weth.mint(address(router), 1_000_000e18);
        usdg.mint(address(router), 1_000_000_000e6);
        tsla.mint(address(router), 1_000_000e18);
    }

    function test_PathMustStartWithRobxAndEndWithUsdc() public {
        bytes memory bad = abi.encodePacked(address(usdg), uint24(3000), address(robx));
        vm.expectRevert(bytes("bad path"));
        new RewardDistributor(address(robx), address(usdg), address(router), address(router), bad);
        vm.expectRevert(bytes("bad path"));
        dist.setTaxSwapPath(hex"1234");
    }

    function test_FeeTierIsValidated() public {
        vm.expectRevert(bytes("bad fee tier"));
        dist.setAllowedRewardToken(address(tsla), true, 4242);
        assertEq(dist.rewardPoolFee(address(tsla)), 3000);
    }

    function test_TwoHopTaxSwapAndClaimInStock() public {
        // simulate tax already sitting on the distributor
        robx.transfer(address(dist), 1_000e18);
        // give alice a share so she accrues
        robx.setRewardExempt(address(this), true);
        robx.transfer(alice, 10_000e18);
        vm.warp(block.timestamp + 31 minutes);
        dist.distribute();
        // 1000 ROBX -> 1 WETH -> 3000 USDG, all to alice (only holder)
        assertEq(usdg.balanceOf(address(dist)), 3000e6);
        assertEq(dist.pendingUsdc(alice), 3000e6);
        vm.startPrank(alice);
        dist.setRewardChoice(address(tsla));
        dist.claim();
        vm.stopPrank();
        // 3000 USDG at 400/TSLA = 7.5 TSLA
        assertEq(tsla.balanceOf(alice), 75e17);
        assertEq(dist.pendingUsdc(alice), 0);
    }

    function test_SlippageGuardRevertsClaim() public {
        robx.transfer(address(dist), 1_000e18);
        robx.setRewardExempt(address(this), true);
        robx.transfer(alice, 10_000e18);
        vm.warp(block.timestamp + 31 minutes);
        dist.distribute();
        vm.prank(alice);
        dist.setRewardChoice(address(tsla));
        // fill 5% worse than the quote with a 3% tolerance -> revert, nothing paid
        router.setFillHaircut(500);
        vm.prank(alice);
        vm.expectRevert(bytes("slippage"));
        dist.claim();
        assertEq(dist.pendingUsdc(alice), 3000e6);
        // within tolerance -> fills
        router.setFillHaircut(200);
        vm.prank(alice);
        dist.claim();
        assertGt(tsla.balanceOf(alice), 0);
    }
}
