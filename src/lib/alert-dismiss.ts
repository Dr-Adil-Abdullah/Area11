// ---------------------------------------------------------------------------
// Area11 - ALERT DISMISS (malik ki wajah ke sath)  -- U-31
// ---------------------------------------------------------------------------
// Malik ka hukum (6-Oct-2026):
//   "jis ko malik baad mein khud khatam kar sakta hai REASON likh ke"
//
// Usul:
//   * KOI bhi alert sirf OWNER khatam kar sakta hai
//   * Wajah (reason) likhna LAZMI hai -- bina wajah ke khatam nahi hoga
//   * Wajah database me mehfooz rahe gi (alert_dismissals table)
//   * Wajah black-box (audit) me bhi darj ho gi: purani value -> nayi value
//   * Jab tak malik wajah likh kar khatam na kare, alert HAR SAFHE par
//     nazar aata rahe ga (session khatam ho ya browser band ho)
//
// alert_key ka dhancha:
//   "negstock:<productId>"   = koi dawa stock me MINUS hai
//   "provisional:<id>"       = bina bill wapsi (abhi tak bill nahi jura)
// ---------------------------------------------------------------------------

import { get, query, run } from "./db";
import { audit } from "./audit";
import { alertKey, removeDismissed, reasonError } from "./alert-shared";

export type AlertRow = {
  key: string;
  type: "negstock" | "provisional" | "quarantine";
  tone: "red" | "amber";
  title: string;
  detail: string;
  entityId: number | null;
  href: string;
};

export type DismissedRow = {
  id: number;
  alert_key: string;
  alert_type: string;
  entity_id: number | null;
  reason: string;
  user_id: number | null;
  user_name: string | null;
  created_at: string;
};

type U = { id?: number; name?: string; role?: string } | null | undefined;

/** Kaunsi alerts malik pehle hi khatam kar chuka hai (wajah ke sath) */
export function dismissals(): DismissedRow[] {
  try {
    return query<DismissedRow>(
      `SELECT * FROM alert_dismissals ORDER BY id DESC LIMIT 500`
    );
  } catch {
    return [];
  }
}

export function dismissedKeys(): Set<string> {
  try {
    return new Set(
      query<{ alert_key: string }>(`SELECT alert_key FROM alert_dismissals`).map((r) => r.alert_key)
    );
  } catch {
    return new Set<string>();
  }
}

// ---------------------------------------------------------------------------
// ALERT KI LIST (jo abhi zinda hain -- khatam ki hui is me nahi aati)
// ---------------------------------------------------------------------------
export function activeAlerts(): AlertRow[] {
  const out: AlertRow[] = [];
  const off = dismissedKeys();
  // (removeDismissed = saaf function, test ke qabil: dekhein alert-shared.ts)

  // (1) NEGATIVE STOCK -- dawa-dawa ke hisab se (U-25 / U-30 / U-31)
  try {
    const rows = query<{ product_id: number; name: string; base_unit: string; qty: number }>(
      `SELECT p.id AS product_id, p.name, p.base_unit, SUM(b.qty_base) AS qty
         FROM batches b JOIN products p ON p.id = b.product_id
        WHERE b.active = 1
        GROUP BY p.id, p.name, p.base_unit
       HAVING qty < 0
        ORDER BY qty ASC, p.name`
    );
    for (const r of rows) {
      const key = alertKey("negstock", r.product_id);
      if (off.has(key)) continue; // malik ne wajah likh kar khatam kar diya
      out.push({
        key,
        type: "negstock",
        tone: "red",
        title: `${r.name} — stock MINUS me hai (${r.qty} ${r.base_unit})`,
        detail: "Hisab ke mutabiq ye dawa minus me hai. Malik wajah likh kar is alert ko khatam kar sakein ge.",
        entityId: r.product_id,
        href: `/products`,
      });
    }
  } catch {
    /* table abhi bani hi nahi to koi baat nahi */
  }

  // (2) BINA BILL WAPSI (jaldi wali) -- U-33:
  //     "maal foran stock me" + "ALERT us waqt tak rahe ga jab tak malik
  //      wajah likh kar khatam na kare" -- yani bill jurne ke BAAD bhi.
  //     Is liye yahan status = pending/linked SAB aate hain; sirf woh nahi
  //     jinhein malik ne wajah likh kar khatam kar diya ho.
  try {
    const rows = query<{
      id: number; code: string; date: string; refund_paisa: number; status: string;
      phone: string | null; reason: string | null; user_name: string | null;
      linked_sale_code: string | null;
    }>(
      `SELECT p.id, p.code, p.date, p.refund_paisa, p.status, p.phone, p.reason,
              u.name AS user_name, s.code AS linked_sale_code
         FROM provisional_returns p
         LEFT JOIN users u ON u.id = p.user_id
         LEFT JOIN sales s ON s.id = p.linked_sale_id
        WHERE p.status IN ('pending','linked')
        ORDER BY p.id DESC`
    );
    for (const r of rows) {
      const key = alertKey("provisional", r.id);
      if (off.has(key)) continue; // malik ne wajah likh kar khatam kar diya
      const linked = r.status === "linked";
      out.push({
        key,
        type: "provisional",
        tone: linked ? "amber" : "red",
        title: linked
          ? `Bina bill wapsi ${r.code} — bill (${r.linked_sale_code ?? "?"}) jur gaya, malik ki tasdeeq baqi`
          : `Bina bill wapsi ${r.code} — bill abhi nahi jura`,
        detail:
          `Rs ${(r.refund_paisa / 100).toLocaleString("en-PK")} wapas diye gaye, maal foran stock me add ho gaya.` +
          (linked
            ? ` Bill jur chuka hai, magar malik ka hukum hai: ALERT tab tak rahe ga jab tak malik wajah likh kar khatam na kare.`
            : ` Bill baad mein jora ja sakta hai, magar ye ALERT tab tak rahe ga jab tak malik wajah likh kar khatam na kare.`) +
          (r.phone ? ` (phone: ${r.phone})` : ""),
        entityId: r.id,
        href: `/sales`,
      });
    }
  } catch {
    /* ignore */
  }

  // (3) QUARANTINE (U-34): jo maal abhi bhi quarantine me hai -- malik faisla kare
  //     (stock me wapas / expiry-kharaab / bech dein). Jab tak faisla na ho ALERT.
  try {
    const rows = query<{ id: number; qcode: string | null; name: string; qty_base: number; base_unit: string; date: string }>(
      `SELECT r.id, r.qcode, p.name, r.qty_base, p.base_unit, r.date
         FROM sale_returns r JOIN products p ON p.id = r.product_id
        WHERE r.disposition = 'quarantine' AND r.qty_base > 0
        ORDER BY r.id DESC`
    );
    for (const r of rows) {
      const key = alertKey("quarantine", r.id);
      if (off.has(key)) continue;
      out.push({
        key,
        type: "quarantine",
        tone: "amber",
        title: `قرنطینہ ${r.qcode ?? "(baghair number)"} — ${r.name} (${r.qty_base} ${r.base_unit}) abhi quarantine me hai`,
        detail:
          `Malik faisla karein: maal (الف) stock me wapas, (ب) expiry/kharaab (write-off), ya (ج) bech dein. ` +
          `Jab tak faisla na ho ye ALERT rahe ga — malik wajah likh kar bhi khatam kar sakte hain.`,
        entityId: r.id,
        href: `/alerts`,
      });
    }
  } catch {
    /* ignore */
  }

  return out;
}

// ---------------------------------------------------------------------------
// MALIK: wajah likh kar alert khatam karein
// ---------------------------------------------------------------------------
export function dismissAlert(
  input: { key: string; type: string; entityId?: number | null; reason?: string | null },
  user?: U
): { ok: true; key: string } {
  const role = user?.role ?? "";
  if (role && role !== "owner") {
    throw new Error("Alert khatam karna sirf MALIK (owner) ka kaam hai.");
  }
  const bad = reasonError(input.reason);
  if (bad) throw new Error(bad);
  if (!input.key) throw new Error("Alert ki pehchan nahi mili.");
  const reason = (input.reason ?? "").trim();

  run(
    `INSERT OR REPLACE INTO alert_dismissals
       (alert_key, alert_type, entity_id, reason, user_id, user_name)
     VALUES (?,?,?,?,?,?)`,
    [input.key, input.type || "other", input.entityId ?? null, reason, user?.id ?? null, user?.name ?? null]
  );

  // Spec 2: ye bhi black-box me darj ho (purani value -> nayi value)
  void audit({
    action: "dismiss_alert",
    userId: user?.id ?? null,
    userName: user?.name ?? null,
    entity: "Alert",
    entityId: input.entityId ?? null,
    module: "Alerts",
    before: { alert: input.key, status: "active", reason: null },
    after: { alert: input.key, status: "dismissed", reason },
    details: { key: input.key, type: input.type, reason },
  });

  return { ok: true, key: input.key };
}

/** Malik chahe to khatam ki hui alert wapas bhi la sakta hai (wajah ke sath) */
export function restoreAlert(key: string, user?: U): void {
  const role = user?.role ?? "";
  if (role && role !== "owner") {
    throw new Error("Alert wapas lana bhi sirf MALIK ka kaam hai.");
  }
  const before = get<{ reason: string }>(`SELECT reason FROM alert_dismissals WHERE alert_key = ?`, [key]);
  run(`DELETE FROM alert_dismissals WHERE alert_key = ?`, [key]);
  void audit({
    action: "restore_alert",
    userId: user?.id ?? null,
    userName: user?.name ?? null,
    entity: "Alert",
    entityId: null,
    module: "Alerts",
    before: { alert: key, status: "dismissed", reason: before?.reason ?? null },
    after: { alert: key, status: "active", reason: null },
    details: { key },
  });
}
