// ---------------------------------------------------------------------------
// Area11 - Detail views: gahak aur dawa par click karne par POORI tafseel
// ---------------------------------------------------------------------------
// Sab kuch ek jagah: profile + khata + tamam bills/payments/returns,
// ya product ke liye batches/expiry, bikri, aakhri kharid, price history,
// aur sari stock movements.
// ---------------------------------------------------------------------------

import { get, query } from "./db";
import { getCustomValues } from "./custom-fields";
import { photoSrc } from "./photos";

export type CustomerBill = {
  id: number;
  code: string;
  date: string;
  items: number;
  total_paisa: number;
  paid_paisa: number;
  due_paisa: number;
  status: string;
  payment_method: string;
};

export function getCustomerDetail(id: number) {
  const customer = get<{
    id: number; name: string; phone: string | null; category: string; notes: string | null;
    credit_limit_paisa: number; balance_paisa: number; loyalty_points: number; stars: number;
    active: number; created_at: string; photo: string | null;
  }>("SELECT * FROM customers WHERE id = ?", [id]);
  if (!customer) return null;
  customer.photo = photoSrc(customer.photo);

  const bills = query<CustomerBill>(
    `SELECT s.id, s.code, s.date,
            (SELECT COUNT(*) FROM sale_items i WHERE i.sale_id = s.id) AS items,
            s.total_paisa, s.paid_paisa, s.due_paisa, s.status, s.payment_method
       FROM sales s WHERE s.customer_id = ? ORDER BY s.id DESC LIMIT 100`,
    [id]
  );

  const payments = query<{ id: number; date: string; method: string; amount_paisa: number; note: string | null }>(
    `SELECT id, date, method, amount_paisa, note FROM payments
      WHERE customer_id = ? ORDER BY id DESC LIMIT 100`,
    [id]
  );

  const returns = query<{ id: number; date: string; code: string; qty_base: number; refund_paisa: number; reason: string | null }>(
    `SELECT r.id, r.date, s.code, r.qty_base, r.refund_paisa, r.reason
       FROM sale_returns r JOIN sales s ON s.id = r.sale_id
      WHERE s.customer_id = ? ORDER BY r.id DESC LIMIT 50`,
    [id]
  );

  const provisional = query<{ id: number; code: string; date: string; refund_paisa: number; status: string }>(
    `SELECT id, code, date, refund_paisa, status FROM provisional_returns
      WHERE phone IS NOT NULL AND phone = ? ORDER BY id DESC LIMIT 20`,
    [customer.phone ?? ""]
  );

  const spent = bills.filter((b) => b.status !== "void").reduce((n, b) => n + b.total_paisa, 0);
  const paidTotal = payments.filter((p) => p.amount_paisa > 0).reduce((n, p) => n + p.amount_paisa, 0);
  const refunded = returns.reduce((n, r) => n + r.refund_paisa, 0);

  return {
    customer,
    bills,
    payments,
    returns,
    provisional,
    stats: {
      bills: bills.filter((b) => b.status !== "void").length,
      spentPaisa: spent,
      paidPaisa: paidTotal,
      refundedPaisa: refunded,
      outstandingPaisa: customer.balance_paisa,
      lastVisit: bills[0]?.date ?? null,
    },
    custom: getCustomValues("customer", id),
  };
}

// ------------------------------- product -----------------------------------

export type ProductBatchRow = {
  id: number; batch_no: string; expiry_ym: string | null; qty_base: number;
  cost_paisa: number; retail_paisa: number; status: string; supplier_name?: string | null; purchase_code?: string | null;
};

export function getProductDetail(id: number) {
  const product = get<{
    id: number; name: string; generic: string | null; brand: string | null; barcode: string | null;
    company_id: number | null; category_id: number | null; rack_no: string | null;
    base_unit: string; box_strips: number; strip_tablets: number;
    cost_paisa: number; retail_paisa: number; vip_paisa: number; doctor_paisa: number;
    reorder_level: number; track_expiry: number; active: number; created_at: string;
    photo: string | null; room: string | null;
    category_name?: string | null; company_name?: string | null;
  }>(
    `SELECT p.*, c.name AS category_name, co.name AS company_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN companies co ON co.id = p.company_id
      WHERE p.id = ?`,
    [id]
  );
  if (!product) return null;
  product.photo = photoSrc(product.photo);

  const batches = query<ProductBatchRow>(
    `SELECT b.id, b.batch_no, b.expiry_ym, b.qty_base, b.cost_paisa, b.retail_paisa, b.active,
            CASE
              WHEN b.qty_base <= 0 THEN 'khali'
              WHEN b.expiry_ym IS NOT NULL AND b.expiry_ym < strftime('%Y-%m', 'now') THEN 'expired'
              WHEN b.expiry_ym IS NOT NULL AND b.expiry_ym <= strftime('%Y-%m', 'now', '+3 months') THEN 'jaldi'
              ELSE 'theek'
            END AS status,
            s.name AS supplier_name, pu.code AS purchase_code
       FROM batches b
       LEFT JOIN suppliers s ON s.id = b.supplier_id
       LEFT JOIN purchases pu ON pu.id = b.purchase_id
      WHERE b.product_id = ? AND b.active = 1
      ORDER BY (b.qty_base <= 0), (b.expiry_ym IS NULL), b.expiry_ym, b.id`,
    [id]
  );

  const sold = get<{ qty: number; value: number; bills: number; last: string | null }>(
    `SELECT COALESCE(SUM(i.qty_base),0) qty, COALESCE(SUM(i.line_total_paisa),0) value,
            COUNT(DISTINCT i.sale_id) bills, MAX(s.date) last
       FROM sale_items i JOIN sales s ON s.id = i.sale_id
      WHERE i.product_id = ? AND s.status <> 'void'`,
    [id]
  ) ?? { qty: 0, value: 0, bills: 0, last: null };

  const movements = query<{
    id: number; created_at: string; type: string; qty_base: number; ref_type: string | null;
    ref_code: string | null; note: string | null; user_name?: string | null;
  }>(
    `SELECT m.id, m.created_at, m.type, m.qty_base, m.ref_type, m.ref_code, m.note, u.name AS user_name
       FROM stock_movements m LEFT JOIN users u ON u.id = m.user_id
      WHERE m.product_id = ? ORDER BY m.id DESC LIMIT 100`,
    [id]
  );

  // Price history: audit_logs me price_change rows (details JSON)
  const priceHistory = query<{ id: number; at: string; details: string | null; user_name: string | null }>(
    `SELECT a.id, a.at, a.details, u.name AS user_name
       FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
      WHERE a.entity = 'Product' AND a.entity_id = ? AND a.action = 'price_change'
      ORDER BY a.id DESC LIMIT 50`,
    [String(id)]
  );

  const stock = batches.reduce((n, b) => n + (b.qty_base > 0 ? b.qty_base : 0), 0);
  const stockValue = batches.reduce((n, b) => n + (b.qty_base > 0 ? b.qty_base * b.cost_paisa : 0), 0);

  return {
    product,
    batches,
    movements,
    priceHistory: priceHistory.map((p) => {
      let parsed: Record<string, unknown> = {};
      try {
        parsed = p.details ? JSON.parse(p.details) : {};
      } catch {
        parsed = {};
      }
      return { id: p.id, at: p.at, by: p.user_name, data: parsed };
    }),
    stats: {
      stockBase: stock,
      stockValuePaisa: stockValue,
      batches: batches.length,
      soldQty: sold.qty,
      soldValuePaisa: sold.value,
      soldBills: sold.bills,
      lastSoldAt: sold.last,
      marginPaisa: product.retail_paisa - product.cost_paisa,
    },
    custom: getCustomValues("product", id),
  };
}
