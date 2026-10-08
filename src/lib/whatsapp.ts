// ---------------------------------------------------------------------------
// Area11 - WhatsApp order text (free: wa.me link, koi API/key nahi — Q-11)
// ---------------------------------------------------------------------------
// Owner chahte hain: reorder list se seedha WhatsApp par order text jaye.
// Yahan sirf TEXT banate hain; bhejne ke liye `wa.me` link (ya "copy").
// ---------------------------------------------------------------------------

import { get, query } from "./db";

export type OrderLine = {
  name: string;
  generic?: string | null;
  company?: string | null;
  stockBase: number;
  reorderLevel: number;
  baseUnit: string;
  /** kitna mangwana hai (default: reorder level se stock nikal kar) */
  suggestQty: number;
  lastCostPaisa?: number;
};

/** Reorder list: jin ki miqdar reorder level se kam/barabar hai */
export function reorderList(limit = 200): OrderLine[] {
  return query<{
    id: number; name: string; generic: string | null; company: string | null;
    base_unit: string; reorder_level: number; stock_base: number; last_cost_paisa: number;
  }>(
    `SELECT p.id, p.name, p.generic,
            (SELECT name FROM companies c WHERE c.id = p.company_id) AS company,
            p.base_unit, p.reorder_level,
            (SELECT COALESCE(SUM(b.qty_base), 0) FROM batches b
              WHERE b.product_id = p.id AND b.active = 1) AS stock_base,
            (SELECT COALESCE(SUM(b.cost_paisa * b.qty_base), 0) FROM batches b
              WHERE b.product_id = p.id AND b.active = 1) AS last_cost_paisa
       FROM products p
      WHERE p.active = 1 AND p.reorder_level > 0
        AND (SELECT COALESCE(SUM(b.qty_base), 0) FROM batches b
              WHERE b.product_id = p.id AND b.active = 1) <= p.reorder_level
      ORDER BY (stock_base * 1.0 / MAX(p.reorder_level, 1)), p.name
      LIMIT ?`,
    [limit]
  ).map((r) => ({
    name: r.name,
    generic: r.generic,
    company: r.company,
    stockBase: Number(r.stock_base ?? 0),
    reorderLevel: Number(r.reorder_level ?? 0),
    baseUnit: r.base_unit,
    // reorder level tak pura karne ke liye kitna chahiye
    suggestQty: Math.max(1, Number(r.reorder_level ?? 0) - Number(r.stock_base ?? 0)),
    lastCostPaisa: Number(r.last_cost_paisa ?? 0),
  }));
}

export type OrderOptions = {
  supplierName?: string;
  phone?: string;
  storeName?: string;
  /** checked lines (agar diya gaya ho to sirf wahi) */
  lines?: OrderLine[];
  note?: string;
};

/** WhatsApp par bhejne layiq simple text */
export function orderText(opts: OrderOptions = {}): string {
  const lines = opts.lines?.length ? opts.lines : reorderList();
  const store = (opts.storeName ?? storeNameSetting()) || "Area11";
  const head = opts.supplierName
    ? `Salam ${opts.supplierName},`
    : "Salam,";
  const body: string[] = [
    head,
    `${store} ke liye order:`,
    "",
  ];

  lines.forEach((l, i) => {
    const extra = [l.company, l.generic].filter(Boolean).join(" · ");
    body.push(`${i + 1}. ${l.name}${extra ? ` (${extra})` : ""} — ${l.suggestQty} ${l.baseUnit}`);
  });

  body.push("");
  if (opts.note) body.push(opts.note);
  body.push("Jawab zaroor dein. Shukriya.");
  return body.join("\n");
}

/** wa.me link (bina + ya country code ke bhi chal jata hai) */
export function waLink(phone: string | null | undefined, text: string): string {
  const digits = (phone ?? "").replace(/[^\d]/g, "");
  const num = digits.startsWith("92") ? digits : digits.startsWith("0") ? "92" + digits.slice(1) : digits;
  const base = num ? `https://wa.me/${num}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(text)}`;
}

/** Din ki summary bhi WhatsApp se bhej sakte hain (Q-11) */
export function daySummaryText(date = "today"): string {
  const when = date === "today" ? "date('now','localtime')" : "date(?)";
  const params = date === "today" ? [] : [date];
  const row = get<{
    bills: number; total: number; cash: number; credit: number; profit: number; expenses: number;
  }>(
    `SELECT
       (SELECT COUNT(*) FROM sales WHERE date(date) = ${when} AND status <> 'void') AS bills,
       (SELECT COALESCE(SUM(total_paisa), 0) FROM sales WHERE date(date) = ${when} AND status <> 'void') AS total,
       (SELECT COALESCE(SUM(paid_paisa), 0) FROM sales WHERE date(date) = ${when} AND status <> 'void') AS cash,
       (SELECT COALESCE(SUM(due_paisa), 0) FROM sales WHERE date(date) = ${when} AND status <> 'void') AS credit,
       (SELECT COALESCE(SUM(i.line_total_paisa - i.qty_base * i.cost_paisa_at_sale), 0)
          FROM sale_items i JOIN sales s ON s.id = i.sale_id
         WHERE date(s.date) = ${when} AND s.status <> 'void') AS profit,
       (SELECT COALESCE(SUM(amount_paisa), 0) FROM expenses WHERE date(date) = ${when}) AS expenses`,
    params
  ) ?? { bills: 0, total: 0, cash: 0, credit: 0, profit: 0, expenses: 0 };

  const rs = (p: number) => `Rs ${(p / 100).toFixed(0)}`;
  return [
    `Area11 — ${date === "today" ? "aaj" : date} ka khulasa`,
    "",
    `Bills: ${row.bills}`,
    `Bikri: ${rs(row.total)}`,
    `Naqad: ${rs(row.cash)}`,
    `Udhaar: ${rs(row.credit)}`,
    `Munafa: ${rs(row.profit)}`,
    `Kharchay: ${rs(row.expenses)}`,
  ].join("\n");
}

function storeNameSetting(): string {
  return get<{ value: string }>("SELECT value FROM settings WHERE key = 'store.name'")?.value?.replace(/^"|"$/g, "") ?? "";
}
