// Area11 - Bulk update (asli kaam -- ek hi transaction me)
import { NextResponse } from "next/server";
import { guard, SHOP_ROLES } from "@/lib/api";
import { commitBulkUpdate } from "@/lib/bulk";
import { requireUser } from "@/lib/session";

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
    const includeSettings = form.get("includeSettings") === "1" || form.get("includeSettings") === "true";
    const buf = Buffer.from(await file.arrayBuffer());
    const user = await requireUser();
    const result = await commitBulkUpdate(buf, { includeSettings }, user);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "update failed" },
      { status: 400 }
    );
  }
}
