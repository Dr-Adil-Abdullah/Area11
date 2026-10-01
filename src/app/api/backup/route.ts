// Area11 - Database backup download (VACUUM INTO = poori, mehfooz copy; app chalti rahe)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
export const dynamic = "force-dynamic";

export async function GET() {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const tmp = path.join(os.tmpdir(), `area11-backup-${stamp}-${process.pid}.db`);
  try {
    db.exec(`VACUUM INTO '${tmp.replace(/'/g, "''")}'`);
    const buf = fs.readFileSync(tmp);
    fs.unlinkSync(tmp);
    void audit({ action: "backup", entity: "Database", details: { bytes: buf.length } });
    return new Response(buf, {
      headers: { "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename="area11-backup-${stamp}.db"` },
    });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "backup failed" }, { status: 500 });
  }
}
