// Area11 - Sare records ki Excel file (photos ke baghair) download
import { guard, SHOP_ROLES } from "@/lib/api";
import { buildDataFile } from "@/lib/bulk";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await guard(SHOP_ROLES);
  if (denied) return denied;
  const today = new Date().toISOString().slice(0, 10);
  const buf = buildDataFile();
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="area11-data-${today}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
