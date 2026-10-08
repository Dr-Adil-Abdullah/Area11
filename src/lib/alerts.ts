// Area11 - Expiry & low-stock alerts (levels settings se: RULE E)
import { get, query } from "./db";
import { expiryStatus, type ExpiryLevels } from "./pos";

export function expiryAlerts(levels: ExpiryLevels) {
  const maxDays = Math.max(365, ...levels.map((l) => l.days));
  const rows = query<{ batch_id: number; product_id: number; name: string; batch_no: string; expiry_ym: string;
      qty_base: number; cost_paisa: number; rack_no: string | null; base_unit: string }>(
    `SELECT b.id AS batch_id, p.id AS product_id, p.name, b.batch_no, b.expiry_ym, b.qty_base, b.cost_paisa, p.rack_no, p.base_unit
       FROM batches b JOIN products p ON p.id = b.product_id
      WHERE b.active = 1 AND b.qty_base > 0 AND b.expiry_date IS NOT NULL
        AND date(b.expiry_date) <= date('now','localtime', '+' || ? || ' days')
      ORDER BY b.expiry_ym, p.name`, [maxDays]);
  return rows.map((r) => ({ ...r, status: expiryStatus(r.expiry_ym, levels), lossPaisa: Math.round(r.qty_base * r.cost_paisa) }));
}

/** Sample / bonus stock: jo maal muft mila (bills me 0 jura) — ab us ki alag list */
export function sampleStock() {
  return query<{
    batch_id: number; product_id: number; name: string; batch_no: string;
    expiry_ym: string | null; qty_base: number; supplier: string | null; purchase_code: string | null;
  }>(
    `SELECT b.id AS batch_id, b.product_id, p.name, b.batch_no, b.expiry_ym, b.qty_base,
            s.name AS supplier, pu.code AS purchase_code
       FROM batches b
       JOIN products p ON p.id = b.product_id
       LEFT JOIN suppliers s ON s.id = b.supplier_id
       LEFT JOIN purchases pu ON pu.id = b.purchase_id
      WHERE b.active = 1 AND b.is_sample = 1 AND b.qty_base > 0
      ORDER BY p.name, b.expiry_ym`
  );
}

export function stockAlerts() {
  return query<{ id: number; name: string; rack_no: string | null; base_unit: string; reorder_level: number; stock_base: number }>(
    `SELECT p.id, p.name, p.rack_no, p.base_unit, p.reorder_level,
            (SELECT COALESCE(SUM(qty_base),0) FROM batches b WHERE b.product_id=p.id AND b.active=1) AS stock_base
       FROM products p WHERE p.active = 1 AND p.reorder_level > 0
        AND (SELECT COALESCE(SUM(qty_base),0) FROM batches b WHERE b.product_id=p.id AND b.active=1) <= p.reorder_level
      ORDER BY stock_base, p.name`);
}

// ---------------------------------------------------------------------------
// Spec 1.2: stock MINUS me gaya to HAR SAFHE par bara surkh alert
// (AppShell isi se poochta hai ke kitni cheezein minus me hain)
// ---------------------------------------------------------------------------
export function negativeStockSummary(): { items: number; worst: number } {
  try {
    const row = get<{ items: number; worst: number }>(
      `SELECT COUNT(DISTINCT p.id) AS items,
              COALESCE(MIN(t.qty), 0) AS worst
         FROM (SELECT product_id, SUM(qty_base) AS qty
                 FROM batches WHERE active = 1
                GROUP BY product_id
               HAVING qty < 0) t
         JOIN products p ON p.id = t.product_id`
    );
    return { items: row?.items ?? 0, worst: row?.worst ?? 0 };
  } catch {
    return { items: 0, worst: 0 };
  }
}

/**
 * Spec 3.3 / 1.3: QUARANTINE -- wapsi hua maal jo abhi shelf par nahi aya.
 * (restock = 0 wali sale_returns). Ye maal stock me to nahi hota magar
 * dukan me maujood hota hai -- is liye yahan nazar aana chahiye, warna
 * chup-chapat "ghaib" ho jata hai.
 */
export function quarantineList() {
  try {
    return query<{
      id: number; date: string; product_id: number; name: string;
      batch_id: number | null; batch_no: string | null; base_unit: string;
      qty_base: number; refund_paisa: number; reason: string | null;
      sale_code: string | null; customer_name: string | null; user_name: string | null;
    }>(
      `SELECT r.id, r.date, r.product_id, p.name, r.batch_id, b.batch_no, p.base_unit,
              r.qty_base, r.refund_paisa, r.reason, s.code AS sale_code,
              c.name AS customer_name, u.name AS user_name
         FROM sale_returns r
         JOIN products p   ON p.id = r.product_id
         LEFT JOIN batches b    ON b.id = r.batch_id
         LEFT JOIN sales s      ON s.id = r.sale_id
         LEFT JOIN customers c  ON c.id = s.customer_id
         LEFT JOIN users u      ON u.id = r.user_id
        WHERE r.restock = 0 AND r.qty_base > 0
        ORDER BY r.id DESC
        LIMIT 200`
    );
  } catch {
    return [];
  }
}
