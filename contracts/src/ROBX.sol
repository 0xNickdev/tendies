// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IRewardDistributor {
    function setShare(address account, uint256 balance) external;
}

/// @title ROBX — RobinX token
/// @notice ERC-20 with a tax on DEX buys/sells (the "tithe"). Tax is sent to
///         the RewardDistributor, which converts it and pays holders in
///         tokenized stocks every 30 minutes. Wallet-to-wallet transfers are
///         tax-free. Supply is fixed — no mint function exists after deploy.
contract ROBX is ERC20, Ownable {
    uint256 public constant TOTAL_SUPPLY = 100_000_000e18;
    uint256 public constant MAX_TAX_BPS = 500; // hard cap: tax can never exceed 5%

    uint256 public taxBps = 400; // 4% on buys and sells
    IRewardDistributor public distributor;

    mapping(address => bool) public isMarketPair; // DEX pairs → transfers taxed
    mapping(address => bool) public isTaxExempt; // treasury / router / deployer
    mapping(address => bool) public isRewardExempt; // pairs & contracts earn no rewards

    event TaxTaken(address indexed from, address indexed to, uint256 amount);
    event DistributorSet(address distributor);
    event MarketPairSet(address pair, bool isPair);
    event TaxBpsSet(uint256 bps);
    event TaxExemptSet(address account, bool exempt);
    event RewardExemptSet(address account, bool exempt);

    constructor() ERC20("RobinX", "ROBX") Ownable(msg.sender) {
        isTaxExempt[msg.sender] = true;
        isRewardExempt[msg.sender] = true;
        isRewardExempt[address(this)] = true;
        isRewardExempt[address(0)] = true;
        _mint(msg.sender, TOTAL_SUPPLY);
    }

    // ─── owner wiring ────────────────────────────────────────────────────

    function setDistributor(address d) external onlyOwner {
        distributor = IRewardDistributor(d);
        isTaxExempt[d] = true;
        isRewardExempt[d] = true;
        emit DistributorSet(d);
    }

    function setMarketPair(address pair, bool isPair) external onlyOwner {
        isMarketPair[pair] = isPair;
        // pairs must never accrue holder rewards
        isRewardExempt[pair] = true;
        emit MarketPairSet(pair, isPair);
    }

    /// @notice Tax can be lowered or raised, but never above the 5% hard cap.
    function setTaxBps(uint256 bps) external onlyOwner {
        require(bps <= MAX_TAX_BPS, "ROBX: tax above cap");
        taxBps = bps;
        emit TaxBpsSet(bps);
    }

    function setTaxExempt(address account, bool exempt) external onlyOwner {
        isTaxExempt[account] = exempt;
        emit TaxExemptSet(account, exempt);
    }

    function setRewardExempt(address account, bool exempt) external onlyOwner {
        isRewardExempt[account] = exempt;
        emit RewardExemptSet(account, exempt);
    }

    // ─── transfer logic ──────────────────────────────────────────────────

    function _update(address from, address to, uint256 value) internal override {
        // mint/burn or exempt parties → plain transfer
        bool taxed = from != address(0) &&
            to != address(0) &&
            (isMarketPair[from] || isMarketPair[to]) && // buy or sell
            !isTaxExempt[from] &&
            !isTaxExempt[to] &&
            taxBps > 0 &&
            address(distributor) != address(0);

        if (taxed) {
            uint256 tax = (value * taxBps) / 10_000;
            super._update(from, address(distributor), tax);
            super._update(from, to, value - tax);
            emit TaxTaken(from, to, tax);
        } else {
            super._update(from, to, value);
        }

        _notifyShares(from);
        _notifyShares(to);
    }

    /// @dev Keeps the distributor's share ledger in sync. try/catch so a
    ///      distributor bug can never brick token transfers.
    function _notifyShares(address account) private {
        if (
            account == address(0) ||
            isRewardExempt[account] ||
            address(distributor) == address(0)
        ) return;
        try distributor.setShare(account, balanceOf(account)) {} catch {}
    }
}
