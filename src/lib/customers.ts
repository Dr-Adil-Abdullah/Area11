// ---------------------------------------------------------------------------
// Area11 - Customers (minimal for now; full profiles arrive in Phase 4)
// ---------------------------------------------------------------------------

import { get, query, run } from "./db";

export type Customer = {
  id: number;
  name: string;
  phone: string | null;
  category: string; // normal | vip | doctor
  credit_limit_paisa: number;
  balance_paisa: number;
  loyalty_points: number;
  stars: number;
  notes: string | null;
  active: number;
  created_at: string;
};

export function listCustomers(search = ""): Customer[] {
  const like = `%${search.trim()}%`;
  return query<Customer>(
    `SELECT * FROM customers
      WHERE active = 1 AND (name LIKE ? OR phone LIKE ?)
      ORDER BY name COLLATE NOCASE
      LIMIT 200`,
    [like, like]
  );
}

export function findCustomers(phone: string): Customer[] {
  const p = phone.trim();
  if (!p) return [];
  return query<Customer>(
    `SELECT * FROM customers WHERE active = 1 AND phone LIKE ? ORDER BY id DESC LIMIT 20`,
    [`%${p}%`]
  );
}

export function getCustomer(id: number): Customer | undefined {
  return get<Customer>("SELECT * FROM customers WHERE id = ?", [id]);
}

export function createCustomer(input: {
  name: string;
  phone?: string | null;
  category?: string;
  creditLimitPaisa?: number;
}): number {
  const name = input.name.trim();
  if (!name) throw new Error("Customer name is required");

  // Same phone ho to wohi wapas do (duplicate se bachao)
  if (input.phone?.trim()) {
    const existing = get<{ id: number }>(
      "SELECT id FROM customers WHERE phone = ? AND active = 1 LIMIT 1",
      [input.phone.trim()]
    );
    if (existing) return existing.id;
  }

  const res = run(
    `INSERT INTO customers (name, phone, category, credit_limit_paisa)
     VALUES (?,?,?,?)`,
    [
      name,
      input.phone?.trim() || null,
      input.category || "normal",
      Math.max(0, Math.round(input.creditLimitPaisa ?? 0)),
    ]
  );
  return res.lastInsertRowid;
}

export function updateCustomer(
  id: number,
  input: {
    name?: string;
    phone?: string | null;
    category?: string;
    creditLimitPaisa?: number;
    notes?: string | null;
  }
): void {
  const before = getCustomer(id);
  if (!before) throw new Error("Customer not found");
  run(
    `UPDATE customers SET name = ?, phone = ?, category = ?, credit_limit_paisa = ?, notes = ?
      WHERE id = ?`,
    [
      (input.name ?? before.name).trim(),
      input.phone === undefined ? before.phone : input.phone?.trim() || null,
      input.category ?? before.category,
      Math.round(input.creditLimitPaisa ?? before.credit_limit_paisa),
      input.notes === undefined ? before.notes : input.notes?.trim() || null,
      id,
    ]
  );
}

/** Customer ko udhaar/wasooli ka record */
export function customerLedger(customerId: number) {
  const sales = query<{
    id: number;
    code: string;
    date: string;
    total_paisa: number;
    paid_paisa: number;
    due_paisa: number;
    status: string;
  }>(
    `SELECT id, code, date, total_paisa, paid_paisa, due_paisa, status
       FROM sales WHERE customer_id = ? ORDER BY id DESC LIMIT 100`,
    [customerId]
  );
  const payments = query<{ id: number; date: string; amount_paisa: number; method: string; note: string | null }>(
    `SELECT id, date, amount_paisa, method, note FROM payments
      WHERE customer_id = ? ORDER BY id DESC LIMIT 100`,
    [customerId]
  );
  return { sales, payments };
}

export function customerCount(): number {
  return get<{ c: number }>("SELECT COUNT(*) AS c FROM customers WHERE active = 1")?.c ?? 0;
}
