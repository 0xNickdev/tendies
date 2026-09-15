// ─── Launch configuration ────────────────────────────────────────────────
// Fill these in when the token goes live. Everything that depends on them
// shows a "TBA / Soon" state until they're set.

// ROBX ERC-20 contract address on Robinhood Chain.
// ⟵ PASTE THE TOKEN ADDRESS HERE when deployed (enables wallet balance reads)
export const ROBX_TOKEN_ADDRESS = "";

// Where "Buy ROBX" sends people (Uniswap on Robinhood Chain).
// ⟵ PASTE THE REAL SWAP LINK HERE when the pool is live, e.g.
//    https://app.uniswap.org/swap?chain=robinhood&outputCurrency=<ROBX_TOKEN_ADDRESS>
export const BUY_ROBX_URL = "https://app.uniswap.org/swap";

// ─── Robinhood Chain mainnet (verified on-chain) ──────────────────────────
export const ROBINHOOD_CHAIN = {
  chainId: 4663,
  chainIdHex: "0x1237", // 4663
  chainName: "Robinhood Chain",
  rpcUrls: ["https://rpc.mainnet.chain.robinhood.com"],
  blockExplorerUrls: ["https://robinhoodchain.blockscout.com"],
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
} as const;

// RewardDistributor contract — where the 4% tax lands and where holders read
// their accrued rewards, pick a stock and claim. ⟵ PASTE AFTER DEPLOY.
export const DISTRIBUTOR_ADDRESS = "";

// Treasury numbers the site shows come from the keeper's /status. Blank hides
// them until the keeper is deployed.
export const KEEPER_URL = (() => {
  const raw = (process.env.NEXT_PUBLIC_KEEPER_URL ?? "").trim();
  if (!raw) return "";
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withScheme.replace(/\/+$/, "");
})();


export const explorerAccount = (address: string) =>
  `${ROBINHOOD_CHAIN.blockExplorerUrls[0]}/address/${address}`;
export const explorerTx = (hash: string) =>
  `${ROBINHOOD_CHAIN.blockExplorerUrls[0]}/tx/${hash}`;
