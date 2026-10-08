// Area11 - Ek ginti session: dekho / cancel karo
import { NextResponse } from "next/server";
import { guard, handle, handleOwner, SHOP_ROLES } from "@/lib/api";
import { getStockTake, stockTakeItems, cancelStockTake } from "@/lib/stock-take";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await guard(SHOP_ROLES);
  if (denied) return denied;
  const { id } = await ctx.params;
  const take = getStockTake(Number(id));
  if (!take) return NextResponse.json({ ok: false, error: "Ginti ka session nahi mila." }, { status: 404 });
  return NextResponse.json({ ok: true, take, items: stockTakeItems(Number(id)) });
}

/** Khuli ginti cancel karo (owner) */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handleOwner((u) => {
    cancelStockTake(Number(id), u);
    return { cancelled: true };
  });
}
