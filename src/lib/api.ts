// ---------------------------------------------------------------------------
// Area11 - chhota API helper: har route me try/catch dobara na likhna pade (RULE U-08)
// ---------------------------------------------------------------------------
// handle()        = login lazmi (session)
// handleOwner()   = sirf owner (settings/staff/backup)
// jsonError()     = sahi HTTP status ke saath error
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { ensureBootstrap } from "./bootstrap";
import { requireUser, requireOwner, type SessionUser } from "./session";

function status(e: unknown): number {
  const s = (e as { status?: number })?.status;
  if (typeof s === "number") return s;
  return 400;
}

export function jsonError(e: unknown): NextResponse {
  return NextResponse.json(
    { ok: false, error: e instanceof Error ? e.message : "failed" },
    { status: status(e) }
  );
}

/**
 * Guard: har route ke shuru me -- login nahi to 401 jawab, warna null.
 *   const denied = await guard(); if (denied) return denied;
 */
export const SHOP_ROLES = ["owner", "manager"];

export async function guard(roles?: string[]): Promise<NextResponse | null> {
  try {
    await ensureBootstrap();
    const user = await requireUser();
    if (roles && !roles.includes(user.role)) {
      const err = new Error("Owner or Manager only");
      (err as Error & { status?: number }).status = 403;
      throw err;
    }
    return null;
  } catch (e) {
    return jsonError(e);
  }
}

/** Login lazmi route */
export async function handle<T>(fn: (user: SessionUser) => T | Promise<T>): Promise<NextResponse> {
  try {
    await ensureBootstrap();
    const user = await requireUser();
    const out = await fn(user);
    return NextResponse.json({ ok: true, ...(out as object) });
  } catch (e) {
    return jsonError(e);
  }
}

/** Sirf owner */
export async function handleOwner<T>(
  fn: (user: SessionUser) => T | Promise<T>
): Promise<NextResponse> {
  try {
    await ensureBootstrap();
    const user = await requireOwner();
    const out = await fn(user);
    return NextResponse.json({ ok: true, ...(out as object) });
  } catch (e) {
    return jsonError(e);
  }
}
