import { handle } from "@/lib/api";
import { paySupplier } from "@/lib/cash";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const b = (await req.json()) as { supplierId: number; amountPaisa: number; note?: string };
  return handle((u) => paySupplier(Number(b.supplierId), Number(b.amountPaisa), b.note ?? null, u));
}
