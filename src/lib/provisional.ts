// ---------------------------------------------------------------------------
// Area11 - Rush-time "provisional" return (spec 9.2.2 / 9.2.3)
// ---------------------------------------------------------------------------
// Masla: bhid ke waqt gahak bill ke baghair maal wapas laye.
// Hal:   cash foran wapas kar do, maal QUARANTINE me (stock me nahi), aur ek
//        PENDING note bana do jo tab tak surkh chamke jab tak asal bill link
//        na ho jaye (ya owner cancel na kar de).
// Asal bill milne par linkProvisional() us bill se jur jata hai + stock wapas
// daalne ka faisla (restock) sirf owner/manager kar sakta hai.
// ---------------------------------------------------------------------------

import { get, query, run, tx } from "./db";
import { audit } from "./audit";
import { PROV_REASONS, type ProvRow } from "./provisional-shared";

export { PROV_REASONS };
export type { ProvRow };

type U = { id?: number; name?: string; role?: string } | null | undefined;

export type ProvInput = {
  phone?: string | null;
  reason: string;
  notes?: string | null;
  refundPaisa: number;
  items: { productId: number; qtyBase: number }[];
};

/** Agla PR- number (settings me apna counter) */
function nextProvisionalCode(): string {
  const row = get<{ value: string }>("SELECT value FROM settings WHERE key = 'bill.nextProvisionalNo'");
  let no = 1;
  try {
    no = Number(JSON.parse(row?.value ?? "1")) || 1;
  } catch {
    no = Number(row?.value) || 1;
  }
  run(
    `INSERT INTO settings (key, value, updated_at) VALUES ('bill.nextProvisionalNo', ?, datetime('now','localtime'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now','localtime')`,
    [JSON.stringify(no + 1)]
  );
  return `PR-${String(no).padStart(4, "0")}`;
}

export function recordProvisional(input: ProvInput, user?: U): { id: number; code: string; refundPaisa: number } {
  const refund = Math.round(input.refundPaisa ?? 0);
  if (!(refund > 0)) throw new Error("Wapas ki gayi raqam likhein (zero se zyada).");
  const items = (input.items ?? []).filter((i) => Number(i.qtyBase) > 0);
  if (!items.length) throw new Error("Kam az kam ek dawa chunein jo wapas aayi ho.");
  const ids = new Set(items.map((i) => Number(i.productId)));
  if (ids.size !== items.length) throw new Error("Ek hi dawa do dafa na likhein.");

  return tx(() => {
    const code = nextProvisionalCode();
    const res = run(
      `INSERT INTO provisional_returns (code, phone, reason, notes, refund_paisa, status, user_id)
       VALUES (?,?,?,?,?, 'pending', ?)`,
      [
        code,
        input.phone?.trim() || null,
        input.reason || "other",
        input.notes?.trim() || null,
        refund,
        user?.id ?? null,
      ]
    );
    const id = res.lastInsertRowid;
    for (const it of items) {
      const p = get<{ id: number; name: string }>("SELECT id, name FROM products WHERE id = ?", [Number(it.productId)]);
      if (!p) throw new Error(`Dawa nahi mili (id ${it.productId})`);
      run(`INSERT INTO provisional_items (provisional_id, product_id, qty_base) VALUES (?,?,?)`, [
        id,
        p.id,
        Math.round(Number(it.qtyBase)),
      ]);
      // Maal counter par wapas aa gaya magar stock me nahi -- movement me sirf ittila
      run(
        `INSERT INTO stock_movements (product_id, batch_id, type, qty_base, ref_type, ref_id, ref_code, note, user_id)
         VALUES (?, NULL, 'return_in', 0, 'provisional', ?, ?, ?, ?)`,
        [p.id, id, code, "Provisional return -- maal QUARANTINE me (bill ka intezar)", user?.id ?? null]
      );
    }
    // Cash wapas (payments me manfi row -> cash book me refund dikhega)
    run(
      `INSERT INTO payments (method, amount_paisa, user_id, note) VALUES ('cash', ?, ?, ?)`,
      [-refund, user?.id ?? null, `Provisional refund ${code}`]
    );
    void audit({
      action: "return",
      userId: user?.id ?? null,
      userName: user?.name ?? null,
      entity: "ProvisionalReturn",
      entityId: id,
      module: "Returns",
      before: null,
      after: { code, status: "pending", refund_paisa: refund, items: items.length },
      details: { code, refundPaisa: refund, items: items.length },
    });
    return { id, code, refundPaisa: refund };
  });
}

export function listProvisional(opts: { status?: string; limit?: number } = {}): ProvRow[] {
  const where = opts.status ? "WHERE p.status = ?" : "";
  const params: (string | number)[] = [];
  if (opts.status) params.push(opts.status);
  const rows = query<ProvRow>(
    `SELECT p.*, u.name AS user_name, s.code AS linked_code
       FROM provisional_returns p
       LEFT JOIN users u ON u.id = p.user_id
       LEFT JOIN sales s ON s.id = p.linked_sale_id
       ${where}
      ORDER BY p.id DESC
      LIMIT ?`,
    [...params, Math.min(opts.limit ?? 50, 300)]
  );
  for (const r of rows) {
    r.items = query<{ product_id: number; name: string; qty_base: number }>(
      `SELECT i.product_id, pr.name, i.qty_base
         FROM provisional_items i JOIN products pr ON pr.id = i.product_id
        WHERE i.provisional_id = ? ORDER BY i.id`,
      [r.id]
    );
  }
  return rows;
}

export function pendingProvisionalCount(): number {
  return get<{ v: number }>("SELECT COUNT(*) v FROM provisional_returns WHERE status = 'pending'")?.v ?? 0;
}

/** Gahak ka purana hisaab dekhne ke liye: is phone ke bills (spec 9.2.1) */
export function findBillsForPhone(phone: string, limit = 20) {
  return query<{ id: number; code: string; date: string; total_paisa: number; customer_name: string | null }>(
    `SELECT s.id, s.code, s.date, s.total_paisa, c.name AS customer_name
       FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
      WHERE s.customer_id IN (SELECT id FROM customers WHERE phone = ?)
      ORDER BY s.id DESC LIMIT ?`,
    [phone.trim(), Math.min(limit, 100)]
  );
}

/** Owner/manager: asal bill se jodo; aur chahein to maal stock me wapas daalein */
export function linkProvisional(
  id: number,
  saleId: number,
  opts: { restock?: boolean } = {},
  user?: U
): { id: number; saleId: number; restocked: number } {
  if (user?.role && user.role !== "owner" && user.role !== "manager")
    throw new Error("Sirf owner ya manager provisional return ko bill se jod sakta hai.");

  return tx(() => {
    const p = get<ProvRow>("SELECT * FROM provisional_returns WHERE id = ?", [id]);
    if (!p) throw new Error("Provisional return nahi mila.");
    if (p.status !== "pending") throw new Error("Yeh return pehle hi hal ho chuka hai (linked/cancelled).");
    const sale = get<{ id: number; code: string }>("SELECT id, code FROM sales WHERE id = ?", [saleId]);
    if (!sale) throw new Error("Bill nahi mila.");

    const items = query<{ product_id: number; qty_base: number }>(
      "SELECT product_id, qty_base FROM provisional_items WHERE provisional_id = ?",
      [id]
    );

    let restocked = 0;
    if (opts.restock) {
      // Us bill ke usi product wale batch me wapas daalo (FEFO: pehla batch jisme woh dawa ho)
      for (const it of items) {
        const si = get<{ batch_id: number | null }>(
          `SELECT batch_id FROM sale_items WHERE sale_id = ? AND product_id = ? LIMIT 1`,
          [saleId, it.product_id]
        );
        if (!si?.batch_id) continue;
        run("UPDATE batches SET qty_base = qty_base + ? WHERE id = ?", [it.qty_base, si.batch_id]);
        run(
          `INSERT INTO stock_movements (product_id, batch_id, type, qty_base, ref_type, ref_id, ref_code, note, user_id)
           VALUES (?,?, 'return_in', ?, 'provisional', ?, ?, ?, ?)`,
          [it.product_id, si.batch_id, it.qty_base, id, p.code, `Provisional linked to ${sale.code} -- restocked`, user?.id ?? null]
        );
        restocked++;
      }
    }

    run(
      `UPDATE provisional_returns
          SET status='linked', linked_sale_id=?, linked_at=datetime('now','localtime'), linked_by=?
        WHERE id = ?`,
      [saleId, user?.id ?? null, id]
    );
    void audit({
      action: "update",
      userId: user?.id ?? null,
      userName: user?.name ?? null,
      entity: "ProvisionalReturn",
      entityId: id,
      module: "Returns",
      before: { code: p.code, status: p.status },
      after: { code: p.code, status: "linked", linked_to: sale.code, restocked },
      details: { code: p.code, linkedTo: sale.code, restocked },
    });
    return { id, saleId, restocked };
  });
}

/** Owner/manager: nahi mila to pending note hata do (wajah likh kar) */
export function cancelProvisional(id: number, reason: string | null, user?: U): void {
  if (user?.role && user.role !== "owner" && user.role !== "manager")
    throw new Error("Sirf owner ya manager yeh note hata sakta hai.");
  const p = get<ProvRow>("SELECT * FROM provisional_returns WHERE id = ?", [id]);
  if (!p) throw new Error("Provisional return nahi mila.");
  if (p.status !== "pending") throw new Error("Yeh pehle hi hal ho chuka hai.");
  run(
    `UPDATE provisional_returns SET status='cancelled', notes = COALESCE(notes,'') || ? WHERE id = ?`,
    [` [${reason?.trim() || "band kar diya"}]`, id]
  );
  void audit({
    action: "update",
    userId: user?.id ?? null,
    userName: user?.name ?? null,
    entity: "ProvisionalReturn",
    entityId: id,
    module: "Returns",
    before: { code: p.code, status: "pending" },
    after: { code: p.code, status: "cancelled", reason: reason ?? null },
    details: { code: p.code, cancelled: reason },
  });
}
