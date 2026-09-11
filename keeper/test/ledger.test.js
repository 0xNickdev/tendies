// Money-path tests: accrual maths, the dollar floor, crash-safety of settling,
// and signature verification for payout choices. No network, no wallet.
//
//   node test/ledger.test.js

process.env.STATE_DIR = "./data-test";
process.env.MIN_PAYOUT_USD = "1";
process.env.PAYOUT_MINTS = "TSLAx:Mint1111111111111111111111111111111111111,NVDAx:Mint2222222222222222222222222222222222222";

import fs from "node:fs";
import { Keypair } from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";

fs.rmSync("./data-test", { recursive: true, force: true });

const {
  loadState, addAccrual, accruedOf, totalAccrued, settle, saveState,
  markPresent, recordDelivery, profileOf,
} = await import("../src/store.js");
const { duePayouts, payoutFor } = await import("../src/payout.js");
const { applyChoice, choiceMessage } = await import("../src/choice.js");

loadState();

let failed = 0;
const check = (name, got, want) => {
  const ok = String(got) === String(want);
  console.log(`  ${ok ? "✓" : "✗"} ${name}${ok ? "" : `  got ${got}, want ${want}`}`);
  if (!ok) failed++;
};

const USDC = 10n ** 6n;
// the keeper's accrual formula, verbatim
const cut = (fee, share) => (fee * BigInt(Math.round(share * 1e9))) / 1_000_000_000n;

console.log("\n1. Начисление по долям");
{
  const fee = 100n * USDC; // $100 arrives
  const holders = [
    { owner: "AAA", share: 0.5 },
    { owner: "BBB", share: 0.3 },
    { owner: "CCC", share: 0.2 },
  ];
  for (const h of holders) addAccrual(h.owner, cut(fee, h.share));
  saveState();
  check("держатель 50% получил $50", accruedOf("AAA"), 50n * USDC);
  check("держатель 30% получил $30", accruedOf("BBB"), 30n * USDC);
  check("сумма начислений = комиссии", totalAccrued(), fee);
}

console.log("\n2. Долларовый порог: пыль копится, а не выплачивается");
{
  fs.rmSync("./data-test", { recursive: true, force: true });
  loadState();
  const smallFee = 30n * USDC / 100n; // $0.30 per epoch
  for (let epoch = 1; epoch <= 3; epoch++) {
    addAccrual("DUST", cut(smallFee, 1.0));
  }
  saveState();
  check("после 3 эпох накоплено $0.90", accruedOf("DUST"), 90n * USDC / 100n);
  check("к выплате никого (ниже $1)", duePayouts(USDC).length, 0);

  addAccrual("DUST", cut(smallFee, 1.0)); // 4th epoch → $1.20
  saveState();
  const due = duePayouts(USDC);
  check("после 4-й эпохи выплата созрела", due.length, 1);
  check("сумма к выплате $1.20", due[0].total, 120n * USDC / 100n);
}

console.log("\n2b. Порог считается в долларах, а не в единицах fee-токена");
{
  fs.rmSync("./data-test", { recursive: true, force: true });
  loadState();
  // Fee accruing in TSLAx: 8 decimals, ~$363 each, so a dollar is ~0.00275 of
  // one — the case that silently turned the $1 floor into a $363 floor.
  const perDollar = 274_247n; // raw TSLAx units per $1
  addAccrual("RICH", 2n * perDollar); // ~$2
  addAccrual("POOR", perDollar / 2n); // ~$0.50
  saveState();
  const due = duePayouts(perDollar);
  check("группа одна", due.length, 1);
  check("платим только тому, кто выше $1", due[0].owners.length, 1);
  check("и это RICH", due[0].owners[0].owner, "RICH");
  // The old math would have used 1 * 10**8 as the floor — nobody clears that.
  check("старая формула не выплатила бы никому", duePayouts(10n ** 8n).length, 0);
}

console.log("\n3. Группировка по выбранной акции");
{
  fs.rmSync("./data-test", { recursive: true, force: true });
  loadState();
  addAccrual("AAA", 10n * USDC);
  addAccrual("BBB", 20n * USDC);
  saveState();
  check("без выбора все идут в первую акцию", payoutFor("AAA").symbol, "TSLAx");
  const groups = duePayouts(USDC);
  check("одна группа", groups.length, 1);
  check("в ней оба холдера", groups[0].owners.length, 2);
  check("итог группы $30", groups[0].total, 30n * USDC);
}

console.log("\n4. Подпись выбора акции");
{
  const kp = Keypair.generate();
  const owner = kp.publicKey.toBase58();
  const ts = Date.now();
  const sign = (msg, key = kp) =>
    bs58.encode(nacl.sign.detached(new TextEncoder().encode(msg), key.secretKey));

  const good = applyChoice({ owner, symbol: "NVDAx", ts, signature: sign(choiceMessage("NVDAx", ts)) });
  check("валидная подпись принята", good.ok, true);
  check("выбор применился", payoutFor(owner).symbol, "NVDAx");

  const wrongKey = Keypair.generate();
  const forged = applyChoice({
    owner,
    symbol: "TSLAx",
    ts: ts + 1,
    signature: sign(choiceMessage("TSLAx", ts + 1), wrongKey),
  });
  check("чужая подпись отклонена", forged.ok, false);
  check("выбор не подменён", payoutFor(owner).symbol, "NVDAx");

  const replay = applyChoice({ owner, symbol: "TSLAx", ts, signature: sign(choiceMessage("TSLAx", ts)) });
  check("повтор старого сообщения отклонён", replay.error, "stale choice");

  const old = Date.now() - 30 * 60_000;
  const expired = applyChoice({ owner, symbol: "TSLAx", ts: old, signature: sign(choiceMessage("TSLAx", old)) });
  check("просроченная подпись отклонена", expired.error?.includes("expired"), true);

  const unknown = applyChoice({ owner, symbol: "GMEx", ts: ts + 2, signature: sign(choiceMessage("GMEx", ts + 2)) });
  check("неизвестная акция отклонена", unknown.ok, false);
}

console.log("\n5. Расчёт после подтверждения (защита от двойной выплаты)");
{
  fs.rmSync("./data-test", { recursive: true, force: true });
  loadState();
  addAccrual("AAA", 10n * USDC);
  addAccrual("BBB", 20n * USDC);
  saveState();
  settle(["AAA"]); // batch 1 confirmed, then imagine the process dies
  loadState(); // restart from disk
  check("выплаченному обнулили долг", accruedOf("AAA"), 0n);
  check("невыплаченный долг уцелел", accruedOf("BBB"), 20n * USDC);
}

console.log("\n6. Стрик считается по присутствию в эпохах");
{
  fs.rmSync("./data-test", { recursive: true, force: true });
  loadState();
  markPresent(["AAA", "BBB"], 1);
  markPresent(["AAA", "BBB"], 2);
  markPresent(["AAA"], 3);          // BBB продал и выпал
  markPresent(["AAA", "BBB"], 4);   // BBB вернулся — стрик с нуля
  saveState();
  check("непрерывный холдер: стрик 4", profileOf("AAA").streak, 4);
  check("выпадавший: стрик сброшен в 1", profileOf("BBB").streak, 1);
  check("эпох в системе у AAA", profileOf("AAA").lastEpoch - profileOf("AAA").firstEpoch + 1, 4);
}

console.log("\n7. Выплаченное копится, история ограничена");
{
  fs.rmSync("./data-test", { recursive: true, force: true });
  loadState();
  for (let i = 1; i <= 30; i++) {
    recordDelivery("AAA", { epoch: i, at: new Date().toISOString(), symbol: "TSLAx",
      amount: "1", paidRaw: (2n * USDC).toString(), signature: "sig" + i });
  }
  saveState();
  check("итого выплачено $60", profileOf("AAA").totalPaid, (60n * USDC).toString());
  check("история обрезана до 25", profileOf("AAA").payouts.length, 25);
  check("новейшая запись первая", profileOf("AAA").payouts[0].epoch, 30);
}

fs.rmSync("./data-test", { recursive: true, force: true });
console.log(failed ? `\n✗ провалено проверок: ${failed}\n` : "\n✓ все проверки пройдены\n");
process.exit(failed ? 1 : 0);
