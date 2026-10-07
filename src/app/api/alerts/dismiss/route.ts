// Area11 - ALERT DISMISS / RESTORE (U-31: sirf malik, wajah lazmi)
//   GET    = zinda alerts ki fehrist (har safhe ke liye)
//   POST   = malik wajah likh kar alert khatam karein
//   DELETE = malik khatam ki hui alert wapas layein
import { handle, guard } from "@/lib/api";
import { activeAlerts, dismissAlert, restoreAlert, dismissals } from "@/lib/alert-dismiss";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  return handle(() => ({ alerts: activeAlerts(), dismissed: dismissals() }), {
    module: "Alerts",
    entity: "Alerts",
  });
}

export async function POST(req: Request) {
  const b = (await req.json()) as {
    key: string;
    type?: string;
    entityId?: number | null;
    reason?: string | null;
  };
  return handle(
    (u) => dismissAlert({ key: b.key, type: b.type ?? "other", entityId: b.entityId ?? null, reason: b.reason }, u),
    { action: "dismiss_alert", module: "Alerts", entity: "Alert", req }
  );
}

export async function DELETE(req: Request) {
  const b = (await req.json()) as { key?: string };
  return handle(
    (u) => {
      restoreAlert(String(b.key ?? ""), u);
      return { ok: true };
    },
    { action: "restore_alert", module: "Alerts", entity: "Alert", req }
  );
}
