// ---------------------------------------------------------------------------
// Area11 - Sale returns & void (Phase 2)
// Rules (user ke tasdeeq shuda usool, legacy demo se):
//  * Refund = ASAL wasool shuda raqam ka hissa (discount/round-off ke baad), aaj ka rate nahi.
//  * Cumulative return kabhi sold qty se zyada nahi.
//  * MALIK KA HUKUM (U-32): default = maal FORAN stock me wapas (restock = 1).
//  * U-35: har wapsi ka ek MUSTAQIL number (RET-0001) jo kabhi nahi badalta.
//  * Asal sale_items kabhi edit nahi hoti; return alag table me.
// ---------------------------------------------------------------------------
import { get, query, run, tx, scalar } from "./db";
import { audit } from "./audit";
import { getSyncSettings } from "./settings-sync";
import { takeNextCode } from "./numbering";

type U = { id?: number; name?: string; role?: string } | null | undefined;

/** Sirf owner/manager maal stock me wapas daal sakta hai (cashier sirf QUARANTINE) */
function canRestock(user?: U): boolean {
  if (!user?.role) return true; // internal calls (tests/scripts)
  return user.role === "owner" || user.role === "manager";
}

export type SaleItemReturnInfo = {
  id: number; product_id: number; batch_id: number | null; name: string;
  qty_base: number; line_total_paisa: number; returned_qty: number; refunded_paisa: number;
};

export function saleWithReturns(saleId: number) {
  const sale = get<{ id: number; code: string; status: string; subtotal_paisa: number; total_paisa: number;
    paid_paisa: number; due_paisa: number; customer_id: number | null; date: string }>(
    "SELECT id, code, status, subtotal_paisa, total_paisa, paid_paisa, due_paisa, customer_id, date FROM sales WHERE id = ?", [saleId]);
  if (!sale) return null;
  const items = query<SaleItemReturnInfo>(
    `SELECT i.id, i.product_id, i.batch_id, COALESCE(i.name_snapshot, p.name) AS name, i.qty_base, i.line_total_paisa,
            COALESCE((SELECT SUM(r.qty_base) FROM sale_returns r WHERE r.sale_item_id = i.id), 0) AS returned_qty,
            COALESCE((SELECT SUM(r.refund_paisa) FROM sale_returns r WHERE r.sale_item_id = i.id), 0) AS refunded_paisa
       FROM sale_items i JOIN products p ON p.id = i.product_id WHERE i.sale_id = ? ORDER BY i.id`, [saleId]);
  return { sale, items };
}

// ---------------------------------------------------------------------------
// Spec 3: SAKHT jaanch (validation) -- bina asal bill ke wapsi nahi
// ---------------------------------------------------------------------------
export type ReturnCheck = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  /** har line ke liye: kitna wapas ho sakta hai */
  lines: { saleItemId: number; name: string; sold: number; returned: number; canReturn: number }[];
  maxRefundPaisa: number;
};

/**
 * Bill number (code) ya id se asal sale dhoondho + wapsi se pehle jaanch.
 * UI isi ko "Check" button se bhi bula sakta hai.
 */
export function validateReturn(
  saleId: number,
  lines: { saleItemId: number; qtyBase: number }[],
  opts: { invoiceCode?: string } = {}
): ReturnCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  const data = saleWithReturns(saleId);
  const S = getSyncSettings();

  if (!data) {
    return { ok: false, errors: [`Bill nahi mila (id ${saleId}). Asal bill number se dhoondein.`], warnings, lines: [], maxRefundPaisa: 0 };
  }
  // Invoice number ka milan (Spec 3: "validated against original invoice numbers")
  if (opts.invoiceCode && opts.invoiceCode.trim().toUpperCase() !== data.sale.code.toUpperCase()) {
    errors.push(`Bill number mismatch: aap ne "${opts.invoiceCode.trim()}" likha, system me is id par "${data.sale.code}" hai.`);
  }
  if (S.returns.requireInvoice && !data.sale.code) {
    errors.push("Asal bill ke baghair wapsi mumkin nahi (Settings › Returns me ijazat dein).");
  }
  if (data.sale.status === "void") errors.push("Ye bill cancel (void) ho chuka hai — wapsi nahi ho sakti.");

  // Wapsi ki mohelat (maxDays 0 = koi hadd nahi)
  if (S.returns.maxDays > 0) {
    const ageDays =
      scalar<number>("SELECT CAST(julianday('now','localtime') - julianday(date) AS INTEGER) FROM sales WHERE id = ?", [saleId]) ?? 0;
    if (ageDays > S.returns.maxDays) {
      errors.push(`Wapsi ki mohelat (${S.returns.maxDays} din) guzar chuki — ye bill ${ageDays} din purana hai.`);
    }
  }

  const out: ReturnCheck["lines"] = [];
  for (const l of lines) {
    const it = data.items.find((x) => x.id === l.saleItemId);
    if (!it) {
      errors.push(`Item #${l.saleItemId} is bill (${data.sale.code}) me hai hi nahi.`);
      continue;
    }
    const canReturn = Math.max(0, it.qty_base - it.returned_qty);
    out.push({ saleItemId: it.id, name: it.name, sold: it.qty_base, returned: it.returned_qty, canReturn });
    const qty = Number(l.qtyBase) || 0;
    if (qty <= 0) continue;
    if (qty > canReturn + 1e-9) {
      errors.push(
        `${it.name}: is bill me ${it.qty_base} bike the, ${it.returned_qty} wapas ho chuke — ab sirf ${canReturn} wapas ho sakte hain.`
      );
    }
  }

  // Kul wapsi kabhi asal wasool shuda raqam se zyada nahi
  const alreadyRefunded = data.items.reduce((n, i) => n + (i.refunded_paisa || 0), 0);
  const maxRefundPaisa = Math.max(0, data.sale.total_paisa - alreadyRefunded);

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    lines: out,
    maxRefundPaisa,
  };
}

export function returnSaleItems(
  saleId: number,
  lines: { saleItemId: number; qtyBase: number; restock?: boolean }[],
  reason: string | null,
  user?: U
) {
  const data = saleWithReturns(saleId);
  if (!data) throw new Error("Sale not found");
  if (data.sale.status === "void") throw new Error("This sale is already void.");
  const wanted = lines.filter((l) => Number(l.qtyBase) > 0);
  if (!wanted.length) throw new Error("Enter a return quantity for at least one item.");

  // Spec 3: asal bill ke khilaf sakht jaanch (item isi bill ka hai? hadd? mohelat?)
  const check = validateReturn(saleId, wanted, { invoiceCode: data.sale.code });
  if (!check.ok) throw new Error(check.errors.join(" | "));

  let quarantinedForRole = false;
  const beforeSnapshot = {
    code: data.sale.code,
    status: data.sale.status,
    total_paisa: data.sale.total_paisa,
    due_paisa: data.sale.due_paisa,
    refunded_so_far: data.items.reduce((n, i) => n + (i.refunded_paisa || 0), 0),
  };
  return tx(() => {
    // U-35: poori wapsi ka EK hi pakka number (har line par wahi code)
    const returnCode = takeNextCode("return");
    let refundTotal = 0;
    for (const l of wanted) {
      const it = data.items.find((x) => x.id === l.saleItemId);
      if (!it) throw new Error("Item does not belong to this sale.");
      const qty = Number(l.qtyBase);
      if (qty + it.returned_qty > it.qty_base + 1e-9)
        throw new Error(`${it.name}: only ${it.qty_base - it.returned_qty} left to return.`);

      // asal wasool shuda raqam ka hissa
      const share = data.sale.subtotal_paisa > 0 ? it.line_total_paisa / data.sale.subtotal_paisa : 0;
      let refund = Math.floor(data.sale.total_paisa * share * (qty / it.qty_base));
      // aakhri hissa: baqi paisa bhi de do (rounding ka nuqsan na ho)
      const lastPart = Math.abs(qty + it.returned_qty - it.qty_base) < 1e-9;
      if (lastPart) refund = Math.max(refund, Math.floor(data.sale.total_paisa * share) - it.refunded_paisa);
      refund = Math.max(0, refund);

      // ---------------- MALIK KA HUKUM (6-Oct-2026) ----------------
      // "jaisay hi paisay niklen ge, stock add ho jaye ga" -- yani wapsi ke
      // sath hi maal wapas shelf (stock) par. Damaged maal hum late hi nahi,
      // is liye quarantine ki zaroorat nahi.
      //   * default = restock (stock me wapas)
      //   * restock:false sirf khaas surat me (tab bhi quarantine list me
      //     nazar aata rahe ga, ghaib nahi hoga)
      const restock = l.restock !== false && !!it.batch_id && canRestock(user);
      const toQuarantine = !restock && !!it.batch_id;
      if (l.restock === false && it.batch_id) quarantinedForRole = true;
      // U-34: quarantine me jane wale har item ko ek MUSTAQIL number (Q-0001 …)
      const qcode = toQuarantine ? takeNextCode("quarantine") : null;
      run(`INSERT INTO sale_returns
             (sale_id, sale_item_id, product_id, batch_id, qty_base, refund_paisa, restock, reason, user_id, code,
              qcode, disposition)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [saleId, it.id, it.product_id, it.batch_id, qty, refund, restock ? 1 : 0, reason?.trim() || null,
         user?.id ?? null, returnCode, qcode, restock ? "restocked" : "quarantine"]);
      if (restock) run("UPDATE batches SET qty_base = qty_base + ? WHERE id = ?", [qty, it.batch_id]);
      run(`INSERT INTO stock_movements (product_id, batch_id, type, qty_base, ref_type, ref_id, ref_code, note, user_id)
           VALUES (?,?,?,?,?,?,?,?,?)`,
        [it.product_id, it.batch_id, "return_in", restock ? qty : 0, "return", saleId, data.sale.code,
         restock ? "Return restocked" : `Return QUARANTINED (${qty} units not added to stock)`, user?.id ?? null]);
      refundTotal += refund;
    }

    // Spec 3: kul wapsi kabhi asal wasool shuda raqam se zyada nahi
    const maxRefund = Math.max(0, data.sale.total_paisa - beforeSnapshot.refunded_so_far);
    if (refundTotal > maxRefund + 100) {
      // chhota farq (rounding) bardasht, bara nahi
      throw new Error(
        `Wapsi ${(refundTotal / 100).toFixed(0)} Rs ho rahi hai jabke is bill par abhi zyada se zyada ` +
          `${(maxRefund / 100).toFixed(0)} Rs wapas ho sakte hain.`
      );
    }

    // Pehle udhaar kaato, baqi cash wapas
    let cashBack = refundTotal;
    if (data.sale.customer_id && data.sale.due_paisa > 0) {
      const off = Math.min(data.sale.due_paisa, refundTotal);
      run("UPDATE sales SET due_paisa = due_paisa - ? WHERE id = ?", [off, saleId]);
      run("UPDATE customers SET balance_paisa = balance_paisa - ? WHERE id = ?", [off, data.sale.customer_id]);
      cashBack -= off;
    }
    if (cashBack > 0) {
      run(`INSERT INTO payments (method, amount_paisa, sale_id, customer_id, user_id, note) VALUES ('cash', ?, ?, ?, ?, ?)`,
        [-cashBack, saleId, data.sale.customer_id, user?.id ?? null, `Refund ${data.sale.code}`]);
    }
    const afterSale = get<{ due_paisa: number; status: string }>(
      "SELECT due_paisa, status FROM sales WHERE id = ?", [saleId]);
    void audit({
      action: "return",
      userId: user?.id ?? null,
      userName: user?.name ?? null,
      entity: "Sale",
      entityId: saleId,
      module: "Returns",
      before: beforeSnapshot,
      after: {
        code: data.sale.code,
        status: afterSale?.status ?? data.sale.status,
        total_paisa: data.sale.total_paisa,
        due_paisa: afterSale?.due_paisa ?? data.sale.due_paisa,
        refunded_so_far: beforeSnapshot.refunded_so_far + refundTotal,
        refund_this_time: refundTotal,
        cash_back: cashBack,
        items: wanted.map((l) => ({ saleItemId: l.saleItemId, qtyBase: l.qtyBase })),
        reason: reason?.trim() || null,
        restockBlocked: quarantinedForRole,
        return_code: returnCode,
      },
      details: { refundTotal, cashBack, reason, restockBlocked: quarantinedForRole, returnCode },
    });
    return {
      // U-35: wapsi ka pakka number (receipt isi se chhapti hai)
      code: returnCode,
      refundPaisa: refundTotal,
      cashBackPaisa: cashBack,
      creditReducedPaisa: refundTotal - cashBack,
      // cashier ne restock maanga tha to app ne QUARANTINE hi rakha
      restockBlocked: quarantinedForRole,
    };
  });
}

/** Poora bill cancel (sirf jis par koi return nahi hua) */
export function voidSale(saleId: number, reason: string | null, user?: U) {
  const data = saleWithReturns(saleId);
  if (!data) throw new Error("Sale not found");
  if (data.sale.status === "void") throw new Error("Already void.");
  if (data.items.some((i) => i.returned_qty > 0)) throw new Error("This bill already has returns - use Return instead of Void.");

  return tx(() => {
    for (const it of data.items) {
      if (it.batch_id) run("UPDATE batches SET qty_base = qty_base + ? WHERE id = ?", [it.qty_base, it.batch_id]);
      run(`INSERT INTO stock_movements (product_id, batch_id, type, qty_base, ref_type, ref_id, ref_code, note, user_id)
           VALUES (?,?,?,?,?,?,?,?,?)`,
        [it.product_id, it.batch_id, "return_in", it.qty_base, "void", saleId, data.sale.code, "Bill void - stock restored", user?.id ?? null]);
    }
    if (data.sale.customer_id && data.sale.due_paisa > 0)
      run("UPDATE customers SET balance_paisa = balance_paisa - ? WHERE id = ?", [data.sale.due_paisa, data.sale.customer_id]);
    const received = get<{ s: number }>("SELECT COALESCE(SUM(amount_paisa),0) AS s FROM payments WHERE sale_id = ?", [saleId])?.s ?? 0;
    if (received > 0)
      run(`INSERT INTO payments (method, amount_paisa, sale_id, customer_id, user_id, note) VALUES ('cash', ?, ?, ?, ?, ?)`,
        [-received, saleId, data.sale.customer_id, user?.id ?? null, `Void refund ${data.sale.code}`]);
    run("UPDATE sales SET status = 'void', due_paisa = 0, notes = COALESCE(notes,'') || ? WHERE id = ?",
      [` [VOID: ${reason?.trim() || "no reason"}]`, saleId]);
    void audit({ action: "void", userId: user?.id ?? null, userName: user?.name ?? null, entity: "Sale", entityId: saleId,
      details: { code: data.sale.code, reason, refunded: received } });
    return { refundedPaisa: received };
  });
}

// ---------------------------------------------------------------------------
// Spec 3.3 + 1.3: QUARANTINE (maal wapas aya magar shelf par nahi)
// ---------------------------------------------------------------------------
// Wapsi ke waqt maal QUARANTINE me jata hai (janch tak stock me nahi).
// Pehle ye maal kahin nazar nahi aata tha -- ab yahan se dekha aur
// janch ke baad ek click se shelf par dala ja sakta hai.
// ---------------------------------------------------------------------------
export type QuarantineRow = {
  id: number; date: string; product_id: number; name: string;
  batch_id: number | null; batch_no: string | null; base_unit: string;
  qty_base: number; refund_paisa: number; reason: string | null;
  sale_code: string | null; customer_name: string | null; user_name: string | null;
  /** U-34: har item ka MUSTAQIL quarantine number (Q-0001 …) */
  qcode: string | null;
  /** kahan gaya: quarantine | restocked | expired | sold */
  disposition: string;
  disposed_at: string | null;
  disposed_note: string | null;
  return_code: string | null;
};

export function quarantineRows(): QuarantineRow[] {
  return query<QuarantineRow>(
    `SELECT r.id, r.date, r.product_id, p.name, r.batch_id, b.batch_no, p.base_unit,
            r.qty_base, r.refund_paisa, r.reason, s.code AS sale_code,
            c.name AS customer_name, u.name AS user_name,
            r.qcode, r.disposition, r.disposed_at, r.disposed_note, r.code AS return_code
       FROM sale_returns r
       JOIN products p  ON p.id = r.product_id
       LEFT JOIN batches b   ON b.id = r.batch_id
       LEFT JOIN sales s     ON s.id = r.sale_id
       LEFT JOIN customers c ON c.id = s.customer_id
       LEFT JOIN users u     ON u.id = r.user_id
      WHERE r.disposition = 'quarantine' AND r.qty_base > 0
      ORDER BY r.id DESC
      LIMIT 200`
  );
}

/** Janch ke baad maal wapas shelf (stock) me -- sirf owner/manager */
export function releaseFromQuarantine(
  returnId: number,
  user?: U
): { qtyBase: number; batchId: number | null; productName: string } {
  if (!canRestock(user)) {
    const err = new Error("Maal stock me wapas dalne ka ikhtiyar sirf owner/manager ke paas hai.");
    (err as Error & { status?: number }).status = 403;
    throw err;
  }
  const row = get<{
    id: number; product_id: number; batch_id: number | null; qty_base: number;
    restock: number; name: string; sale_id: number; code: string | null;
  }>(
    `SELECT r.id, r.product_id, r.batch_id, r.qty_base, r.restock, p.name,
            r.sale_id, s.code
       FROM sale_returns r
       JOIN products p ON p.id = r.product_id
       LEFT JOIN sales s ON s.id = r.sale_id
      WHERE r.id = ?`,
    [returnId]
  );
  if (!row) throw new Error("Ye wapsi record nahi mila.");
  if (row.restock) throw new Error("Ye maal pehle hi stock me wapas ja chuka hai.");
  if (!row.batch_id) throw new Error("Is wapsi ke sath koi batch jurra hi nahi — /stock se seedha adjust karein.");

  return tx(() => {
    const beforeQty =
      scalar<number>("SELECT qty_base FROM batches WHERE id = ?", [row.batch_id]) ?? 0;
    run("UPDATE batches SET qty_base = qty_base + ? WHERE id = ?", [row.qty_base, row.batch_id]);
    const afterQty =
      scalar<number>("SELECT qty_base FROM batches WHERE id = ?", [row.batch_id]) ?? 0;
    run("UPDATE sale_returns SET restock = 1, disposition = 'restocked', disposed_at = datetime('now','localtime'), disposed_by = ? WHERE id = ?",
        [user?.id ?? null, returnId]);
    run(
      `INSERT INTO stock_movements (product_id, batch_id, type, qty_base, ref_type, ref_id, ref_code, note, user_id)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [row.product_id, row.batch_id, "return_in", row.qty_base, "return", row.sale_id,
       row.code ?? null, "Quarantine se janch ke baad shelf par", user?.id ?? null]
    );
    void audit({
      action: "update",
      userId: user?.id ?? null,
      userName: user?.name ?? null,
      entity: "SaleReturn",
      entityId: returnId,
      module: "Returns",
      before: { product: row.name, batch_id: row.batch_id, restock: 0, qty_base: beforeQty },
      after: { product: row.name, batch_id: row.batch_id, restock: 1, qty_base: afterQty },
      details: { released: row.qty_base, sale: row.code },
    });
    return { qtyBase: row.qty_base, batchId: row.batch_id, productName: row.name };
  });
}

// ---------------------------------------------------------------------------
// U-35: WAPSI KI RASEED (return receipt)
// ---------------------------------------------------------------------------
// Malik ka hukum: har wapsi ki chhapne wali raseed ho, jis par wapsi ka
// MUSTAQIL number (RET-0001) ho. Yahi number history me bhi nazar aata hai.
// ---------------------------------------------------------------------------
export type ReturnReceipt = {
  code: string;
  date: string;
  saleCode: string | null;
  customerName: string | null;
  customerPhone: string | null;
  userName: string | null;
  reason: string | null;
  totalRefundPaisa: number;
  items: {
    id: number;
    name: string;
    qtyBase: number;
    baseUnit: string;
    batchNo: string | null;
    refundPaisa: number;
    restock: number;
    /** U-34: quarantine ka mustaqil number (Q-0001) — agar maal quarantine me gaya */
    qcode: string | null;
  }[];
};

/** RET-0001 (ya jo bhi code ho) ki poori raseed */
export function getReturnReceipt(code: string): ReturnReceipt | null {
  const rows = query<{
    id: number; date: string; code: string | null; reason: string | null;
    qty_base: number; refund_paisa: number; restock: number; qcode: string | null;
    name: string; base_unit: string; batch_no: string | null;
    sale_code: string | null; customer_name: string | null;
    customer_phone: string | null; user_name: string | null;
  }>(
    `SELECT r.id, r.date, r.code, r.reason, r.qty_base, r.refund_paisa, r.restock,
            p.name, p.base_unit, b.batch_no, r.qcode,
            s.code AS sale_code, c.name AS customer_name, c.phone AS customer_phone,
            u.name AS user_name
       FROM sale_returns r
       JOIN products p ON p.id = r.product_id
       LEFT JOIN batches b ON b.id = r.batch_id
       LEFT JOIN sales s ON s.id = r.sale_id
       LEFT JOIN customers c ON c.id = s.customer_id
       LEFT JOIN users u ON u.id = r.user_id
      WHERE r.code = ?
      ORDER BY r.id`,
    [code]
  );
  if (!rows.length) return null;
  const f = rows[0];
  return {
    code: f.code ?? code,
    date: f.date,
    saleCode: f.sale_code,
    customerName: f.customer_name,
    customerPhone: f.customer_phone,
    userName: f.user_name,
    reason: f.reason,
    totalRefundPaisa: rows.reduce((n, r) => n + (r.refund_paisa || 0), 0),
    items: rows.map((r) => ({
      id: r.id,
      name: r.name,
      qtyBase: r.qty_base,
      baseUnit: r.base_unit,
      batchNo: r.batch_no,
      refundPaisa: r.refund_paisa,
      restock: r.restock,
      qcode: r.qcode ?? null,
    })),
  };
}

/** Is bill par abhi tak kitni wapsiyan hui hain (raseed ke link ke liye) */
export function returnsForSale(saleId: number): { code: string; date: string; refundPaisa: number; items: number }[] {
  return query<{ code: string; date: string; refundPaisa: number; items: number }>(
    `SELECT r.code AS code, MIN(r.date) AS date,
            SUM(r.refund_paisa) AS refundPaisa, COUNT(*) AS items
       FROM sale_returns r
      WHERE r.sale_id = ? AND r.code IS NOT NULL
      GROUP BY r.code
      ORDER BY MIN(r.id) DESC`,
    [saleId]
  );
}

// ---------------------------------------------------------------------------
// U-34: QUARANTINE ka POORA PATA -- "kaun sa saman kidhar gaya"
// ---------------------------------------------------------------------------
// Malik ka hukum: quarantine me maujood har saman ka ek MUSTAQIL number ho
// (Q-0001) aur history me saaf nazar aaye ke woh aakhir gaya kahan:
//   stock me wapas  |  expiry / kharaab (write-off)  |  bech diya gaya
// ---------------------------------------------------------------------------
export type QuarantineDisposition = "restocked" | "expired" | "sold";

const DISPOSITION_LABEL: Record<QuarantineDisposition, string> = {
  restocked: "اسٹاک (شیلف) میں واپس",
  expired: "ایکسپائری / خراب (write-off)",
  sold: "فروخت کر دیا گیا",
};

export function dispositionLabel(d: string): string {
  return DISPOSITION_LABEL[d as QuarantineDisposition] ?? d;
}

function quarantineRowOf(id: number) {
  return get<{
    id: number; product_id: number; batch_id: number | null; qty_base: number;
    restock: number; name: string; sale_id: number; code: string | null;
    qcode: string | null; disposition: string;
  }>(
    `SELECT r.id, r.product_id, r.batch_id, r.qty_base, r.restock, p.name,
            r.sale_id, s.code, r.qcode, r.disposition
       FROM sale_returns r
       JOIN products p ON p.id = r.product_id
       LEFT JOIN sales s ON s.id = r.sale_id
      WHERE r.id = ?`,
    [id]
  );
}

/**
 * Quarantine ke saman ka faisla: stock me wapas / expiry-kharaab / bech diya.
 * Q number (Q-0001) hamesha wahi rehta hai -- sirf 'disposition' badalta hai,
 * taake history me poora safar nazar aaye.
 */
export function decideQuarantine(
  id: number,
  disposition: QuarantineDisposition,
  note: string | null,
  user?: U
): { qcode: string | null; productName: string; disposition: string } {
  if (!canRestock(user)) {
    const err = new Error("Quarantine ka faisla sirf owner/manager kar sakte hain.");
    (err as Error & { status?: number }).status = 403;
    throw err;
  }
  const row = quarantineRowOf(id);
  if (!row) throw new Error("Ye wapsi record nahi mila.");
  if (row.disposition !== "quarantine")
    throw new Error(`Ye maal pehle hi ${dispositionLabel(row.disposition)} me ja chuka hai.`);

  return tx(() => {
    if (disposition === "restocked") {
      if (!row.batch_id) throw new Error("Is wapsi ke sath koi batch jurra hi nahi — /stock se seedha adjust karein.");
      const beforeQty = scalar<number>("SELECT qty_base FROM batches WHERE id = ?", [row.batch_id]) ?? 0;
      run("UPDATE batches SET qty_base = qty_base + ? WHERE id = ?", [row.qty_base, row.batch_id]);
      const afterQty = scalar<number>("SELECT qty_base FROM batches WHERE id = ?", [row.batch_id]) ?? 0;
      run(
        `INSERT INTO stock_movements (product_id, batch_id, type, qty_base, ref_type, ref_id, ref_code, note, user_id)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [row.product_id, row.batch_id, "return_in", row.qty_base, "return", row.sale_id, row.code ?? null,
         `Quarantine ${row.qcode ?? ""} se stock me wapas`, user?.id ?? null]
      );
      run(
        `UPDATE sale_returns SET restock = 1, disposition = 'restocked',
                disposed_at = datetime('now','localtime'), disposed_by = ?, disposed_note = ?
          WHERE id = ?`,
        [user?.id ?? null, note?.trim() || null, id]
      );
      void audit({
        action: "update",
        userId: user?.id ?? null,
        userName: user?.name ?? null,
        entity: "Quarantine",
        entityId: id,
        module: "Returns",
        before: { qcode: row.qcode, product: row.name, disposition: "quarantine", qty_base: beforeQty },
        after: { qcode: row.qcode, product: row.name, disposition: "restocked", qty_base: afterQty, note },
        details: { qcode: row.qcode, note },
      });
      return { qcode: row.qcode, productName: row.name, disposition: "restocked" };
    }

    // expired (kharaab / write-off) ya sold -- dono me maal stock me wapas NAHI aata
    run(
      `UPDATE sale_returns SET restock = 0, disposition = ?,
              disposed_at = datetime('now','localtime'), disposed_by = ?, disposed_note = ?
        WHERE id = ?`,
      [disposition, user?.id ?? null, note?.trim() || null, id]
    );
    run(
      `INSERT INTO stock_movements (product_id, batch_id, type, qty_base, ref_type, ref_id, ref_code, note, user_id)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [row.product_id, row.batch_id, disposition === "expired" ? "write_off" : "sale", 0,
       "quarantine", id, row.qcode ?? null,
       `Quarantine ${row.qcode ?? ""}: ${dispositionLabel(disposition)}${note ? " — " + note : ""}`,
       user?.id ?? null]
    );
    void audit({
      action: "update",
      userId: user?.id ?? null,
      userName: user?.name ?? null,
      entity: "Quarantine",
      entityId: id,
      module: "Returns",
      before: { qcode: row.qcode, product: row.name, disposition: "quarantine" },
      after: { qcode: row.qcode, product: row.name, disposition, note },
      details: { qcode: row.qcode, note },
    });
    return { qcode: row.qcode, productName: row.name, disposition };
  });
}

/** U-34: POORI history -- har Q number kahan gaya (quarantine / stock / expiry / sold) */
export function quarantineHistory(limit = 300): QuarantineRow[] {
  return query<QuarantineRow>(
    `SELECT r.id, r.date, r.product_id, p.name, r.batch_id, b.batch_no, p.base_unit,
            r.qty_base, r.refund_paisa, r.reason, s.code AS sale_code,
            c.name AS customer_name, u.name AS user_name,
            r.qcode, r.disposition, r.disposed_at, r.disposed_note, r.code AS return_code
       FROM sale_returns r
       JOIN products p  ON p.id = r.product_id
       LEFT JOIN batches b   ON b.id = r.batch_id
       LEFT JOIN sales s     ON s.id = r.sale_id
       LEFT JOIN customers c ON c.id = s.customer_id
       LEFT JOIN users u     ON u.id = r.user_id
      WHERE r.qcode IS NOT NULL
      ORDER BY r.id DESC
      LIMIT ?`,
    [Math.min(limit, 1000)]
  );
}
