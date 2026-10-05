// ---------------------------------------------------------------------------
// Area11 - Test: backup ka ZIP engine (photos ke sath backup/restore)
// ---------------------------------------------------------------------------
import test from "node:test";
import assert from "node:assert/strict";
import { buildZip, readZip } from "./zip.ts";

test("zip me daala hua data wapas bilkul waisa hi nikalta hai", () => {
  const db = Buffer.from("SQLite format 3" + "x".repeat(500));
  const photo = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 250, 251, 252]);
  const zip = buildZip([
    { name: "area11.db", data: db },
    { name: "photos/customer-1.png", data: photo },
  ]);
  const back = readZip(zip);
  assert.equal(back.length, 2);
  assert.equal(back[0].name, "area11.db");
  assert.ok(back[0].data.equals(db), "database badal gaya!");
  assert.equal(back[1].name, "photos/customer-1.png");
  assert.ok(back[1].data.equals(photo), "photo badal gayi!");
});

test("khaali file aur bari file dono theek", () => {
  const zip = buildZip([
    { name: "a.txt", data: Buffer.alloc(0) },
    { name: "b.bin", data: Buffer.alloc(50_000, 7) },
  ]);
  const back = readZip(zip);
  assert.equal(back[0].data.length, 0);
  assert.equal(back[1].data.length, 50_000);
  assert.equal(back[1].data[1234], 7);
});

test("urfdu/unicode naam bhi mehfooz rehte hain", () => {
  const zip = buildZip([{ name: "photos/panadol دوا.png", data: Buffer.from("img") }]);
  const back = readZip(zip);
  assert.equal(back[0].name, "photos/panadol دوا.png");
});

test("zip na ho to saaf ghalti", () => {
  assert.throws(() => readZip(Buffer.from("ye koi zip nahi hai")), /asli zip/);
});

test("ek se zyada entries ka hisaab theek", () => {
  const entries = Array.from({ length: 12 }, (_, i) => ({
    name: `f${i}.txt`,
    data: Buffer.from(`file number ${i}`),
  }));
  const back = readZip(buildZip(entries));
  assert.equal(back.length, 12);
  assert.equal(back[11].data.toString(), "file number 11");
  assert.equal(back[0].name, "f0.txt");
});
