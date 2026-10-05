// Area11 - Reports data (client se range badalne ke liye)
import { NextResponse } from "next/server";
import { guard, SHOP_ROLES } from "@/lib/api";
import { report, todayRange, daysRange, monthRange } from "@/lib/reports";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await guard(SHOP_ROLES);
  if (denied) return denied;
  const u = new URL(req.url);
  const preset = u.searchParams.get("preset") ?? "today";
  const from = u.searchParams.get("from");
  const to = u.searchParams.get("to");

  const range =
    from && to ? { from, to }
    : preset === "7" ? daysRange(7)
    : preset === "30" ? daysRange(30)
    : preset === "month" ? monthRange()
    : todayRange();

  return NextResponse.json({ ok: true, ...report(range) });
}
