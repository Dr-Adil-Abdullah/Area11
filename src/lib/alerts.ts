// Area11 - Expiry & low-stock alerts (levels settings se: RULE E)
import { query } from "./db";
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
