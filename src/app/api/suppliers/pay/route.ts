/*
PREVIOUS CODE - commented out on purpose (2026-10-12).
Reference only: kept readable so it can be studied later,
but NOTHING inside runs, so it cannot throw errors.
import { handle } from "@/lib/api";
import { paySupplier } from "@/lib/cash";
import { assertShopManager } from "@/lib/session";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const b = (await req.json()) as { supplierId: number; amountPaisa: number; note?: string };
  return handle((u) => {
    assertShopManager(u);
    return paySupplier(Number(b.supplierId), Number(b.amountPaisa), b.note ?? null, u);
  });
}

*/

export {};
