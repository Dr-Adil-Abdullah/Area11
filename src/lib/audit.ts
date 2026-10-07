// ---------------------------------------------------------------------------
// Area11 - Audit log / Blackbox (Spec 13 + Spec 2: har kaam ka pakka record)
// ---------------------------------------------------------------------------
// Usul (Spec 2 - Audit Logs & System Security):
//   * HAR module me log lazmi hai (POS, Stock, Returns, Settings, Users, Backup ...)
//   * HAR action log hoga: sale, return, stock update, edit, delete, login
//   * Har entry me: kon (user id + naam), kab (timestamp), kya (action),
//     kis cheez par (entity/id), aur PURANI vs NAYI value
//   * Log kabhi delete nahi hota (permanent)
// ---------------------------------------------------------------------------

import { run } from "./db";
import { diffFields, splitDiff, valuesForLog } from "./audit-diff";

export type AuditAction =
  | "login"
  | "login_failed"
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
  | "sync"
  | "negative_sale"   // stock minus me gaya (Spec 1.2)
  | "dismiss_alert"   // malik ne wajah likh kar alert khatam kiya (U-31)
  | "restore_alert"   // malik ne khatam ki hui alert wapas layi
  | "denied";         // ijazat nahi mili (security event)

/** Kaun se module se kaam hua (Spec 2: "every module of the software") */
export type AuditModule =
  | "POS"
  | "Sales"
  | "Returns"
  | "Inventory"
  | "Purchases"
  | "Customers"
  | "Suppliers"
  | "Stock"
  | "Settings"
  | "Users"
  | "Backup"
  | "Sync"
  | "Import"
  | "Auth"
  | "Alerts"
  | "Other";

export type AuditEntry = {
  action: AuditAction;
  userId?: number | null;
  userName?: string | null;
  entity?: string | null;
  entityId?: string | number | null;
  details?: unknown;
  ip?: string;
  module?: AuditModule;
  /** Poora purana record (ya sirf woh fields jo dekhni hain) */
  before?: Record<string, unknown> | null;
  /** Poora naya record -- farq (diff) khud nikal liya jayega */
  after?: Record<string, unknown> | null;
  /** Chahein to purani value seedhi dein (before/after ke bajaye) */
  oldValue?: unknown;
  newValue?: unknown;
};

function stringify(v: unknown): string | null {
  if (v == null) return null;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export function audit(params: AuditEntry): void {
  try {
    // before/after diye hon to farq khud nikal lo
    let oldRaw = params.oldValue;
    let newRaw = params.newValue;
    // Naya record / mitaya gaya / sirf badla hua -- sab ka hisaab ek hi jagah
    const { oldValue: o, newValue: n } = valuesForLog(params.before, params.after);
    if (o || n) {
      oldRaw = params.oldValue ?? o;
      newRaw = params.newValue ?? n;
    }
    run(
      `INSERT INTO audit_logs
         (user_id, user_name, action, entity, entity_id, details, ip, module, old_value, new_value)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        params.userId ?? null,
        params.userName ?? null,
        params.action,
        params.entity ?? null,
        params.entityId == null ? null : String(params.entityId),
        stringify(params.details),
        params.ip ?? null,
        params.module ?? null,
        stringify(oldRaw),
        stringify(newRaw),
      ]
    );
  } catch {
    // Audit fail hone par app na ruke -- magar console me zaroor aaye
    console.error("[audit] log likha nahi ja saka:", params.action);
  }
}

/** async jagahon ke liye (await auditq(...)) -- kaam wahi hai */
export async function auditq(params: AuditEntry): Promise<void> {
  audit(params);
}

/** Request se IP nikalne ka chhota helper (Spec 2: accountability) */
export function ipFrom(req: Request): string {
  try {
    const h = req.headers;
    const fwd = h.get("x-forwarded-for");
    if (fwd) return fwd.split(",")[0]!.trim();
    return h.get("x-real-ip") ?? "";
  } catch {
    return "";
  }
}

/**
 * Aam "record badla" wala log -- purana aur naya record do, baqi sab khud.
 *   await auditUpdate({ module:"Inventory", entity:"Product", entityId:id,
 *                       before: puranaRecord, after: nayaRecord, user });
 */
export function auditUpdate(params: {
  module: AuditModule;
  entity: string;
  entityId: string | number;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  user?: { id?: number; name?: string; role?: string } | null;
  action?: AuditAction;
  details?: unknown;
  ip?: string;
}): void {
  audit({
    action: params.action ?? "update",
    userId: params.user?.id ?? null,
    userName: params.user?.name ?? null,
    entity: params.entity,
    entityId: params.entityId,
    module: params.module,
    before: params.before ?? null,
    after: params.after ?? null,
    details: params.details,
    ip: params.ip,
  });
}
