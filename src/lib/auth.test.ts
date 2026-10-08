// ---------------------------------------------------------------------------
// Area11 - Auth / Roles tests  (Node ka built-in test runner -- koi library nahi)
//   npm test
// ---------------------------------------------------------------------------

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hashSecret,
  isValidPassword,
  isValidPin,
  signToken,
  verifyToken,
  verifySecret,
} from "./auth.ts";
import { checkDiscountLimit, maxDiscountPercent } from "./roles.ts";

const SECRET = "test-secret-0123456789";

test("password/PIN hashing: sahi secret pass, ghalat fail", () => {
  const stored = hashSecret("2468");
  assert.ok(stored.startsWith("scrypt$"));
  assert.equal(verifySecret("2468", stored), true);
  assert.equal(verifySecret("2469", stored), false);
  assert.equal(verifySecret("2468", null), false);
  assert.equal(verifySecret("2468", "not-a-hash"), false);
});

test("har hash ka salt alag hota hai", () => {
  const a = hashSecret("1111");
  const b = hashSecret("1111");
  assert.notEqual(a, b);
  assert.equal(verifySecret("1111", a), true);
  assert.equal(verifySecret("1111", b), true);
});

test("PIN aur password ki validation", () => {
  assert.equal(isValidPin("2468"), true);
  assert.equal(isValidPin("12345", 4), true);
  assert.equal(isValidPin("123"), false, "3 digits ka PIN nahi");
  assert.equal(isValidPin("abcd"), false);
  assert.equal(isValidPassword("area11"), true);
  assert.equal(isValidPassword("123"), false);
});

test("session token: sahi chalta hai, chhed-chhad pakri jati hai", () => {
  const now = Math.floor(Date.now() / 1000);
  const token = signToken({ uid: 1, role: "owner", iat: now, exp: now + 3600 }, SECRET);
  const payload = verifyToken(token, SECRET);
  assert.equal(payload?.uid, 1);
  assert.equal(payload?.role, "owner");

  // dusra secret -> fail
  assert.equal(verifyToken(token, "another-secret-987654321"), null);
  // payload badal do -> signature fail
  const [body, mac] = token.split(".");
  const tampered = Buffer.from(
    JSON.stringify({ uid: 99, role: "owner", iat: now, exp: now + 3600 })
  ).toString("base64url");
  assert.equal(verifyToken(`${tampered}.${mac}`, SECRET), null);
  assert.ok(body.length > 0);
  // kachra token
  assert.equal(verifyToken("hello.world", SECRET), null);
  assert.equal(verifyToken("", SECRET), null);
});

test("session ki muddat khatam ho to token rad", () => {
  const now = Math.floor(Date.now() / 1000);
  const token = signToken({ uid: 1, role: "cashier", iat: now - 7200, exp: now - 3600 }, SECRET);
  assert.equal(verifyToken(token, SECRET), null);
  // waqt aage barhao (testing ke liye)
  const fresh = signToken({ uid: 1, role: "cashier", iat: now, exp: now + 60 }, SECRET);
  assert.equal(verifyToken(fresh, SECRET, Date.now() + 61_000), null);
});

test("role ke hisaab se discount limit", () => {
  const limits = { cashier: 5, manager: 20, owner: 100 };
  assert.equal(maxDiscountPercent("cashier", limits), 5);
  assert.equal(maxDiscountPercent("manager", limits), 20);
  assert.equal(maxDiscountPercent("owner", limits), 100);
});

test("discount percent check: limit par aur us se neeche theek", () => {
  // 1000 par 50 = 5% (cashier ki limit)
  assert.equal(checkDiscountLimit(50, 1000, 5).allowed, true);
  // 1000 par 51 = 5.1% -> nahi
  assert.equal(checkDiscountLimit(51, 1000, 5).allowed, false);
  // koi discount nahi -> theek
  assert.equal(checkDiscountLimit(0, 1000, 5).allowed, true);
  // khali cart
  assert.equal(checkDiscountLimit(100, 0, 5).allowed, true);
  assert.equal(checkDiscountLimit(51, 1000, 5).percent, 5.1);
});
