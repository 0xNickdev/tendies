// Walks the exact path the site takes: wallet signs, keeper verifies.
import { Keypair } from "@solana/web3.js";
import nacl from "tweetnacl";

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const toBase58 = (bytes) => {
  let d = [0];
  for (const b of bytes) {
    let c = b;
    for (let i = 0; i < d.length; i++) { c += d[i] << 8; d[i] = c % 58; c = (c / 58) | 0; }
    while (c > 0) { d.push(c % 58); c = (c / 58) | 0; }
  }
  let o = "";
  for (const b of bytes) { if (b === 0) o += B58[0]; else break; }
  for (let i = d.length - 1; i >= 0; i--) o += B58[d[i]];
  return o;
};

const API = "http://localhost:3344";
const kp = Keypair.generate();
const owner = kp.publicKey.toBase58();
const msg = (token, ts) => `Tendies payout choice\nstock: ${token}\nts: ${ts}`;
const sign = (m, key = kp) => toBase58(nacl.sign.detached(new TextEncoder().encode(m), key.secretKey));
const post = (body) =>
  fetch(`${API}/choice`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
const account = () => fetch(`${API}/account?owner=${owner}`).then((r) => r.json());

const ts = Date.now();
console.log("1. валидный выбор NVDAx ->", JSON.stringify(await post({ owner, symbol: "NVDAx", ts, signature: sign(msg("NVDAx", ts)) })));
const a = await account();
console.log("2. /account            -> choice:", a.choice, "| accrued:", a.accrued, "| floor: $" + a.minPayoutUsd);

const evil = Keypair.generate();
const ts2 = ts + 1;
console.log("3. подпись чужим ключом ->", JSON.stringify(await post({ owner, symbol: "TSLAx", ts: ts2, signature: sign(msg("TSLAx", ts2), evil) })));
console.log("4. реплей старого       ->", JSON.stringify(await post({ owner, symbol: "NVDAx", ts, signature: sign(msg("NVDAx", ts)) })));
console.log("5. выбор после атак     ->", (await account()).choice);
console.log("OWNER=" + owner);
