// Area11 - namoona Excel file download (owner + manager)
import { guard, SHOP_ROLES } from "@/lib/api";
import { NextResponse } from "next/server";
import { buildTemplateFile } from "@/lib/import";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await guard(SHOP_ROLES);
  if (denied) return denied;
  const buf = buildTemplateFile();
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Area11-import-template.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
