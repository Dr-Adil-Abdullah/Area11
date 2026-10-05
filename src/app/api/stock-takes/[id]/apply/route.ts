// Area11 - Ginti lagu karo (asal stock durust) -- sirf owner
import { handleOwner } from "@/lib/api";
import { applyStockTake } from "@/lib/stock-take";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handleOwner((u) => applyStockTake(Number(id), u));
}
