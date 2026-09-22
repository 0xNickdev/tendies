// Money-path tests: accrual maths, the dollar floor, crash-safety of settling,
// and signature verification for payout choices. No network, no wallet.
//
//   node test/ledger.test.js

process.env.STATE_DIR = "./data-test";
process.env.MIN_PAYOUT_USD = "1";
process.env.FEE_TOKEN = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168"; // USDG → 1e6 units per dollar
process.env.PAYOUT_TOKENS =
  "TSLA:0x322F0929c4625eD5bAd873c95208D54E1c003b2d:3000,NVDA:0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC:500";

import fs from "node:fs";
import { ethers } from "ethers";

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
  // Fee accruing in WETH: 18 decimals, ~$4000 each, so a dollar is 0.00025 of
  // one — the case that would silently turn the $1 floor into a $4000 floor.
  const perDollar = 250_000_000_000_000n; // wei per $1
  addAccrual("RICH", 2n * perDollar); // ~$2
  addAccrual("POOR", perDollar / 2n); // ~$0.50
  saveState();
  const due = duePayouts(perDollar);
  check("группа одна", due.length, 1);
  check("платим только тому, кто выше $1", due[0].owners.length, 1);
  check("и это RICH", due[0].owners[0].owner, "RICH");
  // The old math would have used 1 * 10**18 as the floor — nobody clears that.
  check("старая формула не выплатила бы никому", duePayouts(10n ** 18n).length, 0);
}

console.log("\n3. Группировка по выбранной акции");
{
  fs.rmSync("./data-test", { recursive: true, force: true });
  loadState();
  addAccrual("AAA", 10n * USDC);
  addAccrual("BBB", 20n * USDC);
  saveState();
  check("без выбора все идут в первую акцию", payoutFor("AAA").symbol, "TSLA");
  const groups = duePayouts(USDC);
  check("одна группа", groups.length, 1);
  check("в ней оба холдера", groups[0].owners.length, 2);
  check("итог группы $30", groups[0].total, 30n * USDC);
}

console.log("\n4. Подпись выбора акции (EIP-191 personal_sign)");
{
  const kp = ethers.Wallet.createRandom();
  const owner = kp.address;
  const ts = Date.now();
  const sign = (msg, key = kp) => key.signMessage(msg);

  const good = applyChoice({ owner, symbol: "NVDA", ts, signature: await sign(choiceMessage("NVDA", ts)) });
  check("валидная подпись принята", good.ok, true);
  check("выбор применился", payoutFor(owner).symbol, "NVDA");
  check("адрес в нижнем регистре — тот же аккаунт", payoutFor(owner.toLowerCase()) === undefined, false);

  const wrongKey = ethers.Wallet.createRandom();
  const forged = applyChoice({
    owner,
    symbol: "TSLA",
    ts: ts + 1,
    signature: await sign(choiceMessage("TSLA", ts + 1), wrongKey),
  });
  check("чужая подпись отклонена", forged.ok, false);
  check("выбор не подменён", payoutFor(owner).symbol, "NVDA");

  const replay = applyChoice({ owner, symbol: "TSLA", ts, signature: await sign(choiceMessage("TSLA", ts)) });
  check("повтор старого сообщения отклонён", replay.error, "stale choice");

  const old = Date.now() - 30 * 60_000;
  const expired = applyChoice({ owner, symbol: "TSLA", ts: old, signature: await sign(choiceMessage("TSLA", old)) });
  check("просроченная подпись отклонена", expired.error?.includes("expired"), true);

  const unknown = applyChoice({ owner, symbol: "GME", ts: ts + 2, signature: await sign(choiceMessage("GME", ts + 2)) });
  check("неизвестная акция отклонена", unknown.ok, false);

  const notAddr = applyChoice({ owner: "not-an-address", symbol: "TSLA", ts: ts + 3, signature: "0x00" });
  check("не-адрес отклонён", notAddr.error, "owner is not an address");
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
    recordDelivery("AAA", { epoch: i, at: new Date().toISOString(), symbol: "TSLA",
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
