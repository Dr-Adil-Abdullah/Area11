// ---------------------------------------------------------------------------
// Area11 - Sales / POS engine (Spec 8 + Spec 9 + Spec 7)
// ---------------------------------------------------------------------------
// Ek sale save karne par:
//   1. Auto INV code
//   2. Har line: qty base units me convert (Box/Strip/Tablet)
//   3. Discount (margin ya retail -- settings se)
//   4. Tax (agar on ho)
//   5. Neeche round-off (spec 8.2)
//   6. Batch se stock minus + stock movement 'out'
//   7. Customer khatay me (agar udhaar ho)
//   8. Loyalty points (agar on ho)
// ---------------------------------------------------------------------------

import { get, query, run, tx, scalar } from "./db";
import { takeNextCode } from "./numbering";
import { applyRoundWithCostGuard, toBaseUnits, marginDiscount, retailDiscount, percentOf } from "./money";
import { getSettings } from "./settings";
import { audit } from "./audit";
import { checkDiscountLimit, maxDiscountPercent } from "./roles";

export type CartLineInput = {
  productId: number;
  batchId?: number | null;
  unit: "box" | "strip" | "base";
  qty: number;
  unitPricePaisa: number; // base unit ka rate
  discountPaisa?: number;
  manualName?: string | null; // loose/manual item
};

export type SaleInput = {
  customerId?: number | null;
  items: CartLineInput[];
  billDiscountPaisa?: number;
  paymentMethod?: "cash" | "credit" | "online" | "card" | "split";
  paidPaisa?: number;
  notes?: string | null;
  status?: "paid" | "credit" | "hold";
};

export type SaleResult = {
  id: number;
  code: string;
  subtotalPaisa: number;
  discountPaisa: number;
  taxPaisa: number;
  roundOffPaisa: number;
  totalPaisa: number;
  paidPaisa: number;
  duePaisa: number;
  warnings: string[];
};

export function createSale(
  input: SaleInput,
  user?: { id?: number; name?: string; role?: string }
): SaleResult {
  if (!input.items?.length) throw new Error("Cart is empty");

  // Settings transaction se pehle padh lo (async)
  return tx(() => {
    const code = takeNextCode("sale");
    const warnings: string[] = [];
    const settingsSnapshot = getSyncSettings();

    const lines = input.items.map((it) => {
      const product = get<{
        id: number;
        name: string;
        box_strips: number;
        strip_tablets: number;
        cost_paisa: number;
      }>("SELECT id, name, box_strips, strip_tablets, cost_paisa FROM products WHERE id = ?", [
        it.productId,
      ]);
      if (!product) throw new Error(`Product ${it.productId} not found`);

      const qtyBase = toBaseUnits(Number(it.qty) || 0, it.unit, product.box_strips, product.strip_tablets);
      let costPaisa = product.cost_paisa;

      if (it.batchId) {
        const batch = get<{ id: number; qty_base: number; cost_paisa: number }>(
          "SELECT id, qty_base, cost_paisa FROM batches WHERE id = ?",
          [it.batchId]
        );
        if (!batch) throw new Error(`Batch ${it.batchId} not found`);
        costPaisa = batch.cost_paisa;
        if (batch.qty_base < qtyBase) {
          // Spec 1.2.5: crash nahi -- minus me dikhao magar alert do
          warnings.push(
            `${product.name}: batch me sirf ${batch.qty_base} base units the, ${qtyBase} bike. Stock minus me chala gaya.`
          );
        }
      }

      const gross = Math.round(qtyBase * Math.max(0, it.unitPricePaisa));
      const discount = Math.max(0, Math.round(it.discountPaisa ?? 0));
      const lineTotal = Math.max(0, gross - discount);

      // Spec 7.3: discount se line apni purchase cost se neeche nahi ja sakti
      const lineCost = qtyBase * costPaisa;
      if (settingsSnapshot.discount.blockBelowCost && gross >= lineCost && lineTotal < lineCost) {
        throw new Error(
          `${product.name}: this discount takes the line below its purchase cost (Rs ${(
            lineCost / 100
          ).toFixed(2)}). Reduce the discount.`
        );
      }

      return {
        ...it,
        product,
        qtyBase,
        costPaisa,
        gross,
        discount,
        lineTotal,
      };
    });

    const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
    const billDiscount = Math.max(0, Math.round(input.billDiscountPaisa ?? 0));

    // Discount limit (role ke hisaab se) -- Spec 7.3 / Q-08
    if (settingsSnapshot.discount.enabled) {
      const grossTotal = lines.reduce((s, l) => s + l.gross, 0);
      const totalDiscount = lines.reduce((s, l) => s + l.discount, 0) + billDiscount;
      const limit = maxDiscountPercent(user?.role, {
        cashier: settingsSnapshot.discount.cashier,
        manager: settingsSnapshot.discount.manager,
        owner: 100,
      });
      const check = checkDiscountLimit(totalDiscount, grossTotal, limit);
      if (!check.allowed) {
        throw new Error(
          `Discount ${check.percent}% is above your limit (${check.limit}%). Ask the owner or manager.`
        );
      }
    }

    // Spec 7.3: bill discount bhi kul purchase cost se neeche nahi le ja sakti
    if (settingsSnapshot.discount.blockBelowCost && billDiscount > 0) {
      const grossAll = lines.reduce((s, l) => s + l.gross, 0);
      const costAll = lines.reduce((s, l) => s + l.qtyBase * l.costPaisa, 0);
      if (grossAll >= costAll && subtotal - billDiscount < costAll) {
        throw new Error(
          `This bill discount takes the invoice below purchase cost (Rs ${(costAll / 100).toFixed(2)}). Reduce the discount.`
        );
      }
    }

    const afterDiscount = Math.max(0, subtotal - billDiscount);
    const taxPaisa = settingsSnapshot.tax.enabled
      ? percentOf(afterDiscount, settingsSnapshot.tax.percent)
      : 0;
    const beforeRound = afterDiscount + taxPaisa;
    const totalCost = Math.round(lines.reduce((sum, l) => sum + l.qtyBase * l.costPaisa, 0));
    const { finalPaise, roundOffPaise, guarded } =
      settingsSnapshot.roundMode === "down10"
        ? applyRoundWithCostGuard(beforeRound, settingsSnapshot.roundTo, totalCost)
        : { finalPaise: beforeRound, roundOffPaise: 0, guarded: false };
    if (guarded) warnings.push("Round-off skipped: it would put the bill below purchase cost.");
    if (finalPaise < totalCost) warnings.push("Bill total is BELOW purchase cost (loss sale). Check discount.");

    const method = input.paymentMethod ?? "cash";
    const isCredit = method === "credit";
    const paid = isCredit
      ? Math.max(0, Math.min(Math.round(input.paidPaisa ?? 0), finalPaise))
      : Math.max(0, Math.round(input.paidPaisa ?? finalPaise));
    const due = Math.max(0, finalPaise - paid);

    const status = input.status ?? (due > 0 ? (paid > 0 ? "partial" : "credit") : "paid");

    const header = run(
      `INSERT INTO sales
        (code, customer_id, user_id, subtotal_paisa, discount_paisa, tax_paisa, round_off_paisa,
         total_paisa, paid_paisa, due_paisa, status, payment_method, notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        code,
        input.customerId ?? null,
        user?.id ?? null,
        subtotal,
        billDiscount,
        taxPaisa,
        roundOffPaise,
        finalPaise,
        paid,
        due,
        status,
        method,
        input.notes?.trim() || null,
      ]
    );
    const saleId = header.lastInsertRowid;

    for (const l of lines) {
      run(
        `INSERT INTO sale_items
          (sale_id, product_id, batch_id, name_snapshot, qty_base, unit_sold, qty_entered,
           unit_price_paisa, discount_paisa, line_total_paisa, cost_paisa_at_sale)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [
          saleId,
          l.productId,
          l.batchId ?? null,
          l.manualName?.trim() || l.product.name,
          l.qtyBase,
          l.unit,
          Number(l.qty) || 0,
          Math.max(0, Math.round(l.unitPricePaisa)),
          l.discount,
          l.lineTotal,
          l.costPaisa,
        ]
      );

      // Stock minus
      if (l.batchId) {
        run("UPDATE batches SET qty_base = qty_base - ? WHERE id = ?", [l.qtyBase, l.batchId]);
      }
      run(
        `INSERT INTO stock_movements
          (product_id, batch_id, type, qty_base, ref_type, ref_id, ref_code, user_id)
         VALUES (?,?,?,?,?,?,?,?)`,
        [l.productId, l.batchId ?? null, "out", -l.qtyBase, "sale", saleId, code, user?.id ?? null]
      );
    }

    // Customer khatay me
    if (input.customerId && due > 0) {
      // Credit limit check (Spec 10.1.2)
      const cust = get<{ balance_paisa: number; credit_limit_paisa: number; name: string }>(
        "SELECT balance_paisa, credit_limit_paisa, name FROM customers WHERE id = ?",
        [input.customerId]
      );
      if (cust && cust.credit_limit_paisa > 0 && cust.balance_paisa + due > cust.credit_limit_paisa) {
        warnings.push(
          `${cust.name}: credit limit (${(cust.credit_limit_paisa / 100).toFixed(0)} Rs) cross ho raha hai.`
        );
      }
      run("UPDATE customers SET balance_paisa = balance_paisa + ? WHERE id = ?", [
        due,
        input.customerId,
      ]);
    }

    // Payment record
    if (paid > 0) {
      run(
        `INSERT INTO payments (method, amount_paisa, sale_id, customer_id, user_id, note)
         VALUES (?,?,?,?,?,?)`,
        [
          isCredit ? "cash" : method,
          paid,
          saleId,
          input.customerId ?? null,
          user?.id ?? null,
          "Received at counter",
        ]
      );
    }

    // Loyalty points (agar on ho -- Spec 10.1.4)
    if (settingsSnapshot.loyalty.enabled && input.customerId && finalPaise > 0) {
      const pts = Math.floor(finalPaise / 100 / settingsSnapshot.loyalty.rupeesPerPoint);
      if (pts > 0) {
        run("UPDATE customers SET loyalty_points = loyalty_points + ? WHERE id = ?", [
          pts,
          input.customerId,
        ]);
        const row = get<{ loyalty_points: number }>(
          "SELECT loyalty_points FROM customers WHERE id = ?",
          [input.customerId]
        );
        if (row && row.loyalty_points >= settingsSnapshot.loyalty.vipThreshold) {
          run("UPDATE customers SET stars = 5, category = 'vip' WHERE id = ?", [input.customerId]);
        }
      }
    }

    void audit({
      action: "create",
      userId: user?.id ?? null,
      userName: user?.name ?? null,
      entity: "Sale",
      entityId: saleId,
      details: { code, items: lines.length, total: finalPaise, method, due },
    });

    return {
      id: saleId,
      code,
      subtotalPaisa: subtotal,
      discountPaisa: billDiscount,
      taxPaisa,
      roundOffPaisa: roundOffPaise,
      totalPaisa: finalPaise,
      paidPaisa: paid,
      duePaisa: due,
      warnings,
    };
  });
}

// ---------------------------------------------------------------------------
// Settings ko transaction ke andar (synchronously) padhne ke liye chhota helper
// ---------------------------------------------------------------------------
type SyncSettings = {
  tax: { enabled: boolean; percent: number };
  roundMode: string;
  roundTo: number;
  discount: { enabled: boolean; cashier: number; manager: number; blockBelowCost: boolean };
  loyalty: { enabled: boolean; rupeesPerPoint: number; vipThreshold: number };
};

function getSyncSettings(): SyncSettings {
  const rows = query<{ key: string; value: string }>(
    `SELECT key, value FROM settings
      WHERE key IN ('tax.enabled','tax.percent','bill.roundMode','bill.roundTo',
                    'discount.enabled','discount.maxPercentCashier','discount.maxPercentManager',
                    'discount.blockBelowCost',
                    'loyalty.enabled','loyalty.rupeesPerPoint','loyalty.vipThreshold')`
  );
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const j = <T,>(key: string, fallback: T): T => {
    const raw = map.get(key);
    if (raw == null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  };
  return {
    tax: {
      enabled: j("tax.enabled", false),
      percent: Number(j("tax.percent", 0)) || 0,
    },
    roundMode: j("bill.roundMode", "down10"),
    roundTo: Number(j("bill.roundTo", 10)) || 10,
    discount: {
      enabled: j("discount.enabled", true),
      cashier: Number(j("discount.maxPercentCashier", 5)) || 0,
      manager: Number(j("discount.maxPercentManager", 20)) || 0,
      blockBelowCost: j("discount.blockBelowCost", true),
    },
    loyalty: {
      enabled: j("loyalty.enabled", false),
      rupeesPerPoint: Number(j("loyalty.rupeesPerPoint", 100)) || 100,
      vipThreshold: Number(j("loyalty.vipThreshold", 500)) || 500,
    },
  };
}

// ---------------------------------------------------------------------------
// Sale padhna (receipt ke liye)
// ---------------------------------------------------------------------------
export type SaleFull = {
  header: {
    id: number;
    code: string;
    date: string;
    customer_id: number | null;
    customer_name?: string | null;
    customer_phone?: string | null;
    subtotal_paisa: number;
    discount_paisa: number;
    tax_paisa: number;
    round_off_paisa: number;
    total_paisa: number;
    paid_paisa: number;
    due_paisa: number;
    status: string;
    payment_method: string;
    user_name?: string | null;
  };
  items: {
    id: number;
    name: string;
    name_snapshot: string | null;
    qty_base: number;
    unit_sold: string;
    qty_entered: number;
    unit_price_paisa: number;
    discount_paisa: number;
    line_total_paisa: number;
    cost_paisa_at_sale: number;
    batch_no: string | null;
    expiry_ym: string | null;
  }[];
};

export function getSale(id: number): SaleFull | null {
  const header = get<SaleFull["header"]>(
    `SELECT s.*, c.name AS customer_name, c.phone AS customer_phone, u.name AS user_name
       FROM sales s
       LEFT JOIN customers c ON c.id = s.customer_id
       LEFT JOIN users u ON u.id = s.user_id
      WHERE s.id = ?`,
    [id]
  );
  if (!header) return null;
  const items = query<SaleFull["items"][number]>(
    `SELECT i.id, p.name, i.name_snapshot, i.qty_base, i.unit_sold, i.qty_entered,
            i.unit_price_paisa, i.discount_paisa, i.line_total_paisa, i.cost_paisa_at_sale,
            b.batch_no, b.expiry_ym
       FROM sale_items i
       JOIN products p ON p.id = i.product_id
       LEFT JOIN batches b ON b.id = i.batch_id
      WHERE i.sale_id = ?
      ORDER BY i.id`,
    [id]
  );
  return { header, items };
}

export function listSales(opts: { search?: string; limit?: number; from?: string; to?: string } = {}) {
  const like = `%${(opts.search ?? "").trim()}%`;
  const where: string[] = ["(s.code LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)"];
  const params: (string | number)[] = [like, like, like];

  if (opts.from) {
    where.push("date(s.date) >= date(?)");
    params.push(opts.from);
  }
  if (opts.to) {
    where.push("date(s.date) <= date(?)");
    params.push(opts.to);
  }

  return query<{
    id: number;
    code: string;
    date: string;
    customer_name: string | null;
    items: number;
    total_paisa: number;
    discount_paisa: number;
    status: string;
    payment_method: string;
    profit_paisa: number;
  }>(
    `SELECT s.id, s.code, s.date, c.name AS customer_name,
            (SELECT COUNT(*) FROM sale_items i WHERE i.sale_id = s.id) AS items,
            s.total_paisa, s.discount_paisa, s.status, s.payment_method,
            (SELECT COALESCE(SUM(i.line_total_paisa - i.qty_base * i.cost_paisa_at_sale), 0)
               FROM sale_items i WHERE i.sale_id = s.id) AS profit_paisa
       FROM sales s
       LEFT JOIN customers c ON c.id = s.customer_id
      WHERE ${where.join(" AND ")}
      ORDER BY s.id DESC
      LIMIT ?`,
    [...params, Math.min(opts.limit ?? 100, 500)]
  );
}

/** Aaj ki sale summary (shift closing ke liye -- Phase 2 me poora) */
export function todaySummary() {
  return get<{ bills: number; total: number; cash: number; credit: number; profit: number }>(
    `SELECT COUNT(*) AS bills,
            COALESCE(SUM(s.total_paisa), 0) AS total,
            COALESCE(SUM(s.paid_paisa), 0) AS cash,
            COALESCE(SUM(s.due_paisa), 0) AS credit,
            (SELECT COALESCE(SUM(i.line_total_paisa - i.qty_base * i.cost_paisa_at_sale), 0)
               FROM sale_items i
               JOIN sales s2 ON s2.id = i.sale_id
              WHERE date(s2.date) = date('now','localtime') AND s2.status <> 'void') AS profit
       FROM sales s
      WHERE date(s.date) = date('now','localtime') AND s.status <> 'void'`
  );
}

export function saleItemCount(): number {
  return scalar<number>("SELECT COUNT(*) AS c FROM sale_items");
}
