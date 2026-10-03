// ---------------------------------------------------------------------------
// Area11 - Auth helpers
// ---------------------------------------------------------------------------
// User ne chuna: staff ke liye 4-hindsi PIN, owner ke liye password.
// Hashing: Node ka built-in scrypt (koi extra library nahi -- RULE R-09).
// Session: HMAC-SHA256 signed token (Node ka built-in crypto -- koi library nahi).
// ---------------------------------------------------------------------------

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";

// ------------------------------- password / PIN -------------------------------

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

/** PIN sirf hindse? (security.pinLength ke mutabiq) */
export function isValidPin(pin: string, length = 4): boolean {
  return new RegExp(`^\\d{${length},8}$`).test(pin.trim());
}

/** Password kam se kam 4 characters (owner ke liye) */
export function isValidPassword(pw: string): boolean {
  return pw.trim().length >= 4;
}

// ------------------------------- session token -------------------------------
// Token = base64url(payload).hmac  -- payload me: uid, role, iat, exp

export type SessionPayload = { uid: number; role: string; iat: number; exp: number };

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

export function signToken(payload: SessionPayload, secret: string): string {
  const body = b64url(JSON.stringify(payload));
  const mac = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function verifyToken(token: string, secret: string, nowMs = Date.now()): SessionPayload | null {
  if (!token || !token.includes(".")) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  try {
    const expected = createHmac("sha256", secret).update(body).digest("base64url");
    const a = Buffer.from(mac);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (typeof payload?.uid !== "number" || typeof payload?.exp !== "number") return null;
    if (payload.exp * 1000 <= nowMs) return null; // session ki muddat khatam
    return payload;
  } catch {
    return null;
  }
}

export const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  manager: "Manager",
  cashier: "Cashier",
};
