// ---------------------------------------------------------------------------
// Area11 - Bootstrap (pehli baar chalne par sab kuch tayyar)
// ---------------------------------------------------------------------------
// Settings ki default rows, owner user, default categories -- sab idempotent
// (dobara chalane se kuch kharab nahi hota).
// ---------------------------------------------------------------------------

import { get, run, scalar } from "./db";
import { ensureSettingRows } from "./settings";
import { hashSecret } from "./auth";

const DEFAULT_CATEGORIES = ["Medicines", "Surgical", "Cosmetics", "General", "Baby Care"];

let bootstrapped = false;

export async function ensureBootstrap(): Promise<void> {
  if (bootstrapped) return;
  bootstrapped = true; // loop se bachao (ek hi dafa chale)
  try {
    await ensureSettingRows();

    // Owner user (agar koi user nahi)
    const userCount = scalar<number>("SELECT COUNT(*) AS c FROM users");
    if (!userCount) {
      run(
        `INSERT INTO users (name, role, password_hash, pin_hash)
         VALUES (?, 'owner', ?, ?)`,
        [
          "Owner",
          hashSecret(process.env.OWNER_DEFAULT_PASSWORD || "area11"),
          hashSecret(process.env.OWNER_DEFAULT_PIN || "1111"),
        ]
      );
      console.log("[bootstrap] owner account bana (default password: area11)");
    }

    // Default categories
    const catCount = scalar<number>("SELECT COUNT(*) AS c FROM categories");
    if (!catCount) {
      DEFAULT_CATEGORIES.forEach((name, i) => {
        run("INSERT OR IGNORE INTO categories (name, sort_order) VALUES (?, ?)", [name, i]);
      });
    }

    // NOTE: shift (galla) khud se nahi khulti -- cashier/owner /cash par ja kar
    // opening float ke saath shift kholta hai (P2, stage-15).
  } catch (e) {
    console.error("[bootstrap] error:", e);
  }
}
