// ---------------------------------------------------------------------------
// Area11 - Supplier returns (maal wapas supplier ko) + supplier ledger
// ---------------------------------------------------------------------------
// Kaam: expiry / damaged / galat maal supplier ko lotana.
//   * batch se stock nikal jata hai (movement: supplier_return)
//   * supplier ka balance ghat jata hai (hum ne dena kam hua)
//     -> agar balance pehle se 0 tha to NEGATIVE ho jata hai
//        (matlab supplier ne HUMEIN dena hai = credit note)
// ---------------------------------------------------------------------------

import { get, query, run, tx } from "./db";
import { takeNextCode } from "./numbering";
import { audit } from "./audit";

type U = { id?: number; name?: string } | null | undefined;

export const RETURN_REASONS = [
  { value: "expired", label: "Expiry ho gayi" },
  { value: "damaged", label: "Kharaab / toota" },
  { value: "wrong_item", label: "Ghalat maal bheja" },
  { value: "overstock", label: "Zarurat se zyada" },
  { value: "rate_issue", label: "Rate ka masla" },
  { value: "other", label: "Koi aur wajah" },
] as const;

export type SupplierReturnInput = {
  supplierId: number;
  purchaseId?: number | null;
  reason?: string | null;
  note?: string | null;
  /** 1 = naqad wapas mil gaya (cash book me aata hai) · 0 = credit note (balance kam) */
  settled?: boolean;
  lines: { productId: number; batchId?: number | null; qtyBase: number; costPaisa?: number }[];
};

export type SupplierReturnRow = {
  id: number;
  code: string;
  date: string;
  supplier_id: number;
  supplier_name?: string | null;
  purchase_id: number | null;
  purchase_code?: string | null;
  reason: string | null;
  note: string | null;
  total_paisa: number;
  settled: number;
  items?: number;
};

export function listSupplierReturns(opts: { supplierId?: number; limit?: number } = {}): SupplierReturnRow[] {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (opts.supplierId) {
    where.push("r.supplier_id = ?");
    params.push(opts.supplierId);
  }
  const w = where.length ? "WHERE " + where.join(" AND ") : "";
  return query<SupplierReturnRow>(
    `SELECT r.*, s.name AS supplier_name, pu.code AS purchase_code,
            (SELECT COUNT(*) FROM supplier_return_items i WHERE i.return_id = r.id) AS items
       FROM supplier_returns r
       LEFT JOIN suppliers s ON s.id = r.supplier_id
       LEFT JOIN purchases pu ON pu.id = r.purchase_id
       ${w}
      ORDER BY r.id DESC
      LIMIT ?`,
    [...params, Math.min(opts.limit ?? 100, 500)]
  );
}

export function getSupplierReturn(id: number) {
  const ret = get<SupplierReturnRow & { supplier_name?: string }>(
    `SELECT r.*, s.name AS supplier_name FROM supplier_returns r
       LEFT JOIN suppliers s ON s.id = r.supplier_id WHERE r.id = ?`,
    [id]
  );
  if (!ret) return null;
  const items = query<{
    id: number; product_id: number; batch_id: number | null; qty_base: number;
    cost_paisa: number; line_total_paisa: number; name: string; batch_no: string | null;
  }>(
    `SELECT i.*, p.name, b.batch_no
       FROM supplier_return_items i
       JOIN products p ON p.id = i.product_id
       LEFT JOIN batches b ON b.id = i.batch_id
      WHERE i.return_id = ?`,
    [id]
  );
  return { ...ret, items };
}

export function createSupplierReturn(input: SupplierReturnInput, user?: U): { id: number; code: string; totalPaisa: number } {
  if (!input.supplierId) throw new Error("Supplier chunein.");
  const lines = (input.lines ?? []).filter((l) => Number(l.qtyBase) > 0);
  if (lines.length === 0) throw new Error("Kam az kam ek dawa ki miqdar likhein.");

  const supplier = get<{ id: number; name: string }>("SELECT id, name FROM suppliers WHERE id = ?", [input.supplierId]);
  if (!supplier) throw new Error("Supplier nahi mila.");

  return tx(() => {
    let total = 0;

    // Pehle sab lines tayyar karo (batch qty check ke sath)
    const ready = lines.map((l) => {
      // Batch na diya ho to FEFO: sab se qareeb expiry wala batch (jaise sale me)
      let batchId = l.batchId ?? null;
      if (!batchId) {
        const fefo = get<{ id: number }>(
          `SELECT id FROM batches
            WHERE product_id = ? AND active = 1 AND qty_base > 0
            ORDER BY (expiry_ym IS NULL), expiry_ym ASC, id ASC
            LIMIT 1`,
          [l.productId]
        );
        batchId = fefo?.id ?? null;
      }
      let cost = Math.round(l.costPaisa ?? 0);
      if (batchId) {
        const b = get<{ id: number; qty_base: number; cost_paisa: number }>(
          "SELECT id, qty_base, cost_paisa FROM batches WHERE id = ?",
          [batchId]
        );
        if (!b) throw new Error("Batch nahi mila.");
        if (Number(l.qtyBase) > b.qty_base) {
          throw new Error(`Batch me sirf ${b.qty_base} hain — ${l.qtyBase} wapas nahi bhej sakte.`);
        }
        if (!cost) cost = b.cost_paisa;
      } else {
        const p = get<{ cost_paisa: number }>("SELECT cost_paisa FROM products WHERE id = ?", [l.productId]);
        if (!cost) cost = p?.cost_paisa ?? 0;
        // Batch nahi mila to bhi itna maal hamare paas hona chahiye
        const have = get<{ n: number }>(
          "SELECT COALESCE(SUM(qty_base), 0) n FROM batches WHERE product_id = ? AND active = 1",
          [l.productId]
        )?.n ?? 0;
        if (Number(l.qtyBase) > have) {
          const nm = get<{ name: string }>("SELECT name FROM products WHERE id = ?", [l.productId])?.name ?? "dawa";
          throw new Error(`${nm}: hamare paas sirf ${have} hain — ${l.qtyBase} wapas nahi bhej sakte.`);
        }
      }
      const lineTotal = Math.round(cost * Number(l.qtyBase));
      total += lineTotal;
      return { ...l, batchId, cost, lineTotal };
    });

    const code = takeNextCode("supplierReturn");
    const retId = run(
      `INSERT INTO supplier_returns
         (code, supplier_id, purchase_id, reason, note, total_paisa, settled, user_id)
       VALUES (?,?,?,?,?,?,?,?)`,
      [
        code,
        input.supplierId,
        input.purchaseId ?? null,
        input.reason ?? null,
        input.note?.trim() || null,
        total,
        input.settled ? 1 : 0,
        user?.id ?? null,
      ]
    ).lastInsertRowid;

    for (const l of ready) {
      run(
        `INSERT INTO supplier_return_items (return_id, product_id, batch_id, qty_base, cost_paisa, line_total_paisa)
         VALUES (?,?,?,?,?,?)`,
        [retId, l.productId, l.batchId, Number(l.qtyBase), l.cost, l.lineTotal]
      );

      // Stock nikal jaye
      if (l.batchId) {
        run("UPDATE batches SET qty_base = qty_base - ? WHERE id = ?", [Number(l.qtyBase), l.batchId]);
      }
      run(
        `INSERT INTO stock_movements (product_id, batch_id, type, qty_base, ref_type, ref_id, ref_code, user_id)
         VALUES (?,?,?,?,?,?,?,?)`,
        [l.productId, l.batchId, "supplier_return", -Number(l.qtyBase), "supplier_return", retId, code, user?.id ?? null]
      );
    }

    // Supplier ka hisaab: hum ne dena kam hua (ya wo humein dene laga)
    run("UPDATE suppliers SET balance_paisa = balance_paisa - ? WHERE id = ?", [total, input.supplierId]);

    // Naqad wapas mila to cash book me bhi darj ho
    if (input.settled && total > 0) {
      run(
        `INSERT INTO payments (method, amount_paisa, supplier_id, user_id, note)
         VALUES (?,?,?,?,?)`,
        ["cash", total, input.supplierId, user?.id ?? null, `Supplier return ${code} -- naqad wapas mila`]
      );
    }

    void audit({
      action: "return",
      userId: user?.id ?? null,
      userName: user?.name ?? null,
      entity: "SupplierReturn",
      entityId: retId,
      module: "Suppliers",
      // Spec 2: purana balance → naya balance
      before: {
        supplier: supplier.name,
        balance_paisa:
          ((get<{ balance_paisa: number }>("SELECT balance_paisa FROM suppliers WHERE id = ?", [input.supplierId])
            ?.balance_paisa ?? 0) - (input.settled ? 0 : total)),
      },
      after: {
        code,
        supplier: supplier.name,
        total_paisa: total,
        settled: !!input.settled,
        reason: input.reason ?? null,
        items: input.lines?.length ?? 0,
      },
      details: { code, supplier: supplier.name, total, settled: !!input.settled, reason: input.reason ?? null },
    });

    return { id: retId, code, totalPaisa: total };
  });
}

// ---------------------------------------------------------------------------
// Supplier ledger: khata + bills + payments + returns
// ---------------------------------------------------------------------------

export function getSupplierLedger(id: number) {
  const supplier = get<{
    id: number; name: string; agency: string | null; phone: string | null;
    address: string | null; notes: string | null;
    opening_balance_paisa: number; balance_paisa: number; active: number; created_at: string;
  }>("SELECT * FROM suppliers WHERE id = ?", [id]);
  if (!supplier) return null;

  const purchases = query<{
    id: number; code: string; date: string; total_paisa: number;
    paid_paisa: number; due_paisa: number; supplier_invoice_no: string | null; items: number;
  }>(
    `SELECT pu.id, pu.code, pu.date, pu.total_paisa, pu.paid_paisa, pu.due_paisa,
            pu.supplier_invoice_no,
            (SELECT COUNT(*) FROM purchase_items i WHERE i.purchase_id = pu.id) AS items
       FROM purchases pu WHERE pu.supplier_id = ? ORDER BY pu.id DESC LIMIT 100`,
    [id]
  );

  const payments = query<{ id: number; date: string; method: string; amount_paisa: number; note: string | null }>(
    `SELECT id, date, method, amount_paisa, note FROM payments
      WHERE supplier_id = ? ORDER BY id DESC LIMIT 100`,
    [id]
  );

  const returns = listSupplierReturns({ supplierId: id, limit: 50 });

  const bought = purchases.reduce((n, p) => n + p.total_paisa, 0);
  const paid = payments.reduce((n, p) => n + p.amount_paisa, 0);
  const returned = returns.reduce((n, r) => n + r.total_paisa, 0);

  return {
    supplier,
    purchases,
    payments,
    returns,
    stats: {
      bills: purchases.length,
      boughtPaisa: bought,
      paidPaisa: paid,
      returnedPaisa: returned,
      // + = hum ne dena hai · - = supplier ne humein dena hai
      outstandingPaisa: supplier.balance_paisa,
      lastPurchaseAt: purchases[0]?.date ?? null,
    },
  };
}
