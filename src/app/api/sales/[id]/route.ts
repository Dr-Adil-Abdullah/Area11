/*
PREVIOUS CODE - commented out on purpose (2026-10-12).
Reference only: kept readable so it can be studied later,
but NOTHING inside runs, so it cannot throw errors.
import { handle } from "@/lib/api";
import { saleWithReturns } from "@/lib/returns";
export const dynamic = "force-dynamic";
export async function GET(_r: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(() => {
    const d = saleWithReturns(Number(id));
    if (!d) throw new Error("Sale not found");
    return d;
  });
}

*/
