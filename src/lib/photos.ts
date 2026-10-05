// ---------------------------------------------------------------------------
// Area11 - Photos: tasveerein DB ke andar NAHIN, data/photos/ folder me
// ---------------------------------------------------------------------------
// Owner ne chuna: "folder me files". Is se database halki rehti hai.
//   DB me sirf file ka naam hai (photo column) -- purana data-URL bhi chalta hai.
//   Public URL: /photos/<file>  (chhoti image, browser cache karta hai)
// ---------------------------------------------------------------------------

import fs from "node:fs";
import path from "node:path";

export const PHOTO_DIR = path.join(process.cwd(), "data", "photos");
export const PHOTO_URL = "/api/photos?f=";
const MAX_BYTES = 6 * 1024 * 1024; // 6 MB (compressed image ke liye kaafi)

export type PhotoInput = { entity: "customer" | "product"; id: number; dataUrl: string };

/** Save karo; wapas file ka naam (DB me wohi rakhein) */
export function savePhoto({ entity, id, dataUrl }: PhotoInput): string {
  const m = /^data:image\/(png|jpeg|jpg|webp|gif);base64,(.*)$/i.exec(dataUrl);
  if (!m) throw new Error("Tasveer sahi nahi lagi — dobara chunein.");
  let ext = m[1].toLowerCase();
  if (ext === "jpeg") ext = "jpg";
  const buf = Buffer.from(m[2], "base64");
  if (buf.length > MAX_BYTES) throw new Error("Tasveer bohat bari hai — chhoti karein.");
  if (buf.length < 100) throw new Error("Tasveer khali hai.");

  fs.mkdirSync(PHOTO_DIR, { recursive: true });

  // Purani tasveer hata do (nayi aa rahi hai)
  deletePhotos(entity, id).catch(() => {});

  const name = `${entity}-${id}-${Date.now()}.${ext}`;
  fs.writeFileSync(path.join(PHOTO_DIR, name), buf);
  return name;
}

/** Is entity ki sab tasveerein hata do (file system se) */
export async function deletePhotos(entity: string, id: number): Promise<void> {
  try {
    if (!fs.existsSync(PHOTO_DIR)) return;
    const prefix = `${entity}-${id}-`;
    for (const f of fs.readdirSync(PHOTO_DIR)) {
      if (f.startsWith(prefix)) fs.rmSync(path.join(PHOTO_DIR, f), { force: true });
    }
  } catch {
    /* tasveer na hatay to app na ruke */
  }
}

/**
 * DB me jo bhi ho (naya file naam ya purana data: URL) -- browser ke liye src
 */
export function photoSrc(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (stored.startsWith("data:")) return stored; // purana record (DB me thi)
  if (stored.startsWith("http")) return stored;   // koi bahar se URL
  return `${PHOTO_URL}${encodeURIComponent(stored)}`;
}
