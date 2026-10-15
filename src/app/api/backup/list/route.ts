/*
PREVIOUS CODE - commented out on purpose (2026-10-12).
Reference only: kept readable so it can be studied later,
but NOTHING inside runs, so it cannot throw errors.
// Area11 - Mehfooz (khud-b-khud banay hue) backups ki fehrist
import { guard, SHOP_ROLES } from "@/lib/api";
import { listBackups } from "@/lib/backup";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const denied = await guard(SHOP_ROLES);
  if (denied) return denied;
  return Response.json({ ok: true, backups: listBackups() });
}

*/
