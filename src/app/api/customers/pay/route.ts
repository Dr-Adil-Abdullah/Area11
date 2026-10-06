import { handle } from "@/lib/api";
import { receiveCustomerPayment } from "@/lib/cash";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const b = (await req.json()) as { customerId: number; amountPaisa: number; method?: string; note?: string };
  return handle((u) => receiveCustomerPayment(Number(b.customerId), Number(b.amountPaisa), b.method ?? "cash", b.note ?? null, u),
    { module: "Customers", entity: "Customer", entityId: b.customerId, req });
}
