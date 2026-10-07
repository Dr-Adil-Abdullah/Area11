// ---------------------------------------------------------------------------
// Area11 - Cash book: day summary, customer collections, supplier payments,
// expenses, owner drawings. (Phase 2 ka zaroori hissa)
// payments table ka usool: purchase_id/supplier_id wali row = paisa BAHAR,
// baaqi (sale/customer) = paisa ANDAR (refund = manfi raqam).
// ---------------------------------------------------------------------------
import { get, query, run, tx } from "./db";
import { netProfitPaisa } from "./report-math";
import { audit } from "./audit";

type U = { id?: number; name?: string } | null | undefined;
const today = () => get<{ d: string }>("SELECT date('now','localtime') AS d")!.d;

export function daySummary(day?: string) {
  const d = day || today();
  const n = (sql: string) => get<{ v: number }>(sql, [d])?.v ?? 0;
  const salesTotal = n("SELECT COALESCE(SUM(total_paisa),0) v FROM sales WHERE date(date)=? AND status<>'void'");
  const bills = n("SELECT COUNT(*) v FROM sales WHERE date(date)=? AND status<>'void'");
  const voided = n("SELECT COUNT(*) v FROM sales WHERE date(date)=? AND status='void'");
  const creditGiven = n("SELECT COALESCE(SUM(due_paisa),0) v FROM sales WHERE date(date)=? AND status<>'void'");
  const returnsTotal = n("SELECT COALESCE(SUM(refund_paisa),0) v FROM sale_returns WHERE date(date)=?");
  const profit = n(`SELECT COALESCE(SUM(i.line_total_paisa - i.qty_base*i.cost_paisa_at_sale),0) v
                      FROM sale_items i JOIN sales s ON s.id=i.sale_id WHERE date(s.date)=? AND s.status<>'void'`);
  // Review (U-36): wapsi ka maal jab shelf/stock me wapas aata hai (restock = 1)
  // to us ki laagat munafay me wapas aani chahiye -- warna munafa kam dikhta hai.
  const returnedCost = n(
    `SELECT COALESCE(SUM(r.qty_base * si.cost_paisa_at_sale),0) v
       FROM sale_returns r JOIN sale_items si ON si.id = r.sale_item_id
      WHERE date(r.date)=? AND r.restock = 1`
  );
  const cashIn = n("SELECT COALESCE(SUM(amount_paisa),0) v FROM payments WHERE method='cash' AND purchase_id IS NULL AND supplier_id IS NULL AND amount_paisa>0 AND date(date)=?");
  const cashRefunds = -n("SELECT COALESCE(SUM(amount_paisa),0) v FROM payments WHERE method='cash' AND purchase_id IS NULL AND supplier_id IS NULL AND amount_paisa<0 AND date(date)=?");
  const supplierPaid = n("SELECT COALESCE(SUM(amount_paisa),0) v FROM payments WHERE method='cash' AND (purchase_id IS NOT NULL OR supplier_id IS NOT NULL) AND date(date)=?");
  const expenses = n("SELECT COALESCE(SUM(amount_paisa),0) v FROM expenses WHERE date(date)=?");
  const drawings = n("SELECT COALESCE(SUM(amount_paisa),0) v FROM owner_drawings WHERE type='cash' AND date(date)=?");
  const expectedCash = cashIn - cashRefunds - supplierPaid - expenses - drawings;
  return { day: d, bills, voided, salesTotal, creditGiven, returnsTotal,
           profit: netProfitPaisa({ salesPaisa: salesTotal, refundPaisa: returnsTotal, costPaisa: salesTotal - profit, returnedCostPaisa: returnedCost }),
           /** waqai stock me wapas aaye maal ki laagat (tafail ke liye) */
           returnedCostPaisa: returnedCost,
           cashIn, cashRefunds, supplierPaid, expenses, drawings, expectedCash };
}

export function receiveCustomerPayment(customerId: number, amountPaisa: number, method: string, note: string | null, user?: U) {
  const amt = Math.round(amountPaisa);
  if (!(amt > 0)) throw new Error("Enter an amount greater than zero.");
  return tx(() => {
    const c = get<{ id: number; name: string; balance_paisa: number }>("SELECT id, name, balance_paisa FROM customers WHERE id = ?", [customerId]);
    if (!c) throw new Error("Customer not found");
    if (amt > c.balance_paisa) throw new Error(`${c.name} owes only Rs ${(c.balance_paisa / 100).toFixed(2)}.`);
    // purane bill pehle
    let left = amt;
    for (const s of query<{ id: number; due_paisa: number }>(
      "SELECT id, due_paisa FROM sales WHERE customer_id=? AND due_paisa>0 AND status<>'void' ORDER BY id", [customerId])) {
      if (left <= 0) break;
      const take = Math.min(left, s.due_paisa);
      run(`UPDATE sales SET paid_paisa = paid_paisa + ?, due_paisa = due_paisa - ?,
             status = CASE WHEN due_paisa - ? <= 0 THEN 'paid' ELSE 'partial' END WHERE id = ?`, [take, take, take, s.id]);
      left -= take;
    }
    run("UPDATE customers SET balance_paisa = balance_paisa - ? WHERE id = ?", [amt, customerId]);
    run(`INSERT INTO payments (method, amount_paisa, customer_id, user_id, note) VALUES (?,?,?,?,?)`,
      [method || "cash", amt, customerId, user?.id ?? null, note?.trim() || "Udhaar wasooli"]);
    void audit({
      action: "update",
      userId: user?.id ?? null,
      userName: user?.name ?? null,
      entity: "CustomerPayment",
      entityId: customerId,
      module: "Customers",
      before: { customer: c.name, balance_paisa: c.balance_paisa },
      after: { customer: c.name, balance_paisa: c.balance_paisa - amt, received: amt, method: method || "cash" },
      details: { amount: amt, note },
    });
    return { balancePaisa: c.balance_paisa - amt };
  });
}

export function paySupplier(supplierId: number, amountPaisa: number, note: string | null, user?: U) {
  const amt = Math.round(amountPaisa);
  if (!(amt > 0)) throw new Error("Enter an amount greater than zero.");
  return tx(() => {
    const s = get<{ id: number; balance_paisa: number }>("SELECT id, balance_paisa FROM suppliers WHERE id = ?", [supplierId]);
    if (!s) throw new Error("Supplier not found");
    run("UPDATE suppliers SET balance_paisa = balance_paisa - ? WHERE id = ?", [amt, supplierId]);
    run(`INSERT INTO payments (method, amount_paisa, supplier_id, user_id, note) VALUES ('cash', ?, ?, ?, ?)`,
      [amt, supplierId, user?.id ?? null, note?.trim() || "Supplier payment"]);
    void audit({
      action: "update",
      userId: user?.id ?? null,
      userName: user?.name ?? null,
      entity: "SupplierPayment",
      entityId: supplierId,
      module: "Suppliers",
      before: { supplier_id: supplierId, balance_paisa: s.balance_paisa },
      after: { supplier_id: supplierId, balance_paisa: s.balance_paisa - amt, paid: amt },
      details: { amount: amt, note },
    });
    return { balancePaisa: s.balance_paisa - amt };
  });
}

export function addExpense(category: string, title: string, amountPaisa: number, note: string | null, user?: U) {
  const amt = Math.round(amountPaisa);
  if (!title.trim()) throw new Error("Expense title is required.");
  if (!(amt > 0)) throw new Error("Enter an amount greater than zero.");
  const id = run("INSERT INTO expenses (category, title, amount_paisa, note, user_id) VALUES (?,?,?,?,?)",
    [category || "other", title.trim(), amt, note?.trim() || null, user?.id ?? null]).lastInsertRowid;
  void audit({ action: "create", userId: user?.id ?? null, userName: user?.name ?? null, entity: "Expense", entityId: id,
    module: "Customers", before: null, after: { title, amount_paisa: amt }, details: { title, amt } });
  return id;
}

export function addDrawing(type: "cash" | "goods", amountPaisa: number, note: string | null, user?: U) {
  const amt = Math.round(amountPaisa);
  if (!(amt > 0)) throw new Error("Enter an amount greater than zero.");
  const id = run("INSERT INTO owner_drawings (type, amount_paisa, note, user_id) VALUES (?,?,?,?)",
    [type, amt, note?.trim() || null, user?.id ?? null]).lastInsertRowid;
  void audit({ action: "create", userId: user?.id ?? null, userName: user?.name ?? null, entity: "OwnerDrawing", entityId: id,
    module: "Customers", before: null, after: { type, amount_paisa: amt }, details: { type, amt } });
  return id;
}

export const recentExpenses = () => query<{ id: number; date: string; category: string; title: string; amount_paisa: number }>(
  "SELECT id, date, category, title, amount_paisa FROM expenses ORDER BY id DESC LIMIT 15");
export const recentDrawings = () => query<{ id: number; date: string; type: string; amount_paisa: number; note: string | null }>(
  "SELECT id, date, type, amount_paisa, note FROM owner_drawings ORDER BY id DESC LIMIT 15");
