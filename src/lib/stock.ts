// ---------------------------------------------------------------------------
// Area11 - Stock adjustments (nuqsan / write-off aur ginti ki durusti)
// ---------------------------------------------------------------------------
// Spec 15.2: kharab/expired mal ka nuqsan, aur physical ginti ki durusti.
// Rules:
//   - Stock kabhi "chupke se" nahi badalta -- har tabdeeli stock_movements me
//     likhi jati hai (audit trail).
//   - Batch me se jitna hai us se zyada "out" nahi kiya ja sakta.
//   - Value hamesha PURCHASE COST par (retail par nahi) -- ye asli nuqsan hai.
// ---------------------------------------------------------------------------

import { get, query, run, tx } from "./db";
import { toBaseUnits } from "./money";
import { audit } from "./audit";

export type AdjustDirection = "out" | "in";
export type AdjustReason =
  | "expired"
  | "damaged"
  | "lost"
  | "count_short"
  | "count_extra"
  | "other";

export const REASON_LABELS: Record<AdjustReason, string> = {
  expired: "Expired (tareekh guzar gayi)",
  damaged: "Damaged / toota hua",
  lost: "Lost / gayab",
  count_short: "Count short (ginti me kam)",
  count_extra: "Count extra (ginti me zyada)",
  other: "Other",
};

export type StockAdjustInput = {
  productId: number;
  batchId: number;
  unit: "box" | "strip" | "base";
  qty: number;
  direction: AdjustDirection;
  reason: AdjustReason;
  note?: string | null;
};

export type StockAdjustResult = {
  id: number;
  productName: string;
  batchNo: string;
  qtyBase: number;
  valuePaisa: number;
  newBatchQty: number;
  newProductQty: number;
};

export function adjustStock(
  input: StockAdjustInput,
  user?: { id?: number; name?: string }
): StockAdjustResult {
  const qty = Number(input.qty);
  if (!isFinite(qty) || qty <= 0) throw new Error("Quantity 0 se zyada honi chahiye");
  if (input.direction !== "out" && input.direction !== "in") {
    throw new Error("Direction out ya in honi chahiye");
  }

  return tx(() => {
    const product = get<{
      id: number;
      name: string;
      box_strips: number;
      strip_tablets: number;
      base_unit: string;
    }>(
      "SELECT id, name, box_strips, strip_tablets, base_unit FROM products WHERE id = ? AND active = 1",
      [input.productId]
    );
    if (!product) throw new Error("Product not found or switched off");

    const batch = get<{
      id: number;
      product_id: number;
      batch_no: string | null;
      qty_base: number;
      cost_paisa: number;
      expiry_ym: string | null;
    }>(
      "SELECT id, product_id, batch_no, qty_base, cost_paisa, expiry_ym FROM batches WHERE id = ? AND active = 1",
      [input.batchId]
    );
    if (!batch) throw new Error("Batch not found");
    if (batch.product_id !== product.id) throw new Error("Ye batch is product ka nahi hai");

    const qtyBase = toBaseUnits(qty, input.unit, product.box_strips, product.strip_tablets);
    if (!isFinite(qtyBase) || qtyBase <= 0) throw new Error("Quantity theek nahi");

    const signed = input.direction === "out" ? -qtyBase : qtyBase;
    const newBatchQty = batch.qty_base + signed;
    if (newBatchQty < 0) {
      throw new Error(
        `Is batch me sirf ${batch.qty_base} ${product.base_unit} hain — itna nuqsan darj nahi ho sakta.`
      );
    }

    const valuePaisa = Math.round(qtyBase * batch.cost_paisa);

    // 1) Batch ki quantity
    run("UPDATE batches SET qty_base = ? WHERE id = ?", [newBatchQty, batch.id]);

    // 2) Stock movement (hamesha -- audit trail)
    const movement = run(
      `INSERT INTO stock_movements (product_id, batch_id, type, qty_base, ref_type, ref_id, note, user_id)
       VALUES (?,?,?,?,?,?,?,?)`,
      [
        product.id,
        batch.id,
        input.direction === "out" ? "writeoff" : "adjust",
        signed,
        "stock_adjustment",
        null,
        `${REASON_LABELS[input.reason] ?? input.reason}${input.note ? " — " + input.note : ""}`,
        user?.id ?? null,
      ]
    );
    const movementId = movement.lastInsertRowid;

    // 3) Adjustment ka apna record
    const row = run(
      `INSERT INTO stock_adjustments
        (product_id, batch_id, direction, qty_base, unit_entered, qty_entered, value_paisa,
         reason, note, user_id, movement_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        product.id,
        batch.id,
        input.direction,
        qtyBase,
        input.unit,
        qty,
        valuePaisa,
        input.reason,
        input.note?.trim() || null,
        user?.id ?? null,
        movementId,
      ]
    );

    void audit({
      action: "update",
      userId: user?.id ?? null,
      userName: user?.name ?? null,
      entity: "Stock",
      entityId: product.id,
      details: {
        product: product.name,
        batch: batch.batch_no,
        direction: input.direction,
        qtyBase,
        valuePaisa,
        reason: input.reason,
      },
    });

    const newProductQty =
      get<{ s: number }>(
        "SELECT COALESCE(SUM(qty_base),0) AS s FROM batches WHERE product_id = ? AND active = 1",
        [product.id]
      )?.s ?? 0;

    return {
      id: Number(row.lastInsertRowid),
      productName: product.name,
      batchNo: batch.batch_no ?? "",
      qtyBase,
      valuePaisa,
      newBatchQty,
      newProductQty,
    };
  });
}

export type AdjustmentRow = {
  id: number;
  date: string;
  product_name: string;
  base_unit: string;
  batch_no: string | null;
  direction: string;
  qty_base: number;
  unit_entered: string | null;
  qty_entered: number | null;
  value_paisa: number;
  reason: string;
  note: string | null;
  user_name: string | null;
};

/** Aakhri adjustments (report/dekhne ke liye) */
export function listAdjustments(opts: { limit?: number; productId?: number } = {}): AdjustmentRow[] {
  const limit = Math.max(1, Math.min(500, opts.limit ?? 50));
  if (opts.productId) {
    return query<AdjustmentRow>(
      `SELECT a.id, a.date, p.name AS product_name, p.base_unit, b.batch_no, a.direction,
              a.qty_base, a.unit_entered, a.qty_entered, a.value_paisa, a.reason, a.note,
              u.name AS user_name
         FROM stock_adjustments a
         JOIN products p ON p.id = a.product_id
         LEFT JOIN batches b ON b.id = a.batch_id
         LEFT JOIN users u ON u.id = a.user_id
        WHERE a.product_id = ?
        ORDER BY a.id DESC LIMIT ?`,
      [opts.productId, limit]
    );
  }
  return query<AdjustmentRow>(
    `SELECT a.id, a.date, p.name AS product_name, p.base_unit, b.batch_no, a.direction,
            a.qty_base, a.unit_entered, a.qty_entered, a.value_paisa, a.reason, a.note,
            u.name AS user_name
       FROM stock_adjustments a
       JOIN products p ON p.id = a.product_id
       LEFT JOIN batches b ON b.id = a.batch_id
       LEFT JOIN users u ON u.id = a.user_id
      ORDER BY a.id DESC LIMIT ?`,
    [limit]
  );
}

/** Aaj + is mahine ka nuqsan (dashboard/report ke liye) */
export function writeOffSummary(): { todayPaisa: number; monthPaisa: number } {
  const today =
    get<{ v: number }>(
      `SELECT COALESCE(SUM(value_paisa),0) AS v FROM stock_adjustments
        WHERE direction = 'out' AND date(date) = date('now','localtime')`
    )?.v ?? 0;
  const month =
    get<{ v: number }>(
      `SELECT COALESCE(SUM(value_paisa),0) AS v FROM stock_adjustments
        WHERE direction = 'out' AND strftime('%Y-%m', date) = strftime('%Y-%m','now','localtime')`
    )?.v ?? 0;
  return { todayPaisa: today, monthPaisa: month };
}
