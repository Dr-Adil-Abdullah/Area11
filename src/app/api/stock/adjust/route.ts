// Area11 - Stock adjustment API (nuqsan / write-off / ginti ki durusti) -- owner + manager
import { guard, SHOP_ROLES } from "@/lib/api";
import { NextResponse } from "next/server";
import { adjustStock, listAdjustments, writeOffSummary, type StockAdjustInput } from "@/lib/stock";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await guard(SHOP_ROLES);
  if (denied) return denied;
  const url = new URL(req.url);
  const productId = Number(url.searchParams.get("productId") ?? 0);
  const limit = Number(url.searchParams.get("limit") ?? 50);
  return NextResponse.json({
    ok: true,
    adjustments: listAdjustments({ limit, productId: productId || undefined }),
    summary: writeOffSummary(),
  });
}

export async function POST(req: Request) {
  const denied = await guard(SHOP_ROLES);
  if (denied) return denied;
  try {
    const body = (await req.json()) as StockAdjustInput;
    // user id audit ke liye
    const { requireUser } = await import("@/lib/session");
    const user = await requireUser();
    const result = adjustStock(body, user);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "failed" },
      { status: 400 }
    );
  }
}
