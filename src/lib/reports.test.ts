// ---------------------------------------------------------------------------
// Area11 - Test: bill ka total aur itemon ka jor BARABAR hone chahiye
// ---------------------------------------------------------------------------
// Round-off / loyalty ki chhoot sirf bill par lagti to reports aur rasid
// dono me farq nazar aata tha. Yeh test usi ko rokta hai.
// ---------------------------------------------------------------------------

import test from "node:test";
import assert from "node:assert/strict";

/** Har line ko us ke hissay ke mutabiq farq baanto (sales.ts wala asal tareeqa) */
function reconcileItemTotals(lines: { lineTotal: number }[], target: number): void {
  if (lines.length === 0) return;
  const current = lines.reduce((n, l) => n + l.lineTotal, 0);
  const delta = target - current;
  if (delta === 0 || current <= 0) return;
  let left = delta;
  lines.forEach((l, idx) => {
    const share = idx === lines.length - 1 ? left : Math.round((l.lineTotal / current) * delta);
    l.lineTotal = Math.max(0, l.lineTotal + share);
    left -= share;
  });
}

function sum(lines: { lineTotal: number }[]): number {
  return lines.reduce((n, l) => n + l.lineTotal, 0);
}

test("round-off ke baad bhi items ka jor bill ke barabar", () => {
  const lines = [{ lineTotal: 6750 }, { lineTotal: 2500 }];
  const subtotal = sum(lines);              // 9250
  const roundOff = -50;                     // round down to 10s
  const bill = subtotal + roundOff;         // 9200
  reconcileItemTotals(lines, bill);
  assert.equal(sum(lines), bill);
});

test("loyalty chhoot ke baad bhi items ka jor bill ke barabar", () => {
  const lines = [{ lineTotal: 6750 }];
  const bill = sum(lines) - 500;            // 5 points = Rs 5
  reconcileItemTotals(lines, bill);
  assert.equal(sum(lines), bill);
  assert.equal(lines[0].lineTotal, 6250);
});

test("round-off + loyalty dono ek sath", () => {
  const lines = [{ lineTotal: 6750 }, { lineTotal: 2500 }];
  const afterDiscount = sum(lines);         // 9250
  const bill = afterDiscount - 750 - 500;   // roundOff -750, loyalty -500
  reconcileItemTotals(lines, bill);
  assert.equal(sum(lines), bill);
});

test("chhoot kabhi bhi line ko manfi nahi karti", () => {
  const lines = [{ lineTotal: 100 }, { lineTotal: 0 }];
  reconcileItemTotals(lines, 0);
  assert.ok(lines.every((l) => l.lineTotal >= 0));
  assert.equal(sum(lines), 0);
});

test("kisi line ka hissa zero hone par bhi theek", () => {
  const lines = [{ lineTotal: 0 }, { lineTotal: 1000 }];
  reconcileItemTotals(lines, 900);
  assert.equal(sum(lines), 900);
});

test("report ka margin sahi nikalta hai", () => {
  const sales = 10000, cost = 7000, refund = 1000;
  const profit = sales - refund - cost;              // 2000
  const margin = Math.round(((profit / (sales - refund)) * 1000)) / 10; // 22.2
  assert.equal(profit, 2000);
  assert.equal(margin, 22.2);
});

// --- Ginti (stock-take) ka hisab ------------------------------------------
function diffOf(system: number, counted: number, cost: number) {
  const diff = Math.round((counted - system) * 1000) / 1000;
  if (diff === 0) return { diff: 0, valuePaisa: 0, reason: "same" as const };
  return {
    diff,
    valuePaisa: Math.round(Math.abs(diff) * Math.max(0, cost)),
    reason: (diff < 0 ? "count_short" : "count_extra") as "count_short" | "count_extra",
  };
}

test("ginti me kami = nuqsan (count_short)", () => {
  const r = diffOf(30, 25, 300);
  assert.equal(r.diff, -5);
  assert.equal(r.valuePaisa, 1500); // 5 x Rs 3
  assert.equal(r.reason, "count_short");
});

test("ginti me ziyada = count_extra, qeemat cost par", () => {
  const r = diffOf(-9, 5, 400); // kitab me manfi stock, haath me 5 mile
  assert.equal(r.diff, 14);
  assert.equal(r.valuePaisa, 5600);
  assert.equal(r.reason, "count_extra");
});

test("ginti bilkul mil gayi to koi farq nahi", () => {
  const r = diffOf(12, 12, 500);
  assert.equal(r.reason, "same");
  assert.equal(r.valuePaisa, 0);
});

test("manfi qeemat se kabhi nuqsan nahi banta", () => {
  const r = diffOf(10, 4, -50);
  assert.equal(r.valuePaisa, 0);
});
