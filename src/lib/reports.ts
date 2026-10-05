// ---------------------------------------------------------------------------
// Area11 - Reports (Phase 5, spec §11.1): roz / mahaney ka hisab
// ---------------------------------------------------------------------------
// Sab kuch integer paisa me; percentages bhi yahan se milte hain.
// ---------------------------------------------------------------------------

import { get, query } from "./db";

export type Range = { from: string; to: string }; // YYYY-MM-DD

function day(day?: string): string {
  return day ?? get<{ d: string }>("SELECT date('now','localtime') AS d")!.d;
}

export type ReportTotals = {
  bills: number;
  itemsSold: number;
  salesPaisa: number;
  discountPaisa: number;
  costPaisa: number;
  profitPaisa: number;
  cashPaisa: number;
  creditPaisa: number;
  refundPaisa: number;
  expensesPaisa: number;
  purchasesPaisa: number;
  avgBillPaisa: number;
  marginPercent: number;
};

function totals(r: Range): ReportTotals {
  const row = get<{
    bills: number; items: number; sales: number; disc: number; cost: number;
    cash: number; credit: number; refund: number; expenses: number; purchases: number;
  }>(
    `SELECT
      (SELECT COUNT(*) FROM sales WHERE date(date) BETWEEN ? AND ? AND status <> 'void') AS bills,
      (SELECT COALESCE(SUM(i.qty_base), 0) FROM sale_items i
         JOIN sales s ON s.id = i.sale_id
        WHERE date(s.date) BETWEEN ? AND ? AND s.status <> 'void') AS items,
      (SELECT COALESCE(SUM(total_paisa), 0) FROM sales WHERE date(date) BETWEEN ? AND ? AND status <> 'void') AS sales,
      (SELECT COALESCE(SUM(discount_paisa), 0) FROM sales WHERE date(date) BETWEEN ? AND ? AND status <> 'void') AS disc,
      (SELECT COALESCE(SUM(i.qty_base * i.cost_paisa_at_sale), 0) FROM sale_items i
         JOIN sales s ON s.id = i.sale_id
        WHERE date(s.date) BETWEEN ? AND ? AND s.status <> 'void') AS cost,
      (SELECT COALESCE(SUM(paid_paisa), 0) FROM sales WHERE date(date) BETWEEN ? AND ? AND status <> 'void') AS cash,
      (SELECT COALESCE(SUM(due_paisa), 0) FROM sales WHERE date(date) BETWEEN ? AND ? AND status <> 'void') AS credit,
      (SELECT COALESCE(SUM(refund_paisa), 0) FROM sale_returns WHERE date(date) BETWEEN ? AND ?) AS refund,
      (SELECT COALESCE(SUM(amount_paisa), 0) FROM expenses WHERE date(date) BETWEEN ? AND ?) AS expenses,
      (SELECT COALESCE(SUM(total_paisa), 0) FROM purchases WHERE date(date) BETWEEN ? AND ?) AS purchases`,
    [r.from, r.to, r.from, r.to, r.from, r.to, r.from, r.to, r.from, r.to,
     r.from, r.to, r.from, r.to, r.from, r.to, r.from, r.to]
  ) ?? { bills: 0, items: 0, sales: 0, disc: 0, cost: 0, cash: 0, credit: 0, refund: 0, expenses: 0, purchases: 0 };

  const salesMinusRefund = row.sales - row.refund;
  const profit = salesMinusRefund - row.cost;
  return {
    bills: row.bills,
    itemsSold: row.items,
    salesPaisa: row.sales,
    discountPaisa: row.disc,
    costPaisa: row.cost,
    profitPaisa: profit,
    cashPaisa: row.cash,
    creditPaisa: row.credit,
    refundPaisa: row.refund,
    expensesPaisa: row.expenses,
    purchasesPaisa: row.purchases,
    avgBillPaisa: row.bills ? Math.round(row.sales / row.bills) : 0,
    marginPercent: salesMinusRefund > 0 ? Math.round((profit / salesMinusRefund) * 1000) / 10 : 0,
  };
}

export type TopRow = {
  product_id: number; name: string; qty: number; value: number; profit: number;
};

function topProducts(r: Range, limit = 10): TopRow[] {
  return query<TopRow>(
    `SELECT i.product_id, p.name,
            COALESCE(SUM(i.qty_base), 0) AS qty,
            COALESCE(SUM(i.line_total_paisa), 0) AS value,
            COALESCE(SUM(i.line_total_paisa - i.qty_base * i.cost_paisa_at_sale), 0) AS profit
       FROM sale_items i
       JOIN sales s ON s.id = i.sale_id
       JOIN products p ON p.id = i.product_id
      WHERE date(s.date) BETWEEN ? AND ? AND s.status <> 'void'
      GROUP BY i.product_id, p.name
      ORDER BY qty DESC
      LIMIT ?`,
    [r.from, r.to, limit]
  );
}

export type DailyPoint = { day: string; sales: number; profit: number; bills: number };

function byDay(r: Range): DailyPoint[] {
  return query<DailyPoint>(
    `SELECT date(s.date) AS day,
            COALESCE(SUM(s.total_paisa), 0) AS sales,
            COALESCE(SUM(i.line_total_paisa - i.qty_base * i.cost_paisa_at_sale), 0) AS profit,
            COUNT(DISTINCT s.id) AS bills
       FROM sales s
       LEFT JOIN sale_items i ON i.sale_id = s.id
      WHERE date(s.date) BETWEEN ? AND ? AND s.status <> 'void'
      GROUP BY date(s.date)
      ORDER BY day`,
    [r.from, r.to]
  );
}

export type CategoryRow = { name: string; value: number; profit: number };

function byCategory(r: Range): CategoryRow[] {
  return query<CategoryRow>(
    `SELECT COALESCE(c.name, 'Bina category') AS name,
            COALESCE(SUM(i.line_total_paisa), 0) AS value,
            COALESCE(SUM(i.line_total_paisa - i.qty_base * i.cost_paisa_at_sale), 0) AS profit
       FROM sale_items i
       JOIN sales s ON s.id = i.sale_id
       LEFT JOIN products p ON p.id = i.product_id
       LEFT JOIN categories c ON c.id = p.category_id
      WHERE date(s.date) BETWEEN ? AND ? AND s.status <> 'void'
      GROUP BY COALESCE(c.name, 'Bina category')
      ORDER BY value DESC`,
    [r.from, r.to]
  );
}

export type DeadRow = {
  product_id: number; name: string; stock: number; lastSold: string | null; days: number | null;
};

/** Jo dawayen bik hi nahi raheen (dead stock) */
function deadStock(days = 60, limit = 15): DeadRow[] {
  return query<DeadRow>(
    `SELECT p.id AS product_id, p.name,
            (SELECT COALESCE(SUM(b.qty_base), 0) FROM batches b WHERE b.product_id = p.id AND b.active = 1) AS stock,
            (SELECT MAX(date(s.date)) FROM sale_items i JOIN sales s ON s.id = i.sale_id
              WHERE i.product_id = p.id AND s.status <> 'void') AS lastSold,
            CAST(julianday('now','localtime') -
                 julianday((SELECT MAX(date(s.date)) FROM sale_items i JOIN sales s ON s.id = i.sale_id
                             WHERE i.product_id = p.id AND s.status <> 'void')) AS INTEGER) AS days
       FROM products p
      WHERE p.active = 1
        AND (SELECT COALESCE(SUM(b.qty_base), 0) FROM batches b WHERE b.product_id = p.id AND b.active = 1) > 0
      ORDER BY days DESC NULLS FIRST, stock DESC
      LIMIT ?`,
    [limit]
  ).filter((r) => r.days === null || r.days >= days);
}

export function report(range: Range, opts: { deadDays?: number } = {}) {
  return {
    range,
    totals: totals(range),
    top: topProducts(range),
    daily: byDay(range),
    categories: byCategory(range),
    dead: deadStock(opts.deadDays ?? 60),
  };
}

/** Mahaney ke shuru/akhir ki tareekh */
export function monthRange(m?: string): Range {
  const ym = m ?? get<{ m: string }>("SELECT strftime('%Y-%m','now','localtime') AS m")!.m;
  const from = `${ym}-01`;
  const to = get<{ d: string }>(
    "SELECT date(?, '+1 month', '-1 day') AS d",
    [from]
  )!.d;
  return { from, to };
}

export function todayRange(): Range {
  const d = day();
  return { from: d, to: d };
}

export function daysRange(n: number): Range {
  const to = day();
  const from = get<{ d: string }>("SELECT date('now','localtime', ?) AS d", [`-${Math.max(0, n - 1)} days`])!.d;
  return { from, to };
}

export { totals as reportTotals, topProducts, byDay, byCategory, deadStock };
