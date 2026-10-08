// Area11 - Blackbox (audit log) parhna -- SIRF owner. Mitna allowed hi nahi.
import { NextResponse } from "next/server";
import { guard, SHOP_ROLES } from "@/lib/api";
import { listAudit, auditEntities, auditUsers, auditModules, AUDIT_ACTIONS, AUDIT_MODULES, auditCsv } from "@/lib/audit-view";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // owner + manager dekh sakte hain (manager rozana ki ghalti dhoondne ke liye)
  const denied = await guard(SHOP_ROLES);
  if (denied) return denied;

  const u = new URL(req.url);
  const filters = {
    q: u.searchParams.get("q") ?? undefined,
    action: u.searchParams.get("action") ?? undefined,
    entity: u.searchParams.get("entity") ?? undefined,
    user: u.searchParams.get("user") ?? undefined,
    module: u.searchParams.get("module") ?? undefined,
    from: u.searchParams.get("from") ?? undefined,
    to: u.searchParams.get("to") ?? undefined,
    limit: Number(u.searchParams.get("limit")) || 200,
  };

  // CSV chahiye to file bana kar bhej dein (owner apne hisab se dekh sake)
  if (u.searchParams.get("format") === "csv") {
    const csv = auditCsv({ ...filters, limit: 5000 });
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="area11-audit-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  const data = listAudit(filters);
  return NextResponse.json({
    ok: true,
    ...data,
    entities: auditEntities(),
    users: auditUsers(),
    modules: auditModules(),
    actions: AUDIT_ACTIONS,
    allModules: AUDIT_MODULES,
  });
}
