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
