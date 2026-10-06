// ---------------------------------------------------------------------------
// Area11 - Settings ko transaction ke ANDAR (synchronously) padhna
// ---------------------------------------------------------------------------
// getSettings() async hai -- aur SQLite transaction ke andar async kaam nahi
// karta. Is liye har engine (sale, return, purchase ...) ke liye ye chhota
// sync reader hai. (Koi bhi setting yahan add karein to sab jagah mil jaye.)
// ---------------------------------------------------------------------------

import { query } from "./db";

export type SyncSettings = {
  tax: { enabled: boolean; percent: number; label: string };
  roundMode: string;
  roundTo: number;
  discount: { enabled: boolean; mode: string; cashier: number; manager: number; blockBelowCost: boolean };
  loyalty: { enabled: boolean; rupeesPerPoint: number; vipThreshold: number };
  credit: { blockOverLimit: boolean; managerCanOverride: boolean };
  stock: { allowNegative: boolean; warnNegative: boolean };
  returns: { requireInvoice: boolean; maxDays: number };
};

const KEYS = [
  "tax.enabled",
  "tax.percent",
  "tax.label",
  "bill.roundMode",
  "bill.roundTo",
  "discount.enabled",
  "discount.mode",
  "discount.maxPercentCashier",
  "discount.maxPercentManager",
  "discount.blockBelowCost",
  "loyalty.enabled",
  "loyalty.rupeesPerPoint",
  "loyalty.vipThreshold",
  "credit.blockOverLimit",
  "credit.managerCanOverride",
  "stock.allowNegative",
  "stock.warnNegative",
  "returns.requireInvoice",
  "returns.maxDays",
] as const;

export function getSyncSettings(): SyncSettings {
  let rows: { key: string; value: string }[] = [];
  try {
    rows = query<{ key: string; value: string }>(
      `SELECT key, value FROM settings WHERE key IN (${KEYS.map(() => "?").join(",")})`,
      KEYS as unknown as string[]
    );
  } catch {
    rows = [];
  }
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
  const n = (key: string, fallback: number): number => Number(j(key, fallback)) || fallback;

  return {
    tax: {
      enabled: j("tax.enabled", false),
      percent: n("tax.percent", 0),
      label: j("tax.label", "Sales Tax"),
    },
    roundMode: j("bill.roundMode", "down10"),
    roundTo: n("bill.roundTo", 10),
    discount: {
      enabled: j("discount.enabled", true),
      mode: j("discount.mode", "margin"),
      cashier: n("discount.maxPercentCashier", 5),
      manager: n("discount.maxPercentManager", 20),
      blockBelowCost: j("discount.blockBelowCost", true),
    },
    loyalty: {
      enabled: j("loyalty.enabled", false),
      rupeesPerPoint: n("loyalty.rupeesPerPoint", 100),
      vipThreshold: n("loyalty.vipThreshold", 500),
    },
    credit: {
      blockOverLimit: j("credit.blockOverLimit", false),
      managerCanOverride: j("credit.managerCanOverride", true),
    },
    stock: {
      allowNegative: j("stock.allowNegative", true),
      warnNegative: j("stock.warnNegative", true),
    },
    returns: {
      requireInvoice: j("returns.requireInvoice", true),
      maxDays: n("returns.maxDays", 0),
    },
  };
}
