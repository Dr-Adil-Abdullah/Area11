// ---------------------------------------------------------------------------
// Area11 - Session (abhi simple: pehla active user = owner)
// ---------------------------------------------------------------------------
// Phase 1 me PIN/password ke saath poora login aayega. Abhi yeh helper
// batata hai ke "kaun kar raha hai" -- audit aur display ke liye.
// ---------------------------------------------------------------------------

import { get } from "./db";

export type SessionUser = {
  id: number;
  name: string;
  role: string;
};

export async function currentUser(): Promise<SessionUser | null> {
  try {
    const u = get<SessionUser>(
      `SELECT id, name, role FROM users
       WHERE active = 1
       ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END, id
       LIMIT 1`
    );
    return u ?? null;
  } catch {
    return null;
  }
}
