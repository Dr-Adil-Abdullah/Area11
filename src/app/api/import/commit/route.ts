// Area11 - Excel import (asli kaam -- sirf theek lines, ek transaction me)
import { guard, SHOP_ROLES } from "@/lib/api";
import { NextResponse } from "next/server";
import { commitImport } from "@/lib/import";
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
    const buf = Buffer.from(await file.arrayBuffer());
    const user = await requireUser();
    const result = await commitImport(buf, user);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "import failed" },
      { status: 400 }
    );
  }
}
