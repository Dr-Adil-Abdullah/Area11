/*
PREVIOUS CODE - commented out on purpose (2026-10-12).
Reference only: kept readable so it can be studied later,
but NOTHING inside runs, so it cannot throw errors.
import { handle } from "@/lib/api";
import { receiveCustomerPayment } from "@/lib/cash";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const b = (await req.json()) as { customerId: number; amountPaisa: number; method?: string; note?: string };
  return handle((u) => receiveCustomerPayment(Number(b.customerId), Number(b.amountPaisa), b.method ?? "cash", b.note ?? null, u),
    { module: "Customers", entity: "Customer", entityId: b.customerId, req });
}

*/

export {};
