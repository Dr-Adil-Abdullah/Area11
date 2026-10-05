// Area11 - Blackbox (audit log) parhna -- SIRF owner. Mitna allowed hi nahi.
import { NextResponse } from "next/server";
import { guard, SHOP_ROLES } from "@/lib/api";
import { listAudit, auditEntities, auditUsers, AUDIT_ACTIONS } from "@/lib/audit-view";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // owner + manager dekh sakte hain (manager rozana ki ghalti dhoondne ke liye)
  const denied = await guard(SHOP_ROLES);
  if (denied) return denied;

  const u = new URL(req.url);
  const data = listAudit({
    q: u.searchParams.get("q") ?? undefined,
    action: u.searchParams.get("action") ?? undefined,
    entity: u.searchParams.get("entity") ?? undefined,
    user: u.searchParams.get("user") ?? undefined,
    from: u.searchParams.get("from") ?? undefined,
    to: u.searchParams.get("to") ?? undefined,
    limit: Number(u.searchParams.get("limit")) || 200,
  });
  return NextResponse.json({
    ok: true,
    ...data,
    entities: auditEntities(),
    users: auditUsers(),
    actions: AUDIT_ACTIONS,
  });
}
