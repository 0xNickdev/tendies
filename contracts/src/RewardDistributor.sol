// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IROBXToken {
    function isRewardExempt(address account) external view returns (bool);
}

interface IUniswapV2Router {
    function getAmountsOut(
        uint256 amountIn,
        address[] calldata path
    ) external view returns (uint256[] memory amounts);

    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external;

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

/// @title RewardDistributor — RobinX treasury & stock rewards
/// @notice Receives the ROBX trade tax, converts it to USDC once per epoch
///         (every 30 minutes, keeper-triggered), and accrues it to holders
///         pro-rata with O(1) accounting. Holders claim in the tokenized
///         stock of their choice (tTSLA / tNVDA / tSPCX — swapped at claim
///         time) or in USDC.
/// @dev    Share ledger is driven by the ROBX token via setShare() hooks.
///         Classic accumulator pattern: no loops over holders, ever.
contract RewardDistributor is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 private constant ACC_PRECISION = 1e36;

    IERC20 public immutable robx;
    IERC20 public immutable usdc;
    IUniswapV2Router public router;

    // ── epochs ──
    uint256 public epochInterval = 30 minutes;
    uint256 public lastDistribution;
    uint256 public epochCount;

    // ── share ledger (mirrors ROBX balances of non-exempt holders) ──
    uint256 public totalShares;
    mapping(address => uint256) public shares;

    // ── reward accounting (accrued in USDC) ──
    uint256 public accUsdcPerShare; // scaled by ACC_PRECISION
    mapping(address => uint256) public rewardDebt; // accumulator checkpoint
    mapping(address => uint256) public owedUsdc; // credited but unclaimed
    uint256 public totalDistributedUsdc;

    // ── payout choice ──
    // Rewards pay out strictly in tokenized stocks. Each holder picks one;
    // holders who never pick get `defaultRewardToken`. USDG is NEVER a normal
    // payout — it's only a last-resort so a claim can't brick if every stock
    // route is temporarily unavailable (drained/delisted pool).
    mapping(address => address) public rewardChoice; // 0 = use default
    address public defaultRewardToken; // stock paid to holders who didn't pick
    mapping(address => bool) public isAllowedRewardToken; // tTSLA, tNVDA, tSPCX…
    mapping(address => bool) private _everListed;
    address[] public allowedRewardTokens;

    // ── swap config ──
    address[] public taxSwapPath; // ROBX → … → USDC
    uint256 public slippageBps = 300; // 3% max slippage on swaps
    uint256 public minTaxSwapAmount = 1e18; // don't waste gas on dust

    address public keeper; // Chainlink Automation / Gelato executor (0 = anyone)

    event Distributed(uint256 indexed epoch, uint256 usdcAmount, uint256 totalShares);
    event Claimed(address indexed account, address indexed rewardToken, uint256 usdcValue, uint256 amountOut);
    event RewardChoiceSet(address indexed account, address rewardToken);
    event RewardTokenAllowed(address token, bool allowed);
    event ShareSet(address indexed account, uint256 share);

    error NotToken();
    error EpochNotReady();
    error NotKeeper();
    error TokenNotAllowed();
    error NothingToClaim();

    constructor(
        address robx_,
        address usdc_,
        address router_,
        address[] memory taxSwapPath_
    ) Ownable(msg.sender) {
        require(robx_ != address(0) && usdc_ != address(0) && router_ != address(0), "zero addr");
        require(
            taxSwapPath_.length >= 2 &&
                taxSwapPath_[0] == robx_ &&
                taxSwapPath_[taxSwapPath_.length - 1] == usdc_,
            "bad path"
        );
        robx = IERC20(robx_);
        usdc = IERC20(usdc_);
        router = IUniswapV2Router(router_);
        taxSwapPath = taxSwapPath_;
        lastDistribution = block.timestamp;
    }

    // ─── share ledger (called by the ROBX token on every transfer) ───────

    function setShare(address account, uint256 balance) external {
        if (msg.sender != address(robx)) revert NotToken();
        _writeShare(account, balance);
    }

    /// @notice Permissionless re-sync against the true token balance. Heals
    ///         any ledger desync — e.g. a share-sync hook starved of gas via
    ///         the 63/64 rule (an attacker could otherwise sell tokens while
    ///         keeping stale shares). Anyone may call for any account.
    function syncShare(address account) external {
        bool exempt = IROBXToken(address(robx)).isRewardExempt(account);
        uint256 balance = exempt ? 0 : robx.balanceOf(account);
        _writeShare(account, balance);
    }

    function _writeShare(address account, uint256 balance) private {
        _creditPending(account);
        totalShares = totalShares - shares[account] + balance;
        shares[account] = balance;
        rewardDebt[account] = (balance * accUsdcPerShare) / ACC_PRECISION;
        emit ShareSet(account, balance);
    }

    /// @dev Move whatever the accumulator owes into `owedUsdc` so share
    ///      changes never lose or double-count rewards.
    function _creditPending(address account) private {
        uint256 share = shares[account];
        if (share == 0) return;
        uint256 accrued = (share * accUsdcPerShare) / ACC_PRECISION;
        uint256 pending = accrued - rewardDebt[account];
        if (pending > 0) owedUsdc[account] += pending;
        rewardDebt[account] = accrued;
    }

    // ─── the 30-minute epoch ─────────────────────────────────────────────

    function canDistribute() public view returns (bool) {
        return
            block.timestamp >= lastDistribution + epochInterval &&
            robx.balanceOf(address(this)) >= minTaxSwapAmount &&
            totalShares > 0;
    }

    /// @notice Converts accumulated ROBX tax into USDC and credits all
    ///         holders in O(1). Called by the keeper every 30 minutes;
    ///         anyone may call if no keeper is set.
    function distribute() external nonReentrant {
        _checkKeeper();
        _distribute();
    }

    function _checkKeeper() private view {
        if (keeper != address(0) && msg.sender != keeper && msg.sender != owner()) {
            revert NotKeeper();
        }
    }

    function _distribute() private {
        if (block.timestamp < lastDistribution + epochInterval) revert EpochNotReady();
        lastDistribution = block.timestamp;

        uint256 taxBalance = robx.balanceOf(address(this));
        if (taxBalance < minTaxSwapAmount || totalShares == 0) return; // dust or no holders — wait

        uint256 usdcBefore = usdc.balanceOf(address(this));
        _swap(taxSwapPath, taxBalance, address(this));
        uint256 usdcReceived = usdc.balanceOf(address(this)) - usdcBefore;
        if (usdcReceived == 0) return;

        accUsdcPerShare += (usdcReceived * ACC_PRECISION) / totalShares;
        totalDistributedUsdc += usdcReceived;
        epochCount += 1;
        emit Distributed(epochCount, usdcReceived, totalShares);
    }

    // Chainlink Automation compatibility
    function checkUpkeep(bytes calldata)
        external
        view
        returns (bool upkeepNeeded, bytes memory)
    {
        return (canDistribute(), bytes(""));
    }

    function performUpkeep(bytes calldata) external nonReentrant {
        _checkKeeper();
        _distribute();
    }

    // ─── holder side ─────────────────────────────────────────────────────

    /// @notice Pick your payout stock (tTSLA / tNVDA / tSPCX). Passing
    ///         address(0) means "use the default stock". This is the button in
    ///         the Treasury tab.
    function setRewardChoice(address token) external {
        if (token != address(0) && !isAllowedRewardToken[token]) revert TokenNotAllowed();
        rewardChoice[msg.sender] = token;
        emit RewardChoiceSet(msg.sender, token);
    }

    /// @notice Stock paid to holders who never picked one. Must be an allowed
    ///         stock (or address(0) to fall back to the USDG safety net).
    function setDefaultRewardToken(address token) external onlyOwner {
        require(token == address(0) || isAllowedRewardToken[token], "not allowed");
        defaultRewardToken = token;
    }

    function pendingUsdc(address account) public view returns (uint256) {
        uint256 accrued = (shares[account] * accUsdcPerShare) / ACC_PRECISION;
        return owedUsdc[account] + accrued - rewardDebt[account];
    }

    /// @notice Claim everything you're owed, paid in your chosen stock
    ///         (swapped at claim time) or USDC.
    function claim() external nonReentrant {
        _creditPending(msg.sender);
        uint256 amount = owedUsdc[msg.sender];
        if (amount == 0) revert NothingToClaim();
        owedUsdc[msg.sender] = 0;

        // holders who never picked get the default stock
        address choice = rewardChoice[msg.sender];
        if (choice == address(0)) choice = defaultRewardToken;
        // chosen/default stock delisted or its pool drained → USDG safety net
        // so the claim can never brick (not a normal payout path)
        if (choice != address(0) && !isAllowedRewardToken[choice]) {
            choice = address(0);
        }
        if (choice == address(0)) {
            usdc.safeTransfer(msg.sender, amount);
            emit Claimed(msg.sender, address(0), amount, amount);
        } else {
            address[] memory path = new address[](2);
            path[0] = address(usdc);
            path[1] = choice;
            uint256 balBefore = IERC20(choice).balanceOf(msg.sender);
            _swap(path, amount, msg.sender);
            uint256 received = IERC20(choice).balanceOf(msg.sender) - balBefore;
            emit Claimed(msg.sender, choice, amount, received);
        }
    }

    // ─── swaps ───────────────────────────────────────────────────────────

    /// @dev Slippage-guarded swap. minOut comes from the current pool quote
    ///      minus `slippageBps`; a sandwiched or drained pool reverts.
    function _swap(address[] memory path, uint256 amountIn, address to) private {
        uint256[] memory quote = router.getAmountsOut(amountIn, path);
        uint256 minOut = (quote[quote.length - 1] * (10_000 - slippageBps)) / 10_000;
        IERC20(path[0]).forceApprove(address(router), amountIn);
        router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
            amountIn,
            minOut,
            path,
            to,
            block.timestamp
        );
    }

    // ─── owner config ────────────────────────────────────────────────────

    /// @notice Add a tokenized stock as a payout option (tHOOD, tTSLA, tTTWO…).
    ///         Requires a liquid USDC pair on the router's DEX.
    function setAllowedRewardToken(address token, bool allowed) external onlyOwner {
        require(token != address(0) && token != address(robx), "bad token");
        if (allowed && !_everListed[token]) {
            _everListed[token] = true;
            allowedRewardTokens.push(token);
        }
        isAllowedRewardToken[token] = allowed;
        emit RewardTokenAllowed(token, allowed);
    }

    function allowedRewardTokensLength() external view returns (uint256) {
        return allowedRewardTokens.length;
    }

    function setKeeper(address k) external onlyOwner {
        keeper = k;
    }

    function setEpochInterval(uint256 interval) external onlyOwner {
        require(interval >= 5 minutes && interval <= 1 days, "bad interval");
        epochInterval = interval;
    }

    function setSlippageBps(uint256 bps) external onlyOwner {
        require(bps <= 1_000, "max 10%");
        slippageBps = bps;
    }

    function setMinTaxSwapAmount(uint256 amount) external onlyOwner {
        minTaxSwapAmount = amount;
    }

    function setTaxSwapPath(address[] calldata path) external onlyOwner {
        require(
            path.length >= 2 &&
                path[0] == address(robx) &&
                path[path.length - 1] == address(usdc),
            "bad path"
        );
        taxSwapPath = path;
    }

    function setRouter(address r) external onlyOwner {
        require(r != address(0), "zero addr");
        router = IUniswapV2Router(r);
    }

    /// @notice Rescue tokens sent here by mistake. ROBX and USDC — the
    ///         holders' money — can never be rescued.
    function rescue(address token, uint256 amount, address to) external onlyOwner {
        require(token != address(robx) && token != address(usdc), "protected");
        IERC20(token).safeTransfer(to, amount);
    }
}
