// Area11 - Khud-b-khud backup (rozana) — abhi chalao ya haal poochho
import { guard, SHOP_ROLES } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { autoBackupIfDue } from "@/lib/backup";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET() {
  const denied = await guard(SHOP_ROLES);
  if (denied) return denied;
  const s = await getSettings();
  const r = autoBackupIfDue({
    enabled: Boolean(s["backup.autoEnabled"]),
    everyHours: Number(s["backup.everyHours"]) || 24,
    keep: Number(s["backup.keep"]) || 7,
  });
  return Response.json({ ok: true, ...r });
}

/** Abhi foran backup banao (force) */
export async function POST() {
  const denied = await guard(SHOP_ROLES);
  if (denied) return denied;
  const s = await getSettings();
  const r = autoBackupIfDue({ enabled: true, everyHours: 0, keep: Number(s["backup.keep"]) || 7 });
  if (r.ran) {
    void audit({ action: "backup", entity: "Database", details: { file: r.file, bytes: r.bytes, auto: true } });
  }
  return Response.json({ ok: true, ...r });
}
