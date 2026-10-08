// ---------------------------------------------------------------------------
// Area11 - Stock-take (ginti)
// ---------------------------------------------------------------------------
// Dukan band kar ke ginti ka poora chakkar:
//   1. Session kholo  -> kitab ka stock freeze (har dawa + har batch)
//   2. Ginti likho    -> system vs counted, farq foran nazar aaye
//   3. Apply karo     -> asal stock durust, movement + nuqsan ki qeemat record
//
// Notes:
//   * Qeemat hamesha PURCHASE COST par -- ye asal nuqsan hai (spec 15.2).
//   * Kisi dawa ko ginna chhod bhi sakte hain (counted = null) -- wo apply
//     me chhoR di jati hai (farq nahi nikla, matlab theek hai).
//   * Ek session sirf EK baar apply hota hai.
// ---------------------------------------------------------------------------

import { get, query, run, tx } from "./db";
import { takeNextCode } from "./numbering";
import { toBaseUnits } from "./money";
import { audit } from "./audit";
type Param = string | number | bigint | null | Uint8Array;

export type StockTakeStatus = "open" | "applied" | "cancelled";

export type StockTakeRow = {
  id: number;
  code: string;
  date: string;
  status: StockTakeStatus;
  room: string | null;
  category_id: number | null;
  note: string | null;
  items_count: number;
  diff_count: number;
  short_paisa: number;
  extra_paisa: number;
  user_id: number | null;
  applied_at: string | null;
  applied_by: number | null;
  created_at: string;
};

export type StockTakeItem = {
  id: number;
  stock_take_id: number;
  product_id: number;
  batch_id: number | null;
  system_qty_base: number;
  counted_qty_base: number | null;
  unit_entered: string | null;
  qty_entered: number | null;
  diff_qty_base: number | null;
  value_paisa: number | null;
  // join se aane wali cheezein (UI ke liye)
  product_name?: string;
  batch_no?: string | null;
  expiry_ym?: string | null;
  base_unit?: string;
  box_strips?: number;
  strip_tablets?: number;
  room?: string | null;
  category?: string | null;
  cost_paisa?: number;
};

export type CountInput = {
  productId: number;
  batchId?: number | null;
  qty: number;
  unit: "box" | "strip" | "base";
};

/**
 * Ginti ka farq (kitab vs haath) -- saaf hisab, test ke qabil.
 * kami  = manfi diff (nuqsan)   ziyada = musbat diff (fayda)
 * Qeemat hamesha PURCHASE COST par.
 */
export function diffOf(
  systemQty: number,
  countedQty: number,
  costPaisa: number
): { diff: number; valuePaisa: number; reason: "count_short" | "count_extra" | "same" } {
  const diff = Math.round((countedQty - systemQty) * 1000) / 1000;
  if (diff === 0) return { diff: 0, valuePaisa: 0, reason: "same" };
  return {
    diff,
    valuePaisa: Math.round(Math.abs(diff) * Math.max(0, costPaisa)),
    reason: diff < 0 ? "count_short" : "count_extra",
  };
}

// ---------------------------------------------------------------------------
// 1) Session kholo
// ---------------------------------------------------------------------------
export function openStockTake(
  input: { room?: string | null; categoryId?: number | null; note?: string | null } = {},
  user?: { id?: number; name?: string }
): { id: number; code: string; items: number } {
  return tx(() => {
    const code = takeNextCode("stockTake");

    // Kaunsi dawayen is ginti me aayengi (room / category filter + sirf active)
    const where: string[] = ["p.active = 1"];
    const params: Param[] = [];
    if (input.room) {
      where.push("COALESCE(p.room,'') = ?");
      params.push(input.room);
    }
    if (input.categoryId) {
      where.push("p.category_id = ?");
      params.push(input.categoryId);
    }

    const rows = query<{
      product_id: number;
      batch_id: number | null;
      system_qty_base: number;
    }>(
      `SELECT p.id AS product_id, b.id AS batch_id, COALESCE(b.qty_base, 0) AS system_qty_base
         FROM products p
         LEFT JOIN batches b ON b.product_id = p.id AND b.active = 1 AND b.qty_base <> 0
        WHERE ${where.join(" AND ")}
        ORDER BY p.name, b.expiry_ym`,
      params
    );

    const head = run(
      `INSERT INTO stock_takes (code, status, room, category_id, note, items_count, user_id)
       VALUES (?, 'open', ?, ?, ?, ?, ?)`,
      [code, input.room ?? null, input.categoryId ?? null, input.note?.trim() || null, rows.length, user?.id ?? null]
    );
    const id = Number(head.lastInsertRowid);

    for (const r of rows) {
      run(
        `INSERT INTO stock_take_items (stock_take_id, product_id, batch_id, system_qty_base)
         VALUES (?,?,?,?)`,
        [id, r.product_id, r.batch_id, r.system_qty_base]
      );
    }

    void audit({ action: "create", userId: user?.id ?? null, userName: user?.name ?? null, entity: "stock_take", entityId: id,
      module: "Stock", before: null, after: { code, status: "open", lines: rows.length },
      details: { code, lines: rows.length } });
    return { id, code, items: rows.length };
  });
}

// ---------------------------------------------------------------------------
// 2) Ginti likho (ek ya ek se zyada line ek hi call me)
// ---------------------------------------------------------------------------
export function saveCounts(
  stockTakeId: number,
  counts: CountInput[],
  user?: { id?: number; name?: string }
): { saved: number } {
  const st = getStockTake(stockTakeId);
  if (!st) throw new Error("Ginti ka session nahi mila.");
  if (st.status !== "open") throw new Error("Ye ginti band ho chuki hai — ab is me tabdeeli nahi ho sakti.");

  return tx(() => {
    let saved = 0;
    for (const c of counts) {
      type Line = {
        id: number;
        product_id: number;
        batch_id: number | null;
        system_qty_base: number;
        cost_paisa: number;
        box_strips: number;
        strip_tablets: number;
        product_name: string;
      };
      const cols = `SELECT ti.id, ti.product_id, ti.batch_id, ti.system_qty_base,
                COALESCE(b.cost_paisa, p.cost_paisa, 0) AS cost_paisa,
                COALESCE(p.box_strips,1) AS box_strips, COALESCE(p.strip_tablets,1) AS strip_tablets,
                p.name AS product_name
           FROM stock_take_items ti
           JOIN products p ON p.id = ti.product_id
           LEFT JOIN batches b ON b.id = ti.batch_id`;

      let line: Line | undefined;

      if (c.batchId != null) {
        // Batch bataya gaya hai -- seedha usi line par
        line = get<Line>(`${cols} WHERE ti.stock_take_id = ? AND ti.product_id = ? AND ti.batch_id = ? LIMIT 1`, [
          stockTakeId,
          c.productId,
          c.batchId,
        ]);
      } else {
        // Batch nahi bataya: is dawa ki sirf EK line ho to wohi le lo,
        // warna saaf batana behtar hai ke kaun se batch ki baat ho rahi hai.
        const many = query<Line>(`${cols} WHERE ti.stock_take_id = ? AND ti.product_id = ?`, [
          stockTakeId,
          c.productId,
        ]);
        if (many.length === 1) line = many[0];
        else if (many.length > 1) {
          throw new Error(
            `${many[0].product_name} ke ${many.length} batch hain — ginti likhte waqt batch batana zaroori hai.`
          );
        }
      }
      if (!line) continue;

      const qtyEntered = Number(c.qty);
      if (!isFinite(qtyEntered) || qtyEntered < 0) throw new Error("Ginti 0 ya us se zyada honi chahiye.");

      const countedBase = toBaseUnits(qtyEntered, c.unit, line.box_strips, line.strip_tablets);
      const { diff, valuePaisa: value } = diffOf(line.system_qty_base, countedBase, line.cost_paisa);

      run(
        `UPDATE stock_take_items
            SET counted_qty_base = ?, unit_entered = ?, qty_entered = ?, diff_qty_base = ?, value_paisa = ?
          WHERE id = ?`,
        [countedBase, c.unit, qtyEntered, diff, value, line.id]
      );
      saved++;
    }

    if (saved > 0) recalcSummary(stockTakeId);
    return { saved };
  });
}

// ---------------------------------------------------------------------------
// 3) Apply -- asal stock durust karo
// ---------------------------------------------------------------------------
export function applyStockTake(
  stockTakeId: number,
  user?: { id?: number; name?: string }
): { id: number; code: string; changed: number; shortPaisa: number; extraPaisa: number } {
  const st = getStockTake(stockTakeId);
  if (!st) throw new Error("Ginti ka session nahi mila.");
  if (st.status !== "open") throw new Error("Ye ginti apply ho chuki hai ya cancel — dobara nahi ho sakti.");

  return tx(() => {
    const lines = query<{
      id: number;
      product_id: number;
      batch_id: number | null;
      diff_qty_base: number | null;
      value_paisa: number | null;
      cost_paisa: number;
      product_name: string;
      batch_no: string | null;
    }>(
      `SELECT ti.id, ti.product_id, ti.batch_id, ti.diff_qty_base, ti.value_paisa,
              COALESCE(b.cost_paisa, p.cost_paisa, 0) AS cost_paisa,
              p.name AS product_name, b.batch_no
         FROM stock_take_items ti
         JOIN products p ON p.id = ti.product_id
         LEFT JOIN batches b ON b.id = ti.batch_id
        WHERE ti.stock_take_id = ? AND ti.diff_qty_base IS NOT NULL AND ti.diff_qty_base <> 0`,
      [stockTakeId]
    );

    let changed = 0;
    let shortPaisa = 0;
    let extraPaisa = 0;

    for (const l of lines) {
      const diff = Number(l.diff_qty_base);
      if (!diff) continue;

      // NOTE: products table me koi "stock_base" column NAHI hai --
      //       asal stock sirf batches.qty_base me rehta hai.
      let batchId: number | null = l.batch_id;

      if (batchId) {
        const b = get<{ id: number; qty_base: number }>("SELECT id, qty_base FROM batches WHERE id = ?", [batchId]);
        if (!b) continue;
        run("UPDATE batches SET qty_base = MAX(0, ?) WHERE id = ?", [b.qty_base + diff, b.id]);
      } else if (diff > 0) {
        // Kitab me is dawa ka koi batch hi nahi tha, magar ginti me maal mila
        // (masalan khareed darj karna bhool gaye the) -- ek batch bana dete hain.
        const ins = run(
          `INSERT INTO batches (product_id, batch_no, qty_base, cost_paisa, expiry_ym)
           VALUES (?, ?, ?, ?, NULL)`,
          [l.product_id, `GINTI-${st.code}`, diff, l.cost_paisa]
        );
        batchId = Number(ins.lastInsertRowid);
      } else {
        // batch hi nahi aur ginti me kam mila -- kitab me 0 tha, kuch katne ko nahi
        continue;
      }

      const reason = diff < 0 ? "count_short" : "count_extra";
      const reasonLabel = diff < 0 ? "Count short (ginti me kam)" : "Count extra (ginti me zyada)";

      const mv = run(
        `INSERT INTO stock_movements (product_id, batch_id, type, qty_base, ref_type, ref_id, note, user_id)
         VALUES (?,?,?,?,?,?,?,?)`,
        [
          l.product_id,
          batchId,
          "adjust",
          diff,
          "stock_take",
          stockTakeId,
          `${reasonLabel} — ginti ${st.code}`,
          user?.id ?? null,
        ]
      );

      run(
        `INSERT INTO stock_adjustments
           (product_id, batch_id, direction, qty_base, unit_entered, qty_entered, value_paisa,
            reason, note, user_id, movement_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [
          l.product_id,
          batchId,
          diff < 0 ? "out" : "in",
          Math.abs(diff),
          "base",
          Math.abs(diff),
          Number(l.value_paisa ?? 0),
          reason,
          `Ginti ${st.code}`,
          user?.id ?? null,
          Number(mv.lastInsertRowid),
        ]
      );

      if (diff < 0) shortPaisa += Number(l.value_paisa ?? 0);
      else extraPaisa += Number(l.value_paisa ?? 0);
      changed++;
    }

    run(
      `UPDATE stock_takes
          SET status = 'applied', applied_at = datetime('now','localtime'), applied_by = ?,
              short_paisa = ?, extra_paisa = ?
        WHERE id = ?`,
      [user?.id ?? null, shortPaisa, extraPaisa, stockTakeId]
    );

    void audit({ action: "update", userId: user?.id ?? null, userName: user?.name ?? null, entity: "stock_take", entityId: stockTakeId,
      module: "Stock",
      before: { code: st.code, status: "open", applied: 0 },
      after: { code: st.code, status: "applied", applied: 1, changed, shortPaisa, extraPaisa },
      details: { code: st.code, changed, shortPaisa, extraPaisa } });
    return { id: stockTakeId, code: st.code, changed, shortPaisa, extraPaisa };
  });
}

export function cancelStockTake(stockTakeId: number, user?: { id?: number; name?: string }): void {
  const st = getStockTake(stockTakeId);
  if (!st) throw new Error("Ginti ka session nahi mila.");
  if (st.status !== "open") throw new Error("Sirf khuli hui ginti cancel ho sakti hai.");
  run("UPDATE stock_takes SET status = 'cancelled' WHERE id = ?", [stockTakeId]);
  void audit({ action: "delete", userId: user?.id ?? null, userName: user?.name ?? null, entity: "stock_take", entityId: stockTakeId,
    module: "Stock", before: { code: st.code, status: "open" }, after: { code: st.code, status: "cancelled" },
    details: { code: st.code } });
}

// ---------------------------------------------------------------------------
// Padhne ke functions
// ---------------------------------------------------------------------------
export function getStockTake(id: number): StockTakeRow | undefined {
  return get<StockTakeRow>("SELECT * FROM stock_takes WHERE id = ?", [id]);
}

export function listStockTakes(limit = 20): (StockTakeRow & { user_name?: string | null })[] {
  return query<StockTakeRow & { user_name?: string | null }>(
    `SELECT st.*, u.name AS user_name
       FROM stock_takes st
       LEFT JOIN users u ON u.id = st.user_id
      ORDER BY st.id DESC
      LIMIT ?`,
    [Math.min(Math.max(1, limit), 100)]
  );
}

export function stockTakeItems(stockTakeId: number): StockTakeItem[] {
  return query<StockTakeItem>(
    `SELECT ti.*, p.name AS product_name, p.base_unit, p.box_strips, p.strip_tablets, p.room,
            c.name AS category, b.batch_no, b.expiry_ym,
            COALESCE(b.cost_paisa, p.cost_paisa, 0) AS cost_paisa
       FROM stock_take_items ti
       JOIN products p ON p.id = ti.product_id
       LEFT JOIN batches b ON b.id = ti.batch_id
       LEFT JOIN categories c ON c.id = p.category_id
      WHERE ti.stock_take_id = ?
      ORDER BY (ti.diff_qty_base IS NOT NULL AND ti.diff_qty_base <> 0) DESC, p.name, b.expiry_ym`,
    [stockTakeId]
  );
}

/** Session ka khulasa (kitni ginti hui, kitne farq, qeemat) */
function recalcSummary(stockTakeId: number): void {
  const s = get<{ c: number; short_p: number; extra_p: number }>(
    `SELECT COUNT(*) AS c,
            COALESCE(SUM(CASE WHEN diff_qty_base < 0 THEN value_paisa ELSE 0 END),0) AS short_p,
            COALESCE(SUM(CASE WHEN diff_qty_base > 0 THEN value_paisa ELSE 0 END),0) AS extra_p
       FROM stock_take_items
      WHERE stock_take_id = ? AND diff_qty_base IS NOT NULL AND diff_qty_base <> 0`,
    [stockTakeId]
  );
  run(
    `UPDATE stock_takes SET diff_count = ?, short_paisa = ?, extra_paisa = ? WHERE id = ?`,
    [s?.c ?? 0, s?.short_p ?? 0, s?.extra_p ?? 0, stockTakeId]
  );
}
