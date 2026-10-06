// Area11 - QUARANTINE (Spec 3.3): wapsi hua maal jo abhi shelf par nahi
//   GET  = fehrist dekhein
//   POST = janch ke baad maal stock me wapas dalen (sirf owner/manager)
import { handle, guard } from "@/lib/api";
import { quarantineRows, releaseFromQuarantine } from "@/lib/returns";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  return handle(() => ({ rows: quarantineRows() }), { module: "Returns", entity: "Quarantine" });
}

export async function POST(req: Request) {
  const b = (await req.json()) as { id: number };
  return handle((u) => releaseFromQuarantine(Number(b.id), u), {
    action: "update",
    module: "Returns",
    entity: "SaleReturn",
    entityId: b.id,
    req,
  });
}
