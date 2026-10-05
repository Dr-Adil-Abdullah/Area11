// ---------------------------------------------------------------------------
// Area11 - Blackbox viewer: "kis ne, kab, kya kiya" -- sirf owner
// ---------------------------------------------------------------------------

import { get, query } from "./db";

export type AuditRow = {
  id: number;
  at: string;
  user_name: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  details: string | null;
  ip: string | null;
};

export type AuditFilters = {
  q?: string;         // entity id ya details me dhoond
  action?: string;    // sale / update / price_change ...
  entity?: string;    // Product / Sale / Customer ...
  user?: string;      // naam ka hissa
  from?: string;      // YYYY-MM-DD
  to?: string;
  limit?: number;     // max 500
};

const ACTIONS = [
  "login", "login_failed", "logout", "create", "update", "delete",
  "price_change", "void", "return", "settings_change", "backup", "restore", "sync",
];

/** Blackbox kabhi delete nahi hota -- is liye sirf parhna hai, mitana nahi */
export function listAudit(f: AuditFilters = {}): { rows: AuditRow[]; total: number; byAction: Record<string, number> } {
  const where: string[] = [];
  const params: (string | number)[] = [];

  if (f.action && f.action !== "all") {
    where.push("action = ?");
    params.push(f.action);
  }
  if (f.entity && f.entity !== "all") {
    where.push("entity = ?");
    params.push(f.entity);
  }
  if (f.user) {
    where.push("(user_name LIKE ? OR user_id = ?)");
    params.push(`%${f.user.trim()}%`, Number(f.user) || 0);
  }
  if (f.from) {
    where.push("date(at) >= date(?)");
    params.push(f.from);
  }
  if (f.to) {
    where.push("date(at) <= date(?)");
    params.push(f.to);
  }
  if (f.q && f.q.trim()) {
    const like = `%${f.q.trim()}%`;
    where.push("(details LIKE ? OR entity_id LIKE ? OR entity LIKE ? OR user_name LIKE ?)");
    params.push(like, like, like, like);
  }

  const w = where.length ? "WHERE " + where.join(" AND ") : "";
  const limit = Math.min(Math.max(f.limit ?? 200, 1), 500);

  const rows = query<AuditRow>(
    `SELECT id, at, user_name, action, entity, entity_id, details, ip
       FROM audit_logs ${w} ORDER BY id DESC LIMIT ?`,
    [...params, limit]
  );

  const total = get<{ n: number }>(`SELECT COUNT(*) n FROM audit_logs ${w}`, params)?.n ?? 0;

  const byAction: Record<string, number> = {};
  for (const a of query<{ action: string; n: number }>(
    "SELECT action, COUNT(*) n FROM audit_logs GROUP BY action ORDER BY n DESC"
  )) {
    byAction[a.action] = a.n;
  }

  return { rows, total, byAction };
}

/** Filter chunne ke liye: kaun kaun se entity hain */
export function auditEntities(): string[] {
  return query<{ entity: string }>(
    "SELECT DISTINCT entity FROM audit_logs WHERE entity IS NOT NULL ORDER BY entity"
  ).map((r) => r.entity);
}

export function auditUsers(): string[] {
  return query<{ user_name: string }>(
    "SELECT DISTINCT user_name FROM audit_logs WHERE user_name IS NOT NULL ORDER BY user_name"
  ).map((r) => r.user_name);
}

export { ACTIONS as AUDIT_ACTIONS };
