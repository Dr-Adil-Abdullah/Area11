// Area11 - Bulk update ka dry-run (sirf dikhata hai, DB me kuch nahi likhta)
import { NextResponse } from "next/server";
import { guard, SHOP_ROLES } from "@/lib/api";
import { previewBulkUpdate } from "@/lib/bulk";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const denied = await guard(SHOP_ROLES);
  if (denied) return denied;
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Excel file (.xlsx) chunein" }, { status: 400 });
    }
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "File bohat bari hai (8 MB se kam rakhein)" }, { status: 400 });
    }
    const includeSettings = form.get("includeSettings") === "1" || form.get("includeSettings") === "true";
    const buf = Buffer.from(await file.arrayBuffer());
    const preview = previewBulkUpdate(buf, { includeSettings });
    return NextResponse.json({ ok: true, preview });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: `File kholi nahi ja saki: ${e instanceof Error ? e.message : "unknown"}` },
      { status: 400 }
    );
  }
}
