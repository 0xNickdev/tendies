// Chain wiring: provider, keeper wallet, contract instances, ABIs, and read
// helpers. ROBX/USDG addresses are read from the distributor so the only
// required env is DISTRIBUTOR.

import { ethers } from "ethers";
import { config } from "./config.js";

const DIST_ABI = [
  "function robx() view returns (address)",
  "function usdc() view returns (address)",
  "function canDistribute() view returns (bool)",
  "function distribute()",
  "function lastDistribution() view returns (uint256)",
  "function epochInterval() view returns (uint256)",
  "function epochCount() view returns (uint256)",
  "function totalDistributedUsdc() view returns (uint256)",
  "function totalShares() view returns (uint256)",
  "function minTaxSwapAmount() view returns (uint256)",
  "function shares(address) view returns (uint256)",
  "function syncShare(address account)",
  "function allowedRewardTokensLength() view returns (uint256)",
  "function allowedRewardTokens(uint256) view returns (address)",
];

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];

export const provider = new ethers.JsonRpcProvider(config.rpcUrl);
export const wallet = new ethers.Wallet(config.keeperKey, provider);
export const distributor = new ethers.Contract(config.distributor, DIST_ABI, wallet);

// Resolved once at boot.
export const chain = {
  robx: null, // ethers.Contract (read-only)
  usdg: null, // ethers.Contract (read-only)
  usdgDecimals: 6,
  usdgSymbol: "USDG",
};

export async function initChain() {
  const [robxAddr, usdgAddr] = await Promise.all([
    distributor.robx(),
    distributor.usdc(),
  ]);
  chain.robx = new ethers.Contract(robxAddr, ERC20_ABI, provider);
  chain.usdg = new ethers.Contract(usdgAddr, ERC20_ABI, provider);
  try {
    chain.usdgDecimals = Number(await chain.usdg.decimals());
    chain.usdgSymbol = await chain.usdg.symbol();
  } catch {
    /* keep defaults */
  }
  return { robxAddr, usdgAddr };
}

export async function gasBalanceEth() {
  const bal = await provider.getBalance(wallet.address);
  return Number(ethers.formatEther(bal));
}
