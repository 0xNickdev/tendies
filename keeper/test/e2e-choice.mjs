// Walks the exact path the site takes: wallet signs (EIP-191 personal_sign),
// keeper verifies. Needs a running keeper:
//   STATE_DIR=./data-e2e PORT=3344 node index.js &
import { ethers } from "ethers";

const API = process.env.API || "http://localhost:3344";
const kp = ethers.Wallet.createRandom();
const owner = kp.address;
const msg = (token, ts) => `RobinX payout choice\nstock: ${token}\nts: ${ts}`;
const sign = (m, key = kp) => key.signMessage(m);
const post = (body) =>
  fetch(`${API}/choice`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
const account = () => fetch(`${API}/account?owner=${owner.toLowerCase()}`).then((r) => r.json());

const ts = Date.now();
console.log("1. валидный выбор NVDA  ->", JSON.stringify(await post({ owner, symbol: "NVDA", ts, signature: await sign(msg("NVDA", ts)) })));
const a = await account();
console.log("2. /account (lowercase) -> choice:", a.choice, "| accrued:", a.accrued, "| floor: $" + a.minPayoutUsd);

const evil = ethers.Wallet.createRandom();
const ts2 = ts + 1;
console.log("3. подпись чужим ключом ->", JSON.stringify(await post({ owner, symbol: "TSLA", ts: ts2, signature: await sign(msg("TSLA", ts2), evil) })));
console.log("4. реплей старого       ->", JSON.stringify(await post({ owner, symbol: "NVDA", ts, signature: await sign(msg("NVDA", ts)) })));
console.log("5. выбор после атак     ->", (await account()).choice);
console.log("OWNER=" + owner);
