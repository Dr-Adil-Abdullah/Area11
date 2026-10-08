// Area11 - data/photos/ se tasveer serve karna (owner/manager/staff sab dekh sakte hain)
import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { guard } from "@/lib/api";
import { PHOTO_DIR } from "@/lib/photos";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".webp": "image/webp", ".gif": "image/gif",
};

export async function GET(req: Request) {
  const denied = await guard(undefined, { module: "Other", entity: "Photo", req });
  if (denied) return denied;

  const name = new URL(req.url).searchParams.get("f") ?? "";
  // Hifazat: sirf seedha naam, koi ../ nahi
  if (!/^[A-Za-z0-9._-]+$/.test(name)) return new NextResponse("bad name", { status: 400 });

  const file = path.join(PHOTO_DIR, name);
  if (!file.startsWith(PHOTO_DIR) || !fs.existsSync(file)) {
    return new NextResponse("not found", { status: 404 });
  }
  // NOTE: tasveer DEKHNE ka log nahi likhte -- har safhe par kai dafa load hoti
  //       hai, is se blackbox shor se bhar jata hai. Tasveer BADALNE ka record
  //       products/customers ke "purana → naya" me khud aa jata hai.

  const buf = fs.readFileSync(file);
  const type = TYPES[path.extname(name).toLowerCase()] ?? "application/octet-stream";
  return new NextResponse(buf, {
    headers: { "Content-Type": type, "Cache-Control": "private, max-age=31536000, immutable" },
  });
}
