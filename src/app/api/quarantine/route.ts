// Area11 - QUARANTINE (Spec 3.3 + U-34): wapsi hua maal jo abhi shelf par nahi
//   GET    = fehrist (abhi quarantine me) + poori history
//   POST   = faisla: stock me wapas / expiry-kharaab / bech diya  (sirf owner/manager)
//            { id, disposition: "restocked" | "expired" | "sold", note? }
//            (purana style: sirf { id } bhejein to "restocked" samjha jaye ga)
import { handle, guard } from "@/lib/api";
import {
  decideQuarantine,
  quarantineHistory,
  quarantineRows,
  type QuarantineDisposition,
} from "@/lib/returns";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  return handle(
    () => ({ rows: quarantineRows(), history: quarantineHistory() }),
    { module: "Returns", entity: "Quarantine" }
  );
}

export async function POST(req: Request) {
  const b = (await req.json()) as {
    id: number;
    disposition?: QuarantineDisposition;
    note?: string | null;
  };
  return handle(
    (u) => decideQuarantine(Number(b.id), b.disposition ?? "restocked", b.note ?? null, u),
    { action: "update", module: "Returns", entity: "Quarantine", entityId: b.id, req }
  );
}
