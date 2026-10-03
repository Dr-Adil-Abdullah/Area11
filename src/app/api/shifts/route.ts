// Area11 - Galla / shift API: khula hua dekho, kholo, band karo (owner + manager)
import { NextResponse } from "next/server";
import { guard, SHOP_ROLES } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { closeShift, currentShift, listShifts, openShift, shiftFlow, shiftVarianceToday } from "@/lib/shifts";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await guard(SHOP_ROLES);
  if (denied) return denied;
  const open = currentShift();
  return NextResponse.json({
    ok: true,
    open: open ?? null,
    flow: open ? shiftFlow(open.id) : null,
    shifts: listShifts(20),
    todayVariancePaisa: shiftVarianceToday(),
  });
}

export async function POST(req: Request) {
  const denied = await guard(SHOP_ROLES);
  if (denied) return denied;
  try {
    const b = (await req.json()) as {
      action?: "open" | "close";
      openingFloatPaisa?: number;
      actualPaisa?: number;
      note?: string | null;
    };
    const user = await requireUser();
    if (b.action === "open") {
      const r = openShift(Number(b.openingFloatPaisa ?? 0), user, b.note ?? null);
      return NextResponse.json({ ok: true, id: r.id });
    }
    if (b.action === "close") {
      const r = closeShift(Number(b.actualPaisa ?? 0), b.note ?? null, user);
      return NextResponse.json({ ok: true, ...r });
    }
    throw new Error("action 'open' ya 'close' likhein");
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "failed" }, { status: 400 });
  }
}
