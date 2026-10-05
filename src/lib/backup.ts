// ---------------------------------------------------------------------------
// Area11 - Backup: ab photos ke SATH (ek hi .zip file me sab kuch)
// ---------------------------------------------------------------------------
// Owners ka hukum (U-19): "backup must also copy data/photos/".
//
// Is file me:
//   * dbBytes()          -> VACUUM INTO se DB ki mehfooz copy (app chalti rahe)
//   * makeBackupZip()    -> { zip: Buffer, dbBytes, photoCount }  (db + photos)
//   * readBackupZip()    -> zip se DB aur photos wapas
//   * autoBackupIfDue()  -> rozana (ya jitni der tay ho) khud-b-khud backup
//   * listBackups()      -> data/backups/ ki fehrist
//
// ZIP kyun? Photos alag folder me hain — ek hi file me sab kuch dene ke liye.
// Hum STORE (bina compression) istemal karte hain: DB aur images pehle se
// compressed hote hain, aur koi naya package (archiver waghaira) chahiye nahi.
// ---------------------------------------------------------------------------

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { db } from "./db";
import { PHOTO_DIR } from "./photos";
import { buildZip, readZip, type ZipEntry } from "./zip";

export const BACKUP_DIR = path.join(process.cwd(), "data", "backups");

// ---------------------------------------------------------------------------
// DB ki copy (VACUUM INTO -- app chalti rahe, kuch band nahi hota)
// ---------------------------------------------------------------------------
export function dbBytes(): Buffer {
  const s = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const tmp = path.join(os.tmpdir(), `area11-backup-${s}-${process.pid}.db`);
  try {
    db.exec(`VACUUM INTO '${tmp.replace(/'/g, "''")}'`);
    const buf = fs.readFileSync(tmp);
    return buf;
  } finally {
    if (fs.existsSync(tmp)) fs.rmSync(tmp, { force: true });
  }
}

/** data/photos/ ki sari files */
export function photoFiles(): { name: string; data: Buffer }[] {
  if (!fs.existsSync(PHOTO_DIR)) return [];
  return fs
    .readdirSync(PHOTO_DIR)
    .filter((f) => fs.statSync(path.join(PHOTO_DIR, f)).isFile())
    .map((f) => ({ name: f, data: fs.readFileSync(path.join(PHOTO_DIR, f)) }));
}

/** Poora backup: ek .zip jis me database + sari photos */
export function makeBackupZip(): { zip: Buffer; dbSize: number; photoCount: number } {
  const database = dbBytes();
  const photos = photoFiles();
  const zip = buildZip([
    { name: "area11.db", data: database },
    ...photos.map((p) => ({ name: `photos/${p.name}`, data: p.data })),
    {
      name: "README.txt",
      data: Buffer.from(
        [
          "Area11 backup (database + photos)",
          `Banaya: ${new Date().toISOString()}`,
          `Database: area11.db (${database.length} bytes)`,
          `Photos: ${photos.length} files (photos/ folder me)`,
          "",
          "Wapas lane ka tareeqa: app me Black box / Backup safhe par ja kar",
          "isi .zip file ko upload karein — DB aur photos dono wapas aa jayenge.",
        ].join("\n"),
        "utf8"
      ),
    },
  ]);
  return { zip, dbSize: database.length, photoCount: photos.length };
}

// ---------------------------------------------------------------------------
// Rozana (khud-b-khud) backup — data/backups/ me
// ---------------------------------------------------------------------------
export type BackupFile = { name: string; bytes: number; at: string; kind: "zip" | "db" };

export function listBackups(): BackupFile[] {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => /\.(zip|db)$/i.test(f))
    .map((f) => {
      const st = fs.statSync(path.join(BACKUP_DIR, f));
      return {
        name: f,
        bytes: st.size,
        at: st.mtime.toISOString(),
        kind: (/\.zip$/i.test(f) ? "zip" : "db") as "zip" | "db",
      };
    })
    .sort((a, b) => (a.at < b.at ? 1 : -1));
}

/** Purane backups kaat do (jagah bachane ke liye) */
function pruneBackups(keep: number): string[] {
  const all = listBackups();
  const removed: string[] = [];
  for (const f of all.slice(Math.max(0, keep))) {
    fs.rmSync(path.join(BACKUP_DIR, f.name), { force: true });
    removed.push(f.name);
  }
  return removed;
}

export type AutoBackupResult =
  | { ran: false; reason: string; last?: BackupFile | null }
  | { ran: true; file: string; bytes: number; dbSize: number; photoCount: number; removed: string[] };

/**
 * Waqt aa gaya to backup banao, warna chhoR do.
 * Har jagah se call ho sakti hai (safha khulte hi) — ye khud sochta hai ke
 * aaj ka backup ho chuka hai ya nahi.
 */
export function autoBackupIfDue(opts: { enabled?: boolean; everyHours?: number; keep?: number } = {}): AutoBackupResult {
  const { enabled = false, everyHours = 24, keep = 7 } = opts;
  const last = listBackups()[0] ?? null;
  if (!enabled) return { ran: false, reason: "Khud-b-khud backup Settings me band hai.", last };

  if (last) {
    const ageMs = Date.now() - new Date(last.at).getTime();
    if (ageMs < everyHours * 3600_000) {
      const leftH = Math.max(0.1, (everyHours * 3600_000 - ageMs) / 3600_000);
      return { ran: false, reason: `Aaj ka backup pehle ho chuka hai (agla ~${leftH.toFixed(1)} ghante baad).`, last };
    }
  }

  const s = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const { zip, dbSize, photoCount } = makeBackupZip();
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const file = `area11-${s}.zip`;
  fs.writeFileSync(path.join(BACKUP_DIR, file), zip);
  const removed = pruneBackups(keep);
  return { ran: true, file, bytes: zip.length, dbSize, photoCount, removed };
}

/** Photos wapas data/photos/ me daalo (restore ke waqt) */
export function restorePhotos(entries: { name: string; data: Buffer }[]): number {
  fs.mkdirSync(PHOTO_DIR, { recursive: true });
  let n = 0;
  for (const e of entries) {
    if (!e.name.startsWith("photos/")) continue;
    const base = path.basename(e.name);
    if (!base || base === "." || base === "..") continue;
    fs.writeFileSync(path.join(PHOTO_DIR, base), e.data);
    n++;
  }
  return n;
}
