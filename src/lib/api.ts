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
import { audit, type AuditAction, type AuditModule } from "./audit";

/** Har route apna naam bata sake to log saaf rahe (Spec 2: universal log security) */
export type AuditMeta = {
  action?: AuditAction;
  module?: AuditModule;
  entity?: string;
  entityId?: string | number;
  req?: Request;
  /** kaamyab kaam ko bhi yahan se likhna ho (aksar lib khud likh deti hai) */
  logSuccess?: boolean;
};

function ipOf(req?: Request): string {
  if (!req) return "";
  try {
    const fwd = req.headers.get("x-forwarded-for");
    if (fwd) return fwd.split(",")[0]!.trim();
    return req.headers.get("x-real-ip") ?? "";
  } catch {
    return "";
  }
}

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

export async function guard(
  roles?: string[],
  meta: AuditMeta = {}
): Promise<NextResponse | null> {
  try {
    await ensureBootstrap();
    const user = await requireUser();
    if (roles && !roles.includes(user.role)) {
      // Spec 2: ijazat ke baghair pahunch ki koshish bhi record ho (security event)
      audit({
        action: "denied",
        userId: user.id,
        userName: user.name,
        entity: meta.entity ?? "Route",
        module: meta.module ?? "Other",
        ip: ipOf(meta.req),
        details: { needed: roles, had: user.role, path: meta.req?.url ?? null },
      });
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
export async function handle<T>(
  fn: (user: SessionUser) => T | Promise<T>,
  meta: AuditMeta = {}
): Promise<NextResponse> {
  let user: SessionUser | null = null;
  try {
    await ensureBootstrap();
    user = await requireUser();
    const out = await fn(user);
    // Spec 2: kaamyab kaam aam taur par lib() khud likhta hai (purana/naya ke sath).
    // Sirf wahan likhein jahan route chaahe (logSuccess) -- warna dohra record.
    if (meta.action && meta.logSuccess) {
      audit({
        action: meta.action,
        userId: user.id,
        userName: user.name,
        entity: meta.entity ?? null,
        entityId: meta.entityId ?? null,
        module: meta.module ?? "Other",
        ip: ipOf(meta.req),
        details: { path: meta.req?.url ?? null },
      });
    }
    return NextResponse.json({ ok: true, ...(out as object) });
  } catch (e) {
    // Naakam koshish bhi record ho (ghalat data / ghalti dhoondne ke liye).
    // "denied" sirf ijazat ke masle ke liye hai; warna asal action ke sath
    // details me failed:true likh dete hain.
    const status = (e as { status?: number }).status ?? 0;
    audit({
      action: meta.action ?? (status === 401 || status === 403 ? "denied" : "denied"),
      userId: user?.id ?? null,
      userName: user?.name ?? null,
      entity: meta.entity ?? null,
      entityId: meta.entityId ?? null,
      module: meta.module ?? "Other",
      ip: ipOf(meta.req),
      details: {
        path: meta.req?.url ?? null,
        error: e instanceof Error ? e.message : String(e),
        failed: true,
        reason: meta.action ? "validation_or_error" : "unknown_route",
      },
    });
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
