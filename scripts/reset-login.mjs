// ---------------------------------------------------------------------------
// Area11 - Login reset (agar owner ka password ya staff ka PIN bhool jayein)
// ---------------------------------------------------------------------------
// Ye script SIRF isi computer se chalti hai (jahan data/area11.db rakhi hai).
// App band karne ki zarurat nahi -- magar app band ho to zyada mehfooz hai.
//
// ISTEMAL:
//   node scripts/reset-login.mjs --owner "new-password"
//   node scripts/reset-login.mjs --user "Bilal" --pin 1234
//   node scripts/reset-login.mjs --list
// ---------------------------------------------------------------------------

import { DatabaseSync } from "node:sqlite";
import { randomBytes, scryptSync } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const DB_FILE =
  process.env.DATABASE_FILE || path.join(process.cwd(), "data", "area11.db");

const args = process.argv.slice(2);
const get = (flag) => {
  const i = args.indexOf(flag);
  return i === -1 ? null : (args[i + 1] ?? null);
};

if (!fs.existsSync(DB_FILE)) {
  console.error(`[error] Database file nahi mili: ${DB_FILE}`);
  console.error("        (misal: node scripts/reset-login.mjs --owner \"naya-password\")");
  process.exit(1);
}

function hashSecret(secret) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${scryptSync(secret, salt, 64).toString("hex")}`;
}

const db = new DatabaseSync(DB_FILE);
db.exec("PRAGMA foreign_keys = ON");

const rows = db
  .prepare("SELECT id, name, role, active, last_login_at FROM users ORDER BY id")
  .all();

if (args.includes("--list") || args.length === 0) {
  console.log("\nArea11 users:");
  for (const r of rows) {
    console.log(
      `  #${r.id}  ${r.name}  [${r.role}]  ${r.active ? "active" : "off"}  ${
        r.last_login_at ? "last login " + r.last_login_at : "never logged in"
      }`
    );
  }
  console.log(
    '\nPassword badalne ke liye:  node scripts/reset-login.mjs --owner "new-password"\n' +
      'Staff PIN ke liye:         node scripts/reset-login.mjs --user "Naam" --pin 1234\n'
  );
  process.exit(0);
}

const ownerPassword = get("--owner");
const userName = get("--user");
const userPin = get("--pin");

let changed = 0;

if (ownerPassword) {
  if (ownerPassword.trim().length < 4) {
    console.error("[error] Password kam se kam 4 characters ka hona chahiye.");
    process.exit(1);
  }
  const owner = rows.find((r) => r.role === "owner");
  if (!owner) {
    console.error("[error] Koi owner account nahi mila.");
    process.exit(1);
  }
  db.prepare("UPDATE users SET password_hash = ?, active = 1 WHERE id = ?").run(
    hashSecret(ownerPassword.trim()),
    owner.id
  );
  console.log(`[ok] Owner "${owner.name}" ka password badal diya gaya.`);
  changed++;
}

if (userName && userPin) {
  const user = rows.find((r) => r.name.toLowerCase() === userName.toLowerCase());
  if (!user) {
    console.error(`[error] Is naam ka user nahi mila: ${userName}`);
    process.exit(1);
  }
  if (!/^\d{4,8}$/.test(userPin)) {
    console.error("[error] PIN 4 se 8 hindson ka hona chahiye.");
    process.exit(1);
  }
  db.prepare("UPDATE users SET pin_hash = ?, active = 1 WHERE id = ?").run(
    hashSecret(userPin),
    user.id
  );
  console.log(`[ok] "${user.name}" ka PIN badal diya gaya.`);
  changed++;
}

if (!changed) {
  console.error(
    '[error] Kuch nahi badla. Misal: node scripts/reset-login.mjs --owner "new-password"'
  );
  process.exit(1);
}

db.prepare(
  "INSERT INTO audit_logs (user_name, action, entity, details) VALUES (?, 'update', 'User', ?)"
).run("(computer script)", JSON.stringify({ note: "login reset script se badla gaya" }));

db.close();
console.log("[ok] Ho gaya. Ab app me naye password/PIN se login karein.\n");
