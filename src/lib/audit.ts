// ---------------------------------------------------------------------------
// Area11 - Audit log (Spec 13: blackbox -- kabhi delete nahi hota)
// ---------------------------------------------------------------------------

import { run } from "./db";

export type AuditAction =
  | "login"
  | "logout"
  | "create"
  | "update"
  | "delete"
  | "price_change"
  | "void"
  | "return"
  | "settings_change"
  | "backup"
  | "restore"
  | "sync";

export async function audit(params: {
  action: AuditAction;
  userId?: number | null;
  userName?: string | null;
  entity?: string;
  entityId?: string | number;
  details?: unknown;
  ip?: string;
}): Promise<void> {
  try {
    run(
      `INSERT INTO audit_logs (user_id, user_name, action, entity, entity_id, details, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        params.userId ?? null,
        params.userName ?? null,
        params.action,
        params.entity ?? null,
        params.entityId == null ? null : String(params.entityId),
        params.details == null ? null : JSON.stringify(params.details),
        params.ip ?? null,
      ]
    );
  } catch {
    // Audit fail hone par app na ruke -- magar console me zaroor aaye
    console.error("[audit] log likha nahi ja saka:", params.action);
  }
}
