// ---------------------------------------------------------------------------
// Area11 - POS search engine (Spec 5.2 FIFO + Spec 11.1 multi-search)
// ---------------------------------------------------------------------------
// Talash: naam, generic/salt, brand, barcode, rack number -- sab se.
// Batches: qareeb tareen expiry sab se UPAR (FIFO).
// ---------------------------------------------------------------------------

import { query, get } from "./db";

export type PosBatch = {
  id: number;
  batch_no: string;
  expiry_ym: string | null;
  expiry_date: string | null;
  qty_base: number;
  cost_paisa: number;
  retail_paisa: number;
  vip_paisa: number;
  doctor_paisa: number;
  status: "ok" | "near" | "very_near" | "expired";
};

export type PosProduct = {
  id: number;
  name: string;
  generic: string | null;
  brand: string | null;
  barcode: string | null;
  rack_no: string | null;
  pack_size_label: string | null;
  base_unit: string;
  box_strips: number;
  strip_tablets: number;
  retail_paisa: number;
  vip_paisa: number;
  doctor_paisa: number;
  cost_paisa: number;
  stock_base: number;
  batches: PosBatch[];
};

export type ExpiryLevels = { level: number; days: number; color: string; label: string }[];

/** Expiry status nikalo (settings ke levels ke mutabiq) */
export function expiryStatus(expiryYm: string | null, levels: ExpiryLevels): PosBatch["status"] {
  if (!expiryYm) return "ok";
  const [y, m] = expiryYm.split("-").map(Number);
  if (!y || !m) return "ok";

  // Mahine ka aakhri din
  const exp = new Date(y, m, 0, 23, 59, 59);
  const now = new Date();
  const days = Math.floor((exp.getTime() - now.getTime()) / 86400000);

  if (days < 0) return "expired";

  const sorted = [...(levels ?? [])].sort((a, b) => b.days - a.days);
  const l3 = sorted.find((l) => l.level === 3)?.days ?? 90;
  const l2 = sorted.find((l) => l.level === 2)?.days ?? 180;

  if (days <= l3) return "very_near";
  if (days <= l2) return "near";
  return "ok";
}

/** Dawa talaash karo (POS ke liye) -- batches ke saath, FIFO tarteeb me */
export function searchForPos(
  q: string,
  levels: ExpiryLevels,
  limit = 12
): PosProduct[] {
  const term = (q ?? "").trim();
  if (!term) return [];
  const like = `%${term}%`;

  const products = query<{
    id: number;
    name: string;
    generic: string | null;
    brand: string | null;
    barcode: string | null;
    rack_no: string | null;
    pack_size_label: string | null;
    base_unit: string;
    box_strips: number;
    strip_tablets: number;
    retail_paisa: number;
    vip_paisa: number;
    doctor_paisa: number;
    cost_paisa: number;
    stock_base: number;
  }>(
    `SELECT p.id, p.name, p.generic, p.brand, p.barcode, p.rack_no, p.pack_size_label,
            p.base_unit, p.box_strips, p.strip_tablets, p.retail_paisa, p.vip_paisa,
            p.doctor_paisa, p.cost_paisa,
            (SELECT COALESCE(SUM(b.qty_base),0) FROM batches b
              WHERE b.product_id = p.id AND b.active = 1) AS stock_base
       FROM products p
      WHERE p.active = 1
        AND (p.name LIKE ? OR p.generic LIKE ? OR p.brand LIKE ?
             OR p.barcode LIKE ? OR p.rack_no LIKE ?)
      ORDER BY
        CASE WHEN p.barcode = ? THEN 0
             WHEN p.name LIKE ? THEN 1
             ELSE 2 END,
        p.name COLLATE NOCASE
      LIMIT ?`,
    [like, like, like, like, like, term, `${term}%`, limit]
  );

  const today = new Date().toISOString().slice(0, 10);

  return products.map((p) => {
    const batches = query<{
      id: number;
      batch_no: string;
      expiry_ym: string | null;
      expiry_date: string | null;
      qty_base: number;
      cost_paisa: number;
      retail_paisa: number;
      vip_paisa: number;
      doctor_paisa: number;
    }>(
      `SELECT id, batch_no, expiry_ym, expiry_date, qty_base, cost_paisa,
              retail_paisa, vip_paisa, doctor_paisa
         FROM batches
        WHERE product_id = ? AND active = 1 AND qty_base > 0
          AND (expiry_date IS NULL OR date(expiry_date) >= date(?))
        ORDER BY
          CASE WHEN expiry_ym IS NULL THEN 1 ELSE 0 END,
          expiry_ym ASC,
          id ASC`,
      [p.id, today]
    );

    // Expired batches bhi dikhado (nishani ke liye) -- magar sab se neeche
    const expired = query<{
      id: number;
      batch_no: string;
      expiry_ym: string | null;
      expiry_date: string | null;
      qty_base: number;
      cost_paisa: number;
      retail_paisa: number;
      vip_paisa: number;
      doctor_paisa: number;
    }>(
      `SELECT id, batch_no, expiry_ym, expiry_date, qty_base, cost_paisa,
              retail_paisa, vip_paisa, doctor_paisa
         FROM batches
        WHERE product_id = ? AND active = 1 AND qty_base > 0
          AND expiry_date IS NOT NULL AND date(expiry_date) < date(?)
        ORDER BY expiry_ym ASC LIMIT 3`,
      [p.id, today]
    );

    const all = [...batches, ...expired].map((b) => ({
      ...b,
      status: expiryStatus(b.expiry_ym, levels),
    }));

    return { ...p, batches: all };
  });
}

/** Barcode se seedha product (scanner ke liye) */
export function findByBarcodePos(barcode: string, levels: ExpiryLevels) {
  const found = searchForPos(barcode, levels, 1);
  if (found.length === 1 && found[0].barcode === barcode.trim()) return found[0];
  const row = get<{ id: number }>(
    "SELECT id FROM products WHERE barcode = ? AND active = 1 LIMIT 1",
    [barcode.trim()]
  );
  if (!row) return null;
  const again = searchForPos(barcode, levels, 5);
  return again.find((p) => p.id === row.id) ?? null;
}

/** Rate chuno (customer category ke mutabiq) -- Spec 7.1 */
export function priceFor(
  batch: Pick<PosBatch, "retail_paisa" | "vip_paisa" | "doctor_paisa"> | null,
  product: Pick<PosProduct, "retail_paisa" | "vip_paisa" | "doctor_paisa">,
  category: string
): number {
  const pick = (o: { retail_paisa: number; vip_paisa: number; doctor_paisa: number }) => {
    if (category === "vip" && o.vip_paisa > 0) return o.vip_paisa;
    if (category === "doctor" && o.doctor_paisa > 0) return o.doctor_paisa;
    return o.retail_paisa || product.retail_paisa;
  };
  return pick(batch ?? product);
}
