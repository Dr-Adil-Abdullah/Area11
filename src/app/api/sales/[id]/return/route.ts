/*
PREVIOUS CODE - commented out on purpose (2026-10-12).
Reference only: kept readable so it can be studied later,
but NOTHING inside runs, so it cannot throw errors.
import { handle } from "@/lib/api";
import { returnSaleItems } from "@/lib/returns";
export const dynamic = "force-dynamic";
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const b = (await req.json()) as { lines: { saleItemId: number; qtyBase: number; restock?: boolean }[]; reason?: string };
  return handle((u) => returnSaleItems(Number(id), b.lines ?? [], b.reason ?? null, u),
    { action: "return", module: "Returns", entity: "Sale", entityId: id, req });
}

*/

export {};
