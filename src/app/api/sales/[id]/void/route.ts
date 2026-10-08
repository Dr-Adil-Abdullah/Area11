import { handle } from "@/lib/api";
import { voidSale } from "@/lib/returns";
export const dynamic = "force-dynamic";
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const b = (await req.json().catch(() => ({}))) as { reason?: string };
  return handle((u) => voidSale(Number(id), b.reason ?? null, u),
    { action: "void", module: "Sales", entity: "Sale", entityId: id, req });
}
