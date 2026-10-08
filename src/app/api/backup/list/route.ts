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
