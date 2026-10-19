/*
PREVIOUS CODE - commented out on purpose (2026-10-12).
Reference only: kept readable so it can be studied later,
but NOTHING inside runs, so it cannot throw errors.
// Area11 - Ginti lagu karo (asal stock durust) -- sirf owner
import { handleOwner } from "@/lib/api";
import { applyStockTake } from "@/lib/stock-take";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handleOwner((u) => applyStockTake(Number(id), u));
}

*/

export {};
