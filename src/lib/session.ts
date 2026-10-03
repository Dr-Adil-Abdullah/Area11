// ---------------------------------------------------------------------------
// Area11 - Session (Login ke baad "kaun andar hai")
// ---------------------------------------------------------------------------
// Cookie: HttpOnly, signed (HMAC) -- browser JS ise nahi parh sakta.
// Secret: .env ke SESSION_SECRET se, warna database me khud-ba-khud banti hai.
// ---------------------------------------------------------------------------

import { cookies } from "next/headers";
import { get, run } from "./db";
import { signToken, verifyToken, type SessionPayload } from "./auth";
import { getOrCreateSecret } from "./secrets";
import { getSettings } from "./settings";

export const SESSION_COOKIE = "area11_session";
const SESSION_SECRET_KEY = "security.sessionSecret";

export type SessionUser = {
  id: number;
  name: string;
  role: string;
};

export function sessionSecret(): string {
  return getOrCreateSecret(SESSION_SECRET_KEY, process.env.SESSION_SECRET);
}

/** Token banao (login ke waqt) */
export async function createSessionToken(userId: number, role: string): Promise<string> {
  const settings = await getSettings();
  const hours = Number(settings["security.sessionHours"]) || 12;
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = { uid: userId, role, iat: now, exp: now + hours * 3600 };
  return signToken(payload, sessionSecret());
}

/** Cookie se token parh kar user nikalo (kuch bhi ghalat ho to null) */
export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const payload = verifyToken(token, sessionSecret());
    if (!payload) return null;
    const u = get<{ id: number; name: string; role: string; active: number }>(
      `SELECT id, name, role, active FROM users WHERE id = ?`,
      [payload.uid]
    );
    if (!u || !u.active) return null;
    return { id: u.id, name: u.name, role: u.role };
  } catch {
    return null;
  }
}

/** Pehla active owner (jab security.requireLogin band ho) */
function firstActiveOwner(): SessionUser | null {
  return (
    get<SessionUser>(
      `SELECT id, name, role FROM users
       WHERE active = 1 AND role = 'owner'
       ORDER BY id LIMIT 1`
    ) ?? null
  );
}

/**
 * Aaj ka user:
 *  - Login hua hai to wohi
 *  - warna: agar security.requireLogin = OFF hai to owner (purani behaviour)
 *  - warna null (matlab login zaroori)
 */
export async function currentUser(): Promise<SessionUser | null> {
  const session = await getSessionUser();
  if (session) return session;
  try {
    const settings = await getSettings();
    if (settings["security.requireLogin"] === false) return firstActiveOwner();
  } catch {
    // settings na milen to bhi login zaroori
  }
  return null;
}

/** Login zaroori -- warna error (API routes ke liye) */
export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) {
    const err = new Error("Login required");
    (err as Error & { status?: number }).status = 401;
    throw err;
  }
  return user;
}

/** Sirf owner (staff/backup/settings ke liye) */
export async function requireOwner(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "owner") {
    const err = new Error("Only the owner can do this");
    (err as Error & { status?: number }).status = 403;
    throw err;
  }
  return user;
}

function forbidden(message: string): Error {
  const err = new Error(message);
  (err as Error & { status?: number }).status = 403;
  return err;
}

/** Owner ya Manager (kharidari, supplier payment, settings wagera) */
export async function requireShopManager(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "owner" && user.role !== "manager") {
    throw forbidden("Owner or Manager only");
  }
  return user;
}

/** Handle() ke andar role check karne ke liye */
export function assertShopManager(user: SessionUser): SessionUser {
  if (user.role !== "owner" && user.role !== "manager") {
    throw forbidden("Owner or Manager only");
  }
  return user;
}

/** Kis user ne login kiya -- audit ke liye chhota helper */
export async function loginStamp(userId: number): Promise<void> {
  run(`UPDATE users SET last_login_at = datetime('now','localtime') WHERE id = ?`, [userId]);
}
