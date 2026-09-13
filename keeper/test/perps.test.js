// Perps engine tests: margin comes out of the ledger and goes back with PnL,
// locked margin still counts as owed, liquidation returns nothing, funding
// accrues per interval, limits and signatures are enforced. No network: the
// fee token is USDC so a dollar is a dollar.
//
//   node test/perps.test.js

process.env.STATE_DIR = "./data-test-perps";
process.env.FEE_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; // USDC → 1e6 units per dollar
process.env.PAYOUT_MINTS =
  "OPENAI:PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF,TSLAx:XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB";
process.env.PERPS_DRYRUN_RESERVE_USD = "200"; // stand-in house bankroll for limits
process.env.PERPS_MAX_LEVERAGE = "10";
process.env.PERPS_MAX_POSITION_PCT = "50"; // $100 max size
process.env.PERPS_MAX_OI_PCT = "250"; // $500 max open interest
process.env.PERPS_FUNDING_BPS = "5";
process.env.PERPS_FUNDING_INTERVAL_MS = String(8 * 3_600_000);

import fs from "node:fs";
import { Keypair } from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";

fs.rmSync("./data-test-perps", { recursive: true, force: true });

const { loadState, addAccrual, accruedOf, totalAccrued, lockedMargin, setMarks, allPositions, positionHistoryOf, adjustReserve, reserveOf } =
  await import("../src/store.js");
const { openPosition, closePosition, openMessage, closeMessage, tickPositions, view } =
  await import("../src/perps.js");
const { markets } = await import("../src/oracle.js");
const { splitNewFee } = await import("../src/keeper.js");

loadState();

let failed = 0;
const check = (name, got, want) => {
  const ok = String(got) === String(want);
  console.log(`  ${ok ? "✓" : "✗"} ${name}${ok ? "" : `  got ${got}, want ${want}`}`);
  if (!ok) failed++;
};

const USDC = 10n ** 6n;
const trader = Keypair.generate();
const owner = trader.publicKey.toBase58();
const sign = (msg, kp = trader) =>
  bs58.encode(nacl.sign.detached(new TextEncoder().encode(msg), kp.secretKey));

const mark = (symbol, price) =>
  setMarks([{ symbol, price, at: new Date().toISOString(), source: "test", signature: null }]);

const open = async (fields, kp = trader) => {
  const ts = Date.now();
  const body = { owner, ts, ...fields };
  body.signature = sign(openMessage({ ...body, leverage: body.leverage, marginUsd: body.marginUsd }), kp);
  return openPosition(body);
};
const close = async (id, kp = trader) => {
  const ts = Date.now();
  return closePosition({ owner, id, ts, signature: sign(closeMessage({ id, ts }), kp) });
};

console.log("\n1. Рынки из PAYOUT_MINTS");
{
  const m = markets();
  check("два рынка", m.length, 2);
  check("OPENAI — on-chain", `${m[0].market}/${m[0].listed}`, "OPENAI/false");
  check("TSLAx → TSLA, биржевой", `${m[1].market}/${m[1].listed}`, "TSLA/true");
}

console.log("\n2. Открытие: маржа уходит из леджера, но остаётся в owed");
{
  addAccrual(owner, 50n * USDC); // holder is owed $50
  adjustReserve(100n * USDC); // the house holds $100 for wins
  mark("OPENAI", 1000);
  const r = await open({ market: "OPENAI", side: "long", leverage: 5, marginUsd: 20 });
  check("открыто", r.ok, true);
  check("size = margin × leverage", r.position.sizeUsd, 100);
  check("entry = mark", r.position.entry, 1000);
  check("в леджере осталось $30", accruedOf(owner), 30n * USDC);
  check("залочено $20", lockedMargin(), 20n * USDC);
  check("итого owed по-прежнему $50", totalAccrued(), 50n * USDC);
  check("liq price для лонга ×5 при 95%: 1000 × (1 − 0.19)", r.position.liqPrice, 810);
}

console.log("\n3. Закрытие с прибылью: маржа + PnL возвращаются в леджер");
{
  const [pos] = allPositions();
  mark("OPENAI", 1100); // +10% on $100 size = +$10
  check("unrealised pnl $10", view(pos).pnlUsd, 10);
  const r = await close(pos.id);
  check("закрыто", r.ok, true);
  check("pnl записан", r.position.pnlUsd, 10);
  check("возвращено $30", r.position.returnedUsd, 30);
  check("леджер $60", accruedOf(owner), 60n * USDC);
  check("выигрыш $10 взят из резерва: 100 → 90", reserveOf(), 90n * USDC);
  check("ничего не залочено", lockedMargin(), 0n);
  check("в истории", positionHistoryOf(owner).length, 1);
}

console.log("\n4. Ликвидация: трейдер не получает ничего");
{
  mark("OPENAI", 1000);
  const r = await open({ market: "OPENAI", side: "short", leverage: 10, marginUsd: 10 }); // size $100
  check("открыт шорт", r.ok, true);
  check("леджер $50", accruedOf(owner), 50n * USDC);
  mark("OPENAI", 1050); // +5% → short loses $5 = 50% of margin, survives
  await tickPositions();
  check("жив при −50%", allPositions().length, 1);
  mark("OPENAI", 1096); // +9.6% → loses $9.60 = 96% ≥ 95%
  await tickPositions();
  check("ликвидирован", allPositions().length, 0);
  const last = positionHistoryOf(owner)[0];
  check("причина liquidated", last.reason, "liquidated");
  check("возвращено $0", last.returnedUsd, 0);
  check("леджер остался $50 — маржа ушла в казну", accruedOf(owner), 50n * USDC);
  check("маржа $10 легла в резерв: 90 → 100", reserveOf(), 100n * USDC);
}

console.log("\n5. Funding: 0.05% от размера каждые 8 часов");
{
  mark("OPENAI", 1000);
  const r = await open({ market: "OPENAI", side: "long", leverage: 2, marginUsd: 10 }); // size $20
  const [pos] = allPositions();
  pos.lastFundingAt -= 2 * 8 * 3_600_000 + 1000; // two intervals overdue
  await tickPositions();
  check("списано 2 × $0.01", pos.fundingPaidUsd, 0.02);
  check("equity = 10 − 0.02", view(pos).equityUsd, 9.98);
  const c = await close(pos.id);
  check("вернулось 9.98", c.position.returnedUsd, 9.98);
  check("funding $0.02 в резерве", reserveOf(), 100_020_000n);
  void r;
}

console.log("\n5b. Резерв пуст — выигрыш урезается до того, что есть (ADL)");
{
  adjustReserve(-reserveOf()); // drain the house
  adjustReserve(3n * USDC); // it holds $3
  mark("OPENAI", 1000);
  await open({ market: "OPENAI", side: "long", leverage: 10, marginUsd: 10 }); // size $100
  mark("OPENAI", 1100); // +10% → +$10, but the house has $3
  const [pos] = allPositions();
  const c = await close(pos.id);
  check("возвращено 10 + 3, не 10 + 10", c.position.returnedUsd, 13);
  check("урезано на $7", c.position.trimmedUsd, 7);
  check("резерв пуст", reserveOf(), 0n);
  check("леджер: 49.98 − 10 + 13 = 52.98", accruedOf(owner), 52_980_000n);
  adjustReserve(100n * USDC); // refill for the limit tests
}

console.log("\n6. Лимиты");
{
  mark("OPENAI", 1000);
  let r = await open({ market: "OPENAI", side: "long", leverage: 11, marginUsd: 5 });
  check("плечо 11 отклонено", r.ok, false);
  r = await open({ market: "OPENAI", side: "long", leverage: 10, marginUsd: 20 }); // $200 > $100 cap
  check("позиция больше 10% казны отклонена", r.error?.startsWith("position too large"), true);
  r = await open({ market: "OPENAI", side: "long", leverage: 1, marginUsd: 0.5 });
  check("маржа ниже $1 отклонена", r.ok, false);
  r = await open({ market: "OPENAI", side: "long", leverage: 1, marginUsd: 500 });
  check("больше, чем начислено, отклонено", r.error?.startsWith("insufficient"), true);
  r = await open({ market: "GME", side: "long", leverage: 1, marginUsd: 5 });
  check("неизвестный рынок отклонён", r.ok, false);
  r = await open({ market: "TSLA", side: "long", leverage: 1, marginUsd: 5 });
  check("рынок без mark отклонён", r.error?.includes("no mark"), true);

  // open-interest cap: five $100 positions fill the $500 cap, the sixth fails
  addAccrual(owner, 100n * USDC);
  for (let i = 0; i < 5; i++) {
    r = await open({ market: "OPENAI", side: "long", leverage: 10, marginUsd: 10 });
  }
  check("пять позиций по $100 открыты", allPositions().length, 5);
  r = await open({ market: "OPENAI", side: "long", leverage: 10, marginUsd: 10 });
  check("шестая упирается в OI cap", r.error?.includes("open-interest"), true);
}

console.log("\n7. Подписи");
{
  const stranger = Keypair.generate();
  let r = await open({ market: "OPENAI", side: "long", leverage: 1, marginUsd: 5 }, stranger);
  check("чужая подпись отклонена", r.error, "signature does not match owner");
  const [pos] = allPositions();
  r = await close(pos.id, stranger);
  check("чужое закрытие отклонено", r.error, "signature does not match owner");
  const ts = Date.now() - 11 * 60_000;
  const body = { owner, market: "OPENAI", side: "long", leverage: 1, marginUsd: 5, ts };
  body.signature = sign(openMessage(body));
  r = await openPosition(body);
  check("просроченная подпись отклонена", r.error?.includes("expired"), true);
}

console.log("\n8. Резерв набирается из комиссии: 10% до потолка в 20% казны");
{
  // balance $1000, reserve $0, new fee $100 → hold $10
  let s = splitNewFee(100n * USDC, 1000n * USDC, 0n);
  check("10% нового fee в резерв", s.held, 10n * USDC);
  check("остальное холдерам", s.toHolders, 90n * USDC);
  // reserve already $195 of a $200 cap → only $5 more
  s = splitNewFee(100n * USDC, 1000n * USDC, 195n * USDC);
  check("до потолка — только остаток", s.held, 5n * USDC);
  // at cap → nothing held
  s = splitNewFee(100n * USDC, 1000n * USDC, 200n * USDC);
  check("на потолке ничего не удерживается", s.held, 0n);
  check("всё холдерам", s.toHolders, 100n * USDC);
}

console.log("\n9. Состояние переживает перезапуск");
{
  const before = allPositions().length;
  const owed = totalAccrued();
  loadState();
  check("позиции на месте", allPositions().length, before);
  check("owed на месте", totalAccrued(), owed);
}

fs.rmSync("./data-test-perps", { recursive: true, force: true });
console.log(failed ? `\n✗ ${failed} проверок упало` : "\n✓ все проверки пройдены");
process.exit(failed ? 1 : 0);
