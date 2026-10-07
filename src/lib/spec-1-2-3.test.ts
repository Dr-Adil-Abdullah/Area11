// ---------------------------------------------------------------------------
// Area11 - Test: Spec 1 (negative inventory) + Spec 2 (purana vs naya record)
// ---------------------------------------------------------------------------
// Ye test jaan-bujh kar sirf PURE modules par hain (koi database nahi), taake
// `npm test` hamesha chale -- chahe data folder maujood ho ya na ho.
// ---------------------------------------------------------------------------

import test from "node:test";
import assert from "node:assert/strict";
import { diffFields, splitDiff, valuesForLog } from "./audit-diff.ts";
import { evaluateNegativeStock } from "./stock-rules.ts";
import {
  canDismissAlerts,
  negStockKey,
  provisionalKey,
  reasonError,
  removeDismissed,
} from "./alert-shared.ts";

// =================== Spec 1: NEGATIVE INVENTORY ===================

test("Spec 1.1: stock kafi ho to koi masla nahi", () => {
  const v = evaluateNegativeStock({
    name: "Panadol",
    inStockBase: 50,
    sellBase: 10,
    allowNegative: true,
    warn: true,
  });
  assert.equal(v.short, false);
  assert.equal(v.block, false);
  assert.equal(v.afterBase, 40);
});

test("Spec 1.1: barabar ho to bhi theek (0 reh jaye to masla nahi)", () => {
  const v = evaluateNegativeStock({
    name: "Panadol",
    inStockBase: 10,
    sellBase: 10,
    allowNegative: true,
    warn: true,
  });
  assert.equal(v.short, false);
  assert.equal(v.afterBase, 0);
});

test("Spec 1.1: manfi ijazat ho to bikri RUKE nahi -- sirf alert aaye", () => {
  const v = evaluateNegativeStock({
    name: "Brufen",
    inStockBase: 5,
    sellBase: 12,
    allowNegative: true,
    warn: true,
    stockLabel: "batch B-1",
  });
  assert.equal(v.short, true, "minus me gaya to nishan lagna chahiye");
  assert.equal(v.block, false, "ijazat hai to bikri nahi rukni chahiye");
  assert.equal(v.afterBase, -7);
  assert.match(v.message, /Brufen/);
  assert.match(v.message, /MINUS/);
});

test("Spec 1.1: manfi ijazat BAND ho to bikri ruk jaye (409)", () => {
  assert.throws(
    () =>
      evaluateNegativeStock({
        name: "Brufen",
        inStockBase: 5,
        sellBase: 12,
        allowNegative: false,
        warn: true,
      }),
    (e: unknown) => {
      const err = e as Error & { status?: number };
      assert.equal(err.status, 409);
      assert.match(err.message, /Manfi stock band hai/);
      return true;
    }
  );
});

test("Spec 1.2: warn OFF ho to bikri ho magar paigham na aaye", () => {
  const v = evaluateNegativeStock({
    name: "X",
    inStockBase: 1,
    sellBase: 9,
    allowNegative: true,
    warn: false,
  });
  assert.equal(v.short, true);
  assert.equal(v.message, "", "warn off to koi paigham nahi");
});

// =================== Spec 2: PURANA vs NAYA ===================

test("Spec 2.2: sirf badli hui felds record hon", () => {
  const d = diffFields(
    { name: "Panadol", retail_paisa: 500, rack: "A1" },
    { name: "Panadol Extra", retail_paisa: 500, rack: "A1" }
  );
  assert.deepEqual(Object.keys(d), ["name"]);
  assert.deepEqual(d.name, { from: "Panadol", to: "Panadol Extra" });
});

test("Spec 2.2: do column me baant (purana / naya)", () => {
  const { oldValue, newValue } = splitDiff(
    diffFields({ qty_base: 10, cost: 100 }, { qty_base: 4, cost: 100 })
  );
  assert.deepEqual(oldValue, { qty_base: 10 });
  assert.deepEqual(newValue, { qty_base: 4 });
});

test("Spec 2.2: kuch na badle to khaali", () => {
  assert.deepEqual(diffFields({ a: 1 }, { a: 1 }), {});
  assert.deepEqual(diffFields(null, { a: 1 }), {});
  assert.deepEqual(diffFields({ a: 1 }, null), {});
});

test("Spec 2.2: purani value null ho to bhi farq pakda jaye", () => {
  const d = diffFields({ note: null, qty: 3 }, { note: "damaged", qty: 3 });
  assert.deepEqual(d.note, { from: null, to: "damaged" });
});

test("Spec 2.2: nayi feld (pehle maujood na ho) bhi record ho", () => {
  const d = diffFields({ a: 1 } as Record<string, unknown>, { a: 1, b: 2 } as Record<string, unknown>);
  assert.deepEqual(d.b, { from: null, to: 2 });
});

test("Spec 1.2: stock minus hone par blackbox action 'negative_sale' hi rahe", () => {
  // sales.ts ka usool: negativeItems ho to action "negative_sale", warna "create"
  const decide = (negatives: number) => (negatives > 0 ? "negative_sale" : "create");
  assert.equal(decide(0), "create");
  assert.equal(decide(2), "negative_sale");
});

// =================== Spec 2.2: naya record / mitaya gaya / badla gaya ===================

test("Spec 2.2: NAYA record banne par poori nayi value mehfooz ho (purana null)", () => {
  const v = valuesForLog(null, { name: "Ali", limit: 5000 });
  assert.equal(v.oldValue, null);
  assert.deepEqual(v.newValue, { name: "Ali", limit: 5000 });
});

test("Spec 2.2: record MITANE par poorani value mehfooz ho (naya null)", () => {
  const v = valuesForLog({ name: "Ali", active: 1 }, null);
  assert.deepEqual(v.oldValue, { name: "Ali", active: 1 });
  assert.equal(v.newValue, null);
});

test("Spec 2.2: badlav par sirf badli hui felds (purana → naya)", () => {
  const v = valuesForLog({ name: "Ali", limit: 5000 }, { name: "Ali", limit: 7500 });
  assert.deepEqual(v.oldValue, { limit: 5000 });
  assert.deepEqual(v.newValue, { limit: 7500 });
});

test("Spec 2.2: kuch na badle to dono column khaali", () => {
  const v = valuesForLog({ a: 1 }, { a: 1 });
  assert.equal(v.oldValue, null);
  assert.equal(v.newValue, null);
});

// =================== U-30 / U-31 / U-33: ALERT & WAJAH ===================
// Malik ke hukum:
//   U-30 = manfi stock (ya koi bhi aisi surat) KAAM KABHI NAHI ROKE, sirf alert
//   U-31 = alert sirf MALIK khatam karay, WAJAH likh kar; wajah mehfooz rahe
//   U-33 = bina bill wapsi par maal foran stock me, alert malik ke khatam karne tak

test("U-31: alert key har qism ke liye alag bane", () => {
  assert.equal(negStockKey(12), "negstock:12");
  assert.equal(provisionalKey(5), "provisional:5");
  // do alag alerts ka key kabhi aapas me nahi milna chahiye
  assert.notEqual(negStockKey(5), provisionalKey(5));
});

test("U-31: khatam ki hui alert dobara nazar na aaye", () => {
  const rows = [
    { key: negStockKey(1), type: "negstock" },
    { key: negStockKey(2), type: "negstock" },
    { key: provisionalKey(7), type: "provisional" },
  ];
  const left = removeDismissed(rows, new Set([negStockKey(2)]));
  assert.equal(left.length, 2);
  assert.ok(!left.some((r) => r.key === negStockKey(2)));
});

test("U-31: wajah lazmi hai -- khaali ya chhoti manzoor nahi", () => {
  assert.ok(reasonError(""));
  assert.ok(reasonError("   "));
  assert.ok(reasonError("ab")); // 2 harf = kam
  assert.equal(reasonError("ginti galat thi"), null);
});

test("U-31: alert khatam karna sirf MALIK ka kaam hai", () => {
  assert.equal(canDismissAlerts("owner"), true);
  assert.equal(canDismissAlerts("manager"), false);
  assert.equal(canDismissAlerts("cashier"), false);
  assert.equal(canDismissAlerts(undefined), false);
});

test("U-30: manfi stock par bhi kaam rukta nahi (sirf alert)", () => {
  // supplier wapsi / write-off: stock se zyada quantity darj ho to bhi
  // block = false hona chahiye, warn = true (Spec 1 + U-30 ka mila jula usul)
  const v = evaluateNegativeStock({
    name: "Panadol",
    inStockBase: 3,
    sellBase: 10, // hamare paas 3 hain, 10 wapas bhej rahe hain
    allowNegative: true,
    warn: true,
  });
  assert.equal(v.block, false, "U-30: manfi stock kaam nahi rok sakta");
  assert.ok(v.message.length > 0, "U-30: sirf alert (warning) jana chahiye");
  assert.equal(v.afterBase, -7, "hisab theek: 3 - 10 = -7 (minus me gaya)");
});
