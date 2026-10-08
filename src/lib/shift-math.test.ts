// Area11 - galla/shift ka hisaab (pure math) ke test
import { test } from "node:test";
import assert from "node:assert/strict";
import { expectedCashOf, varianceOf } from "./shift-math.ts";

test("expected cash: float + andar - bahar", () => {
  const expected = expectedCashOf(500000, {
    cashSales: 125000,
    collections: 30000,
    refunds: 5000,
    supplierPaid: 40000,
    expenses: 3000,
    drawings: 20000,
  });
  // 5000 + 1250 + 300 - 50 - 400 - 30 - 200 (rupey) = 5870
  assert.equal(expected, 587000);
});

test("khali galla: sirf float", () => {
  assert.equal(
    expectedCashOf(100000, { cashSales: 0, collections: 0, refunds: 0, supplierPaid: 0, expenses: 0, drawings: 0 }),
    100000
  );
});

test("variance: kam / zyada / barabar", () => {
  assert.equal(varianceOf(500000, 500000), 0);
  assert.equal(varianceOf(500000, 495000), -5000); // 50 rupey kam
  assert.equal(varianceOf(500000, 505000), 5000);  // 50 rupey zyada
});

test("decimal float bhi theek (paisa integer)", () => {
  assert.equal(
    expectedCashOf(1234.6, { cashSales: 0.4, collections: 0, refunds: 0, supplierPaid: 0, expenses: 0, drawings: 0 }),
    1235
  );
});
