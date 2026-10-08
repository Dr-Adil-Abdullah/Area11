// Area11 - Mehfooz backup file download
import fs from "node:fs";
import path from "node:path";
import { guard, SHOP_ROLES } from "@/lib/api";
import { BACKUP_DIR, listBackups } from "@/lib/backup";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const denied = await guard(SHOP_ROLES);
  if (denied) return denied;

  const name = new URL(req.url).searchParams.get("n") ?? "";
  // suraksha: koi bhi path nahi, sirf data/backups/ ke andar ki asal file
  const allowed = new Set(listBackups().map((b) => b.name));
  if (!name || !allowed.has(name)) {
    return Response.json({ ok: false, error: "File nahi mili." }, { status: 404 });
  }
  const full = path.join(BACKUP_DIR, name);
  if (!fs.existsSync(full)) return Response.json({ ok: false, error: "File nahi mili." }, { status: 404 });

  const buf = fs.readFileSync(full);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": name.endsWith(".zip") ? "application/zip" : "application/octet-stream",
      "Content-Disposition": `attachment; filename="${name}"`,
    },
  });
}
