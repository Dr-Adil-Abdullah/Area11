// ---------------------------------------------------------------------------
// Area11 - Bill numbering (auto sequence; settings se)
// ---------------------------------------------------------------------------

import { get, run } from "./db";
import { getSettings, formatBillCode } from "./settings";

export type BillKind = "sale" | "purchase";

/** Agla bill number nikalo (settings se) */
export async function peekNextCode(kind: BillKind): Promise<string> {
  const s = await getSettings();
  const prefix = kind === "sale" ? s["bill.salePrefix"] : s["bill.purchasePrefix"];
  const no = kind === "sale" ? s["bill.nextSaleNo"] : s["bill.nextPurchaseNo"];
  return formatBillCode(prefix, Number(no) || 1, Number(s["bill.numberPadding"]) || 4);
}

/**
 * Bill number reserve karo (transaction ke andar chalna chahiye).
 * Do counter ek hi number na lein -- is liye number foran barha diya jata hai.
 */
export function takeNextCode(kind: BillKind): string {
  const prefixKey = kind === "sale" ? "bill.salePrefix" : "bill.purchasePrefix";
  const noKey = kind === "sale" ? "bill.nextSaleNo" : "bill.nextPurchaseNo";
  const padKey = "bill.numberPadding";

  const read = (key: string, fallback: string) =>
    get<{ value: string }>("SELECT value FROM settings WHERE key = ?", [key])?.value ?? fallback;

  const parse = (raw: string, fallback: unknown) => {
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  };

  const prefix = String(parse(read(prefixKey, '"INV-"'), "INV-"));
  const padding = Number(parse(read(padKey, "4"), 4)) || 4;
  let no = Number(parse(read(noKey, "1"), 1)) || 1;

  // Safety: agar koi code pehle se maujood hai to aage barhte jao
  const table = kind === "sale" ? "sales" : "purchases";
  let code = formatBillCode(prefix, no, padding);
  let guard = 0;
  while (
    get(`SELECT id FROM ${table} WHERE code = ?`, [code]) &&
    guard++ < 5000
  ) {
    no++;
    code = formatBillCode(prefix, no, padding);
  }

  run(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now','localtime'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now','localtime')`,
    [noKey, JSON.stringify(no + 1)]
  );

  return code;
}
