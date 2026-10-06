// ---------------------------------------------------------------------------
// Area11 - Sale returns & void (Phase 2)
// Rules (user ke tasdeeq shuda usool, legacy demo se):
//  * Refund = ASAL wasool shuda raqam ka hissa (discount/round-off ke baad), aaj ka rate nahi.
//  * Cumulative return kabhi sold qty se zyada nahi.
//  * Default = QUARANTINE (stock me wapas nahi). restock=true sirf janch ke baad.
//  * Asal sale_items kabhi edit nahi hoti; return alag table me.
// ---------------------------------------------------------------------------
import { get, query, run, tx, scalar } from "./db";
import { audit } from "./audit";
import { getSyncSettings } from "./settings-sync";

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

      const restock = !!l.restock && !!it.batch_id && canRestock(user);
      if (l.restock && !restock && it.batch_id) quarantinedForRole = true;
      run(`INSERT INTO sale_returns (sale_id, sale_item_id, product_id, batch_id, qty_base, refund_paisa, restock, reason, user_id)
           VALUES (?,?,?,?,?,?,?,?,?)`,
        [saleId, it.id, it.product_id, it.batch_id, qty, refund, restock ? 1 : 0, reason?.trim() || null, user?.id ?? null]);
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
      },
      details: { refundTotal, cashBack, reason, restockBlocked: quarantinedForRole },
    });
    return {
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
