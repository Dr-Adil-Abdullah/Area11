// ---------------------------------------------------------------------------
// Area11 - Purchases / Stock-In engine (Spec 3 + Spec 5)
// ---------------------------------------------------------------------------
// Ek purchase save karne par ye sab khud hota hai:
//   1. Auto PINV code (tarteeb se)
//   2. Har item ka BATCH banta hai (batch no + expiry + qty)
//   3. Stock movement 'in' likha jata hai (audit)
//   4. Product ka cost/retail rate update hota hai
//   5. Supplier ke khatay me raqam jama (+)
// ---------------------------------------------------------------------------

import { get, query, run, tx, scalar } from "./db";
import { takeNextCode } from "./numbering";
import { toBaseUnits } from "./money";
import { audit } from "./audit";

export type PurchaseRow = {
  id: number;
  code: string;
  supplier_id: number | null;
  supplier_name?: string | null;
  supplier_invoice_no: string | null;
  date: string;
  subtotal_paisa: number;
  discount_paisa: number;
  total_paisa: number;
  paid_paisa: number;
  due_paisa: number;
  notes: string | null;
  items?: number;
};

export type PurchaseItemInput = {
  productId: number;
  unit: "box" | "strip" | "base";
  qty: number;
  batchNo?: string | null;
  expiryDate?: string | null; // YYYY-MM-DD
  costPaisa?: number;
  retailPaisa?: number;
  vipPaisa?: number;
  doctorPaisa?: number;
  isSample?: boolean;
};

export type PurchaseInput = {
  supplierId?: number | null;
  supplierInvoiceNo?: string | null;
  date?: string | null;
  items: PurchaseItemInput[];
  discountPaisa?: number;
  paidPaisa?: number;
  notes?: string | null;
};

export function listPurchases(opts: { search?: string; limit?: number } = {}): PurchaseRow[] {
  const like = `%${(opts.search ?? "").trim()}%`;
  return query<PurchaseRow>(
    `SELECT pu.*, s.name AS supplier_name,
            (SELECT COUNT(*) FROM purchase_items i WHERE i.purchase_id = pu.id) AS items
       FROM purchases pu
       LEFT JOIN suppliers s ON s.id = pu.supplier_id
      WHERE pu.code LIKE ? OR s.name LIKE ? OR pu.supplier_invoice_no LIKE ?
      ORDER BY pu.id DESC
      LIMIT ?`,
    [like, like, like, Math.min(opts.limit ?? 100, 500)]
  );
}

export function getPurchase(id: number) {
  const header = get<PurchaseRow & { user_id: number | null }>(
    `SELECT pu.*, s.name AS supplier_name FROM purchases pu
     LEFT JOIN suppliers s ON s.id = pu.supplier_id WHERE pu.id = ?`,
    [id]
  );
  if (!header) return null;
  const items = query<{
    id: number;
    product_id: number;
    name: string;
    qty_entered: number;
    unit: string;
    qty_base: number;
    cost_paisa: number;
    retail_paisa: number;
    line_total_paisa: number;
    batch_no: string | null;
    expiry_date: string | null;
    pack_size_label: string | null;
    base_unit: string;
  }>(
    `SELECT i.id, i.product_id, p.name, i.qty_entered, i.unit, i.qty_base,
            i.cost_paisa, i.retail_paisa, i.line_total_paisa, i.batch_no, i.expiry_date,
            p.pack_size_label, p.base_unit
       FROM purchase_items i
       JOIN products p ON p.id = i.product_id
      WHERE i.purchase_id = ?
      ORDER BY i.id`,
    [id]
  );
  return { header, items };
}

export function createPurchase(
  input: PurchaseInput,
  user?: { id?: number; name?: string }
): { id: number; code: string; totalPaisa: number } {
  if (!input.items?.length) throw new Error("At least one item is required");

  return tx(() => {
    const code = takeNextCode("purchase");
    const date = input.date?.trim() || new Date().toISOString().slice(0, 19).replace("T", " ");

    // Lines pehle calculate karo
    const lines = input.items.map((it) => {
      const product = get<{
        id: number;
        name: string;
        box_strips: number;
        strip_tablets: number;
        base_unit: string;
      }>("SELECT id, name, box_strips, strip_tablets, base_unit FROM products WHERE id = ?", [
        it.productId,
      ]);
      if (!product) throw new Error(`Product ${it.productId} not found`);

      const qtyBase = toBaseUnits(Number(it.qty) || 0, it.unit, product.box_strips, product.strip_tablets);
      const cost = Math.max(0, Math.round(it.costPaisa ?? 0));
      // Sample / bonus = free goods -> bill (aur supplier payable) me 0 judta hai.
      // Cost batch par rehta hai taake nuqsan ki qeemat (write-off value) theek nikle.
      const lineTotal = it.isSample ? 0 : Math.round(qtyBase * cost);
      return { ...it, product, qtyBase, cost, lineTotal };
    });

    const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
    const discount = Math.max(0, Math.round(input.discountPaisa ?? 0));
    const total = Math.max(0, subtotal - discount);
    const paid = Math.max(0, Math.round(input.paidPaisa ?? 0));
    const due = Math.max(0, total - paid);

    const header = run(
      `INSERT INTO purchases
        (code, supplier_id, supplier_invoice_no, date, subtotal_paisa, discount_paisa,
         total_paisa, paid_paisa, due_paisa, notes, user_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        code,
        input.supplierId ?? null,
        input.supplierInvoiceNo?.trim() || null,
        date,
        subtotal,
        discount,
        total,
        paid,
        due,
        input.notes?.trim() || null,
        user?.id ?? null,
      ]
    );
    const purchaseId = header.lastInsertRowid;

    for (const l of lines) {
      const expiryYmd = l.expiryDate ? normaliseExpiry(l.expiryDate) : null;
      const expiryYm = expiryYmd ? expiryYmd.slice(0, 7) : null;

      // Batch banao
      const batch = run(
        `INSERT INTO batches
          (product_id, batch_no, expiry_date, expiry_ym, qty_base, cost_paisa, retail_paisa,
           vip_paisa, doctor_paisa, is_sample, supplier_id, purchase_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          l.productId,
          (l.batchNo || "").trim() || "—",
          expiryYmd,
          expiryYm,
          l.qtyBase,
          l.cost,
          Math.max(0, Math.round(l.retailPaisa ?? 0)),
          Math.max(0, Math.round(l.vipPaisa ?? 0)),
          Math.max(0, Math.round(l.doctorPaisa ?? 0)),
          l.isSample ? 1 : 0,
          input.supplierId ?? null,
          purchaseId,
        ]
      );
      const batchId = batch.lastInsertRowid;

      run(
        `INSERT INTO purchase_items
          (purchase_id, product_id, batch_id, qty_entered, unit, qty_base, cost_paisa,
           retail_paisa, line_total_paisa, batch_no, expiry_date)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [
          purchaseId,
          l.productId,
          batchId,
          Number(l.qty) || 0,
          l.unit,
          l.qtyBase,
          l.cost,
          Math.max(0, Math.round(l.retailPaisa ?? 0)),
          l.lineTotal,
          (l.batchNo || "").trim() || null,
          expiryYmd,
        ]
      );

      // Stock movement (audit trail)
      run(
        `INSERT INTO stock_movements
          (product_id, batch_id, type, qty_base, ref_type, ref_id, ref_code, note, user_id)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [
          l.productId,
          batchId,
          l.isSample ? "sample" : "in",
          l.qtyBase,
          "purchase",
          purchaseId,
          code,
          l.isSample ? "Sample / bonus (0 cost)" : null,
          user?.id ?? null,
        ]
      );

      // Product par aakhri cost/rate update (agar diya gaya ho)
      const updates: string[] = [];
      const params: (number | string)[] = [];
      if (l.cost > 0) {
        updates.push("cost_paisa = ?");
        params.push(l.cost);
      }
      if ((l.retailPaisa ?? 0) > 0) {
        updates.push("retail_paisa = ?");
        params.push(Math.round(l.retailPaisa as number));
      }
      if ((l.vipPaisa ?? 0) > 0) {
        updates.push("vip_paisa = ?");
        params.push(Math.round(l.vipPaisa as number));
      }
      if ((l.doctorPaisa ?? 0) > 0) {
        updates.push("doctor_paisa = ?");
        params.push(Math.round(l.doctorPaisa as number));
      }
      if (updates.length) {
        updates.push("updated_at = datetime('now','localtime')");
        run(`UPDATE products SET ${updates.join(", ")} WHERE id = ?`, [...params, l.productId]);
      }
    }

    // Supplier khatay me (payable barhta hai)
    if (input.supplierId) {
      run(
        `UPDATE suppliers
            SET balance_paisa = balance_paisa + ?
          WHERE id = ?`,
        [total, input.supplierId]
      );
    }

    // Aaj ka payment
    if (paid > 0) {
      run(
        `INSERT INTO payments (method, amount_paisa, purchase_id, supplier_id, user_id, note)
         VALUES ('cash', ?, ?, ?, ?, 'Paid at purchase')`,
        [paid, purchaseId, input.supplierId ?? null, user?.id ?? null]
      );
      if (input.supplierId) {
        run("UPDATE suppliers SET balance_paisa = balance_paisa - ? WHERE id = ?", [
          paid,
          input.supplierId,
        ]);
      }
    }

    void audit({
      action: "create",
      userId: user?.id ?? null,
      userName: user?.name ?? null,
      entity: "Purchase",
      entityId: purchaseId,
      module: "Purchases",
      // Spec 2: purana kya tha (khaali), naya kya hua
      before: null,
      after: {
        code,
        supplier:
          (get<{ name: string }>("SELECT name FROM suppliers WHERE id = ?", [input.supplierId ?? 0])?.name ?? null),
        items: lines.length,
        subtotal_paisa: subtotal,
        total_paisa: total,
        paid_paisa: paid,
      },
      details: { code, items: lines.length, total },
    });

    return { id: purchaseId, code, totalPaisa: total };
  });
}

/** Expiry input ko YYYY-MM-DD banao (user "2026-05" ya "2026-05-15" likh sakta hai) */
export function normaliseExpiry(raw: string): string | null {
  const s = (raw || "").trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}$/.test(s)) return `${s}-01`;
  if (/^\d{4}$/.test(s)) return `${s}-01-01`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

/** Kitne batches stock me hain (dashboard ke liye) */
export function batchesInStock(): number {
  return scalar<number>("SELECT COUNT(*) AS c FROM batches WHERE qty_base > 0 AND active = 1");
}
