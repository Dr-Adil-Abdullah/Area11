// Area11 - Database backup download + restore
//   GET  = poori DB ki mehfooz copy (VACUUM INTO -- app chalti rahe)
//   POST = .db file wapas upload karke restore (pehle purani DB ki copy bana leta hai)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { db, getDbPath, reopenDb } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireOwner } from "@/lib/session";
import { jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Upload ki had: 200 MB (poori DB ki file) */
const MAX_BYTES = 200 * 1024 * 1024;

function stamp() {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
}

export async function GET() {
  try {
    await requireOwner();
  } catch (e) {
    return jsonError(e);
  }
  const s = stamp();
  const tmp = path.join(os.tmpdir(), `area11-backup-${s}-${process.pid}.db`);
  try {
    db.exec(`VACUUM INTO '${tmp.replace(/'/g, "''")}'`);
    const buf = fs.readFileSync(tmp);
    fs.unlinkSync(tmp);
    void audit({ action: "backup", entity: "Database", details: { bytes: buf.length } });
    return new Response(buf, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="area11-backup-${s}.db"`,
      },
    });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "backup failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await requireOwner();
  } catch (e) {
    return jsonError(e);
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ ok: false, error: "File nahi mili (.db chunein)." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ ok: false, error: "File bohat bari hai (200 MB se kam honi chahiye)." }, { status: 400 });
  }
  if (!/\.db$/i.test(file.name)) {
    return Response.json({ ok: false, error: "Sirf .db file (jo backup banaya tha)." }, { status: 400 });
  }

  const target = getDbPath();
  const tmpIn = path.join(os.tmpdir(), `area11-restore-${process.pid}-${Date.now()}.db`);
  let safety = "";

  try {
    // 1) file pehle disk par
    fs.writeFileSync(tmpIn, Buffer.from(await file.arrayBuffer()));

    // 2) sahi SQLite hai ya nahi? (header check + count)
    const head = fs.readFileSync(tmpIn).subarray(0, 16).toString("utf8");
    if (!head.startsWith("SQLite format 3")) {
      throw new Error("Yeh asli SQLite backup nahi lagti.");
    }
    const { DatabaseSync } = await import("node:sqlite");
    const probe = new DatabaseSync(tmpIn);
    const tables = probe
      .prepare("SELECT COUNT(*) n FROM sqlite_master WHERE type='table'")
      .get() as { n: number };
    const hasProducts = probe
      .prepare("SELECT COUNT(*) n FROM sqlite_master WHERE type='table' AND name='products'")
      .get() as { n: number };
    probe.close();
    if (!tables.n || !hasProducts.n) {
      throw new Error("Is file me Area11 ka data nahi mila (products table nahi hai).");
    }

    // 3) purani DB ki hifazati copy (ghalti ho to wapas mil jaye)
    if (fs.existsSync(target)) {
      safety = path.join(path.dirname(target), `area11-before-restore-${stamp()}.db`);
      fs.copyFileSync(target, safety);
    }

    // 4) purani DB checkpoint + band, nayi file rakh do, phir dobara kholo
    try {
      db.exec("PRAGMA wal_checkpoint(TRUNCATE);");
    } catch {
      /* checkpoint na bane to bhi copy theek hai */
    }
    db.close();
    fs.copyFileSync(tmpIn, target);
    for (const extra of ["-wal", "-shm"]) {
      const p = target + extra;
      if (fs.existsSync(p)) fs.rmSync(p, { force: true });
    }
    reopenDb(); // ab poora app nayi DB par chal raha hai

    // 5) Blackbox me darj (nayi DB me bhi, kyun ke restore ke baad likha ja raha hai)
    void audit({
      action: "restore",
      entity: "Database",
      details: { file: file.name, bytes: file.size, safetyCopy: safety || null },
    });

    const { listProducts } = await import("@/lib/catalog");
    const { total } = listProducts({ limit: 1 });

    return Response.json({
      ok: true,
      needRestart: false,
      message: "Backup wapas aa gaya — app abhi nayi database par chal rahi hai.",
      safetyCopy: safety ? path.basename(safety) : null,
      products: total,
    });
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : "restore failed" },
      { status: 400 }
    );
  } finally {
    if (fs.existsSync(tmpIn)) fs.rmSync(tmpIn, { force: true });
  }
}
