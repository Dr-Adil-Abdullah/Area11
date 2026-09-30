// ---------------------------------------------------------------------------
// Area11 - Auth helpers
// ---------------------------------------------------------------------------
// User ne chuna: staff ke liye 4-hindsi PIN, owner ke liye password.
// Hashing: Node ka built-in scrypt (koi extra library nahi -- RULE R-09).
// ---------------------------------------------------------------------------

import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

export function hashSecret(secret: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(secret, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifySecret(secret: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, hash] = parts;
  try {
    const candidate = scryptSync(secret, salt, 64);
    const expected = Buffer.from(hash, "hex");
    if (candidate.length !== expected.length) return false;
    return timingSafeEqual(candidate, expected);
  } catch {
    return false;
  }
}

export const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  manager: "Manager",
  cashier: "Cashier",
};
