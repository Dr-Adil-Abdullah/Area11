// ---------------------------------------------------------------------------
// Area11 - Secrets (session secret wagera) -- settings table me chhupa hua
// ---------------------------------------------------------------------------
// Ye keys SETTING_DEFAULTS me nahi hain, is liye getSettings() aur Settings
// page inhe kabhi show nahi karte. Pehli baar khud-ba-khud banti hain.
// ---------------------------------------------------------------------------

import { run, scalar } from "./db";
import { randomBytes } from "node:crypto";

/** Secret padho; na mile to bana kar save kar do (idempotent) */
export function getOrCreateSecret(key: string, envValue?: string): string {
  if (envValue && envValue.trim().length >= 16) return envValue.trim();
  const existing = scalar<string | null>(
    "SELECT value FROM settings WHERE key = ?",
    [key]
  );
  if (existing) {
    try {
      const parsed = JSON.parse(existing);
      if (typeof parsed === "string" && parsed.length >= 16) return parsed;
    } catch {
      if (existing.length >= 16) return existing;
    }
  }
  const fresh = randomBytes(32).toString("hex");
  run(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now','localtime'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now','localtime')`,
    [key, JSON.stringify(fresh)]
  );
  return fresh;
}
