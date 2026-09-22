// ─── Launch configuration ────────────────────────────────────────────────
// Fill these in when the token goes live. Everything that depends on them
// shows a "TBA / Soon" state until they're set.

// ROBX ERC-20 contract address on Robinhood Chain.
// ⟵ PASTE THE TOKEN ADDRESS HERE when deployed (enables wallet balance reads)
export const ROBX_TOKEN_ADDRESS = "";

// Where "Buy ROBX" sends people — the Pons token page once it exists, e.g.
//    https://www.ponsfamily.com/token/<ROBX_TOKEN_ADDRESS>
// ⟵ PASTE THE REAL LINK HERE when the pool is live.
export const BUY_ROBX_URL = "https://www.ponsfamily.com/launchpad";

// ─── Robinhood Chain mainnet (verified on-chain) ──────────────────────────
export const ROBINHOOD_CHAIN = {
  chainId: 4663,
  chainIdHex: "0x1237", // 4663
  chainName: "Robinhood Chain",
  rpcUrls: ["https://rpc.mainnet.chain.robinhood.com"],
  blockExplorerUrls: ["https://robinhoodchain.blockscout.com"],
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
} as const;

// Where ROBX launches: the Pons launchpad on Robinhood Chain. Pons mints the
// token, seeds the v3 pool and locks the LP; 70% of the 1% pool fee goes to
// the treasury, which the keeper distributes. No contract of ours on chain.
export const PONS_URL = "https://www.ponsfamily.com/launchpad";

// The keeper (keeper/) is the treasury: it accrues the Pons creator fee to
// holders and pays them in stocks. The site reads /status and /account from
// it; blank hides those numbers and keeps perps in preview.
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
