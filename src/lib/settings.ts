// ---------------------------------------------------------------------------
// Area11 - Settings (RULE E: har cheez badalne ke qabil)
// ---------------------------------------------------------------------------
// Tamam settings DATABASE me rehti hain (sirf browser me nahi) -- is liye
// har counter/device par ek jaisi nazar aati hain (RULE S-07).
//
// Nayi setting add karni ho: sirf neeche SETTING_DEFAULTS me ek line daalein.
// ---------------------------------------------------------------------------

import { query, run } from "./db";

export type ExpiryLevel = { level: number; days: number; color: string; label: string };
export type ReorderLevel = { level: number; key: string; factor: number; label: string };

export const SETTING_DEFAULTS = {
  // ---- Store & Branding (E-02, E-03) ----
  "store.name": "Area11 Pharmacy",
  "store.address": "",
  "store.phone": "",
  "store.footerNote": "Thank you for your visit.",
  "store.terms": "Medicines are returnable within 7 days with the original receipt.",
  "brand.appName": "Area11",
  "brand.shortName": "A11",
  "brand.logoDataUrl": "",
  "brand.primaryColor": "#0e7490",

  // ---- Billing & Numbering (A-19, A-20) ----
  "bill.purchasePrefix": "PINV-",
  "bill.salePrefix": "INV-",
  "bill.numberPadding": 4,
  "bill.nextPurchaseNo": 1,
  "bill.nextSaleNo": 1,
  "bill.provisionalPrefix": "PR-",
  "bill.nextProvisionalNo": 1,
  "bill.supplierReturnPrefix": "SR-",
  "bill.nextSupplierReturnNo": 1,
  "bill.roundMode": "down10", // down10 | none
  "bill.roundTo": 10,

  // ---- Tax (Q-09: default OFF) ----
  "tax.enabled": false,
  "tax.percent": 0,
  "tax.label": "Sales Tax",

  // ---- Discount (Q-08: margin default) ----
  "discount.enabled": true,
  "discount.mode": "margin", // margin | retail
  "discount.maxPercentCashier": 5,
  "discount.maxPercentManager": 20,
  "discount.blockBelowCost": true, // Spec 7.3: rupay se neeche discount kisi role ko nahi

  // ---- Expiry alerts (user: settings se chunenge) ----
  "expiry.levels": [
    { level: 1, days: 365, color: "blue", label: "Level 1 - 1 year" },
    { level: 2, days: 180, color: "yellow", label: "Level 2 - 6 months" },
    { level: 3, days: 90, color: "red", label: "Level 3 - 3 months" },
  ] as ExpiryLevel[],

  // ---- Reorder alerts (3 tier) ----
  "reorder.enabled": true,
  "reorder.levels": [
    { level: 1, key: "warning", factor: 2.0, label: "Reorder soon" },
    { level: 2, key: "critical", factor: 1.0, label: "Order now" },
    { level: 3, key: "out", factor: 0, label: "Out of stock" },
  ] as ReorderLevel[],

  // ---- Loyalty (abhi OFF, structure ready) ----
  "loyalty.enabled": false,
  "loyalty.rupeesPerPoint": 100,
  "loyalty.vipThreshold": 500,

  // ---- Printer & Receipt ----
  "printer.width": "both", // 58 | 80 | both
  "printer.autoCut": true,
  "printer.copies": 1,
  "receipt.datePosition": "top", // top | bottom
  "receipt.showOriginalPrice": true,
  "receipt.showDiscount": true,
  "receipt.showSavings": false,
  "receipt.showCostColumns": false, // sirf owner

  // ---- Language (user: all English) ----
  "ui.language": "en",

  // ---- Payments (user: cash + credit) ----
  "payment.methods": ["cash", "credit"] as string[],
  "payment.default": "cash",

  // ---- Security (user: PIN for staff, password for owner) ----
  "security.pinLength": 4,
  "security.autoLockMinutes": 15,
  "security.sessionHours": 12,
  "security.requireLogin": true,

  // ---- Cloud sync (Supabase) - spec Phase 5 ----
  "sync.enabled": false,
  "sync.provider": "supabase",
  "sync.status": "not_configured",
  "sync.lastSyncAt": "",

  // ---- Owner ----
  "owner.name": "Dr. Adil Abdullah",
};

export type AppSettings = typeof SETTING_DEFAULTS;

/** Sab settings (defaults + DB ki values mila kar) */
export async function getSettings(): Promise<AppSettings> {
  const out = { ...SETTING_DEFAULTS } as Record<string, unknown>;
  try {
    const rows = query<{ key: string; value: string }>("SELECT key, value FROM settings");
    for (const r of rows) {
      if (!(r.key in SETTING_DEFAULTS)) continue; // na maloom key ignore
      try {
        out[r.key] = JSON.parse(r.value);
      } catch {
        out[r.key] = r.value;
      }
    }
  } catch {
    // DB abhi tayyar nahi -- defaults hi wapas
  }
  return out as AppSettings;
}

/** Ek setting save karo */
export async function setSetting(key: string, value: unknown): Promise<void> {
  run(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now','localtime'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now','localtime')`,
    [key, JSON.stringify(value)]
  );
}

/** Kai settings ek saath save karo */
export async function setSettings(patch: Record<string, unknown>): Promise<void> {
  for (const [key, value] of Object.entries(patch)) {
    await setSetting(key, value);
  }
}

/** Default setting rows banao (jo missing hain) */
export async function ensureSettingRows(): Promise<void> {
  const have = new Set(
    query<{ key: string }>("SELECT key FROM settings").map((r) => r.key)
  );
  for (const [key, value] of Object.entries(SETTING_DEFAULTS)) {
    if (have.has(key)) continue;
    run("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", [
      key,
      JSON.stringify(value),
    ]);
  }
}

/** Bill number generate karo: prefix + zero-padded number */
export function formatBillCode(prefix: string, no: number, padding: number): string {
  return `${prefix}${String(no).padStart(padding, "0")}`;
}
