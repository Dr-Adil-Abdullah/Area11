// ---------------------------------------------------------------------------
// Area11 - Catalog: products, categories, suppliers, companies
// ---------------------------------------------------------------------------

import { get, query, run, scalar } from "./db";
import { toBaseUnits } from "./money";
import { audit } from "./audit";

// ---------------------------- Types ----------------------------------------
export type Product = {
  id: number;
  name: string;
  generic: string | null;
  brand: string | null;
  barcode: string | null;
  company_id: number | null;
  category_id: number | null;
  rack_no: string | null;
  room: string | null;
  photo: string | null;
  pack_size_label: string | null;
  base_unit: string;
  box_strips: number;
  strip_tablets: number;
  cost_paisa: number;
  retail_paisa: number;
  vip_paisa: number;
  doctor_paisa: number;
  reorder_level: number;
  track_expiry: number;
  active: number;
  created_at: string;
  updated_at: string;
  // joined (optional)
  category_name?: string | null;
  company_name?: string | null;
  stock_base?: number;
  nearest_expiry?: string | null;
};

export type Supplier = {
  id: number;
  name: string;
  agency: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  active: number;
  balance_paisa: number;
  created_at: string;
};

export type Category = {
  id: number;
  name: string;
  parent_id: number | null;
  sort_order: number;
  active: number;
  product_count?: number;
};

// ---------------------------- Products -------------------------------------
export type ProductFilter = {
  search?: string;
  categoryId?: number | null;
  companyId?: number | null;
  room?: string | null;              // kis kamre / rack me hai
  /** "low" = reorder level se kam  · "out" = bilkul khatam  · "expiring" = jaldi expire */
  stock?: "all" | "low" | "out" | "expiring";
  sort?: "name" | "stock" | "expiry" | "margin" | "sold" | "newest";
  limit?: number;
  offset?: number;
  onlyActive?: boolean;
};

const SORT_SQL: Record<NonNullable<ProductFilter["sort"]>, string> = {
  name: "p.name COLLATE NOCASE",
  stock: "stock_base ASC, p.name COLLATE NOCASE",
  expiry: "(nearest_expiry IS NULL), nearest_expiry ASC, p.name COLLATE NOCASE",
  margin: "(p.retail_paisa - p.cost_paisa) DESC, p.name COLLATE NOCASE",
  sold: "sold_qty DESC, p.name COLLATE NOCASE",
  newest: "p.id DESC",
};

export function listProducts(opts: ProductFilter = {}): { rows: Product[]; total: number } {
  const where: string[] = [];
  const params: (string | number)[] = [];

  if (opts.onlyActive !== false) where.push("p.active = 1");
  if (opts.search && opts.search.trim()) {
    const q = `%${opts.search.trim()}%`;
    where.push(`(p.name LIKE ? OR p.generic LIKE ? OR p.brand LIKE ? OR p.barcode LIKE ?
                 OR p.rack_no LIKE ? OR IFNULL(p.room,'') LIKE ?
                 OR IFNULL(c.name,'') LIKE ? OR IFNULL(co.name,'') LIKE ?)`);
    params.push(q, q, q, q, q, q, q, q);
  }
  if (opts.categoryId) {
    // Darakht: parent chuna to us ki tamam bachon ki dawayen bhi aayen
    const ids = categoryWithChildren(opts.categoryId);
    where.push(`p.category_id IN (${ids.map(() => "?").join(",") || "NULL"})`);
    params.push(...ids);
  }
  if (opts.companyId) {
    where.push("p.company_id = ?");
    params.push(opts.companyId);
  }
  if (opts.room) {
    where.push("IFNULL(p.room,'') = ?");
    params.push(opts.room);
  }
  // AHEM: SQLite me SELECT ka alias (stock_base / nearest_expiry) WHERE me nahi chalta --
  //       is liye yahan poora sub-query likha gaya hai.
  const STOCK_EXPR =
    "(SELECT COALESCE(SUM(b.qty_base), 0) FROM batches b WHERE b.product_id = p.id AND b.active = 1)";
  const NEAREST_EXPR =
    "(SELECT MIN(b.expiry_ym) FROM batches b WHERE b.product_id = p.id AND b.active = 1 AND b.qty_base > 0)";
  if (opts.stock === "low") where.push(`${STOCK_EXPR} <= p.reorder_level`);
  if (opts.stock === "out") where.push(`${STOCK_EXPR} <= 0`);
  if (opts.stock === "expiring") {
    where.push(`${NEAREST_EXPR} IS NOT NULL AND ${NEAREST_EXPR} <= strftime('%Y-%m','now','+3 months')`);
  }

  // HAVING ke baghair: stock/sold ko sub-query me hi rakha hai
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 500);
  const offset = Math.max(opts.offset ?? 0, 0);
  const orderSql = SORT_SQL[opts.sort ?? "name"] ?? SORT_SQL.name;

  const rows = query<Product>(
    `SELECT p.*, c.name AS category_name, co.name AS company_name,
            (SELECT COALESCE(SUM(b.qty_base), 0) FROM batches b
              WHERE b.product_id = p.id AND b.active = 1) AS stock_base,
            (SELECT MIN(b.expiry_ym) FROM batches b
              WHERE b.product_id = p.id AND b.active = 1 AND b.qty_base > 0) AS nearest_expiry,
            (SELECT COALESCE(SUM(i.qty_base), 0) FROM sale_items i JOIN sales s ON s.id = i.sale_id
              WHERE i.product_id = p.id AND s.status <> 'void') AS sold_qty
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN companies  co ON co.id = p.company_id
       ${whereSql}
      ORDER BY ${orderSql}
      LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const total = scalar<number>(
    `SELECT COUNT(*) AS c
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN companies  co ON co.id = p.company_id
       ${whereSql}`,
    params
  );

  return { rows, total };
}

/** Products ke kamre (filters me chunne ke liye) */
export function listRooms(): string[] {
  return query<{ room: string }>(
    "SELECT DISTINCT room FROM products WHERE room IS NOT NULL AND TRIM(room) <> '' AND active = 1 ORDER BY room"
  ).map((r) => r.room);
}

export function getProduct(id: number): Product | undefined {
  return get<Product>(
    `SELECT p.*, c.name AS category_name, co.name AS company_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN companies  co ON co.id = p.company_id
      WHERE p.id = ?`,
    [id]
  );
}

export function findByBarcode(barcode: string): Product | undefined {
  const b = barcode.trim();
  if (!b) return undefined;
  return get<Product>(
    `SELECT p.*, c.name AS category_name FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.barcode = ? AND p.active = 1 LIMIT 1`,
    [b]
  );
}

export type ProductInput = {
  name: string;
  generic?: string | null;
  brand?: string | null;
  barcode?: string | null;
  companyId?: number | null;
  categoryId?: number | null;
  rackNo?: string | null;
  room?: string | null;
  packSizeLabel?: string | null;
  baseUnit?: string;
  boxStrips?: number;
  stripTablets?: number;
  costPaisa?: number;
  retailPaisa?: number;
  vipPaisa?: number;
  doctorPaisa?: number;
  reorderLevel?: number;
  trackExpiry?: boolean;
};

export function createProduct(input: ProductInput, user?: { id?: number; name?: string }): number {
  if (!input.name?.trim()) throw new Error("Product name is required");

  const res = run(
    `INSERT INTO products
      (name, generic, brand, barcode, company_id, category_id, rack_no, room, pack_size_label,
       base_unit, box_strips, strip_tablets, cost_paisa, retail_paisa, vip_paisa, doctor_paisa,
       reorder_level, track_expiry)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      input.name.trim(),
      input.generic?.trim() || null,
      input.brand?.trim() || null,
      input.barcode?.trim() || null,
      input.companyId ?? null,
      input.categoryId ?? null,
      input.rackNo?.trim() || null,
      input.room?.trim() || null,
      input.packSizeLabel?.trim() || null,
      input.baseUnit || "tablet",
      Math.max(0, Math.round(input.boxStrips ?? 0)),
      Math.max(0, Math.round(input.stripTablets ?? 0)),
      Math.max(0, Math.round(input.costPaisa ?? 0)),
      Math.max(0, Math.round(input.retailPaisa ?? 0)),
      Math.max(0, Math.round(input.vipPaisa ?? 0)),
      Math.max(0, Math.round(input.doctorPaisa ?? 0)),
      Math.max(0, input.reorderLevel ?? 0),
      input.trackExpiry === false ? 0 : 1,
    ]
  );

  void audit({
    action: "create",
    userId: user?.id ?? null,
    userName: user?.name ?? null,
    entity: "Product",
    entityId: res.lastInsertRowid,
    details: { name: input.name },
  });

  return res.lastInsertRowid;
}

export function updateProduct(
  id: number,
  input: ProductInput,
  user?: { id?: number; name?: string }
): void {
  const before = getProduct(id);
  if (!before) throw new Error("Product not found");

  run(
    `UPDATE products SET
       name = ?, generic = ?, brand = ?, barcode = ?, company_id = ?, category_id = ?,
       rack_no = ?, room = ?, pack_size_label = ?, base_unit = ?, box_strips = ?, strip_tablets = ?,
       cost_paisa = ?, retail_paisa = ?, vip_paisa = ?, doctor_paisa = ?,
       reorder_level = ?, track_expiry = ?, updated_at = datetime('now','localtime')
     WHERE id = ?`,
    [
      input.name.trim(),
      input.generic?.trim() || null,
      input.brand?.trim() || null,
      input.barcode?.trim() || null,
      input.companyId ?? null,
      input.categoryId ?? null,
      input.rackNo?.trim() || null,
      input.room?.trim() || null,
      input.packSizeLabel?.trim() || null,
      input.baseUnit || "tablet",
      Math.max(0, Math.round(input.boxStrips ?? 0)),
      Math.max(0, Math.round(input.stripTablets ?? 0)),
      Math.max(0, Math.round(input.costPaisa ?? 0)),
      Math.max(0, Math.round(input.retailPaisa ?? 0)),
      Math.max(0, Math.round(input.vipPaisa ?? 0)),
      Math.max(0, Math.round(input.doctorPaisa ?? 0)),
      Math.max(0, input.reorderLevel ?? 0),
      input.trackExpiry === false ? 0 : 1,
      id,
    ]
  );

  // Price change to audit log me (Spec 13.2)
  if ((input.retailPaisa ?? before.retail_paisa) !== before.retail_paisa) {
    void audit({
      action: "price_change",
      userId: user?.id ?? null,
      userName: user?.name ?? null,
      entity: "Product",
      entityId: id,
      details: {
        name: before.name,
        field: "retail_paisa",
        from: before.retail_paisa,
        to: input.retailPaisa,
      },
    });
  }

  void audit({
    action: "update",
    userId: user?.id ?? null,
    userName: user?.name ?? null,
    entity: "Product",
    entityId: id,
    details: { name: input.name },
  });
}

export function softDeleteProduct(id: number, user?: { id?: number; name?: string }): void {
  run("UPDATE products SET active = 0, updated_at = datetime('now','localtime') WHERE id = ?", [id]);
  void audit({
    action: "delete",
    userId: user?.id ?? null,
    userName: user?.name ?? null,
    entity: "Product",
    entityId: id,
  });
}

// ---------------------------- Categories -----------------------------------
export function listCategories(): Category[] {
  return query<Category>(
    `SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.active = 1) AS product_count
       FROM categories c
      WHERE c.active = 1
      ORDER BY c.sort_order, c.name COLLATE NOCASE`
  );
}

export function createCategory(name: string, parentId?: number | null): number {
  const n = name.trim();
  if (!n) throw new Error("Category name is required");
  // Ek hi naam do jagah ho sakta hai (masalan "Dard" do alag parents ke neeche)
  const q = parentId
    ? get<{ id: number }>("SELECT id FROM categories WHERE name = ? AND IFNULL(parent_id, 0) = ?", [n, parentId])
    : get<{ id: number }>("SELECT id FROM categories WHERE name = ? AND parent_id IS NULL", [n]);
  if (q) return q.id;
  if (parentId) {
    const parent = get<{ id: number; parent_id: number | null }>(
      "SELECT id, parent_id FROM categories WHERE id = ?", [parentId]
    );
    if (!parent) throw new Error("Parent category nahi mili.");
    if (parent.parent_id) throw new Error("Zyada gehri category nahi — sirf 2 darje (parent › child).");
  }
  const res = run("INSERT INTO categories (name, parent_id, sort_order) VALUES (?,?,?)", [
    n,
    parentId ?? null,
    scalar<number>("SELECT COALESCE(MAX(sort_order), 0) + 1 AS c FROM categories"),
  ]);
  return res.lastInsertRowid;
}

/** Darakht (tree): har category ke sath us ki gehrai (depth) aur poora raasta */
export function listCategoriesTree(): (Category & { depth: number; path: string })[] {
  const rows = query<Category & { depth: number; path: string }>(
    `WITH RECURSIVE tree(id, name, parent_id, sort_order, active, product_count, depth, path) AS (
       SELECT c.id, c.name, c.parent_id, c.sort_order, c.active,
              (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.active = 1),
              0, c.name
         FROM categories c WHERE c.parent_id IS NULL AND c.active = 1
       UNION ALL
       SELECT c.id, c.name, c.parent_id, c.sort_order, c.active,
              (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.active = 1),
              t.depth + 1, t.path || ' › ' || c.name
         FROM categories c JOIN tree t ON c.parent_id = t.id
        WHERE c.active = 1
     )
     SELECT * FROM tree ORDER BY path COLLATE NOCASE`
  );
  return rows;
}

/** Ek category aur us ki SAARI bachon (children) ki ids */
export function categoryWithChildren(id: number): number[] {
  const rows = query<{ id: number }>(
    `WITH RECURSIVE sub(id) AS (
       SELECT ? UNION ALL SELECT c.id FROM categories c JOIN sub ON c.parent_id = sub.id
     )
     SELECT id FROM sub`,
    [id]
  );
  return rows.map((r) => r.id);
}

export function renameCategory(id: number, name: string): void {
  run("UPDATE categories SET name = ? WHERE id = ?", [name.trim(), id]);
}

export function deleteCategory(id: number): void {
  // Products ko na hatao -- sirf category hata do (data safe rahe)
  run("UPDATE products SET category_id = NULL WHERE category_id = ?", [id]);
  run("UPDATE categories SET active = 0 WHERE id = ?", [id]);
}

// ---------------------------- Suppliers ------------------------------------
export function listSuppliers(search?: string): Supplier[] {
  const like = `%${(search ?? "").trim()}%`;
  return query<Supplier>(
    `SELECT * FROM suppliers
      WHERE active = 1 AND (name LIKE ? OR agency LIKE ? OR phone LIKE ?)
      ORDER BY name COLLATE NOCASE`,
    [like, like, like]
  );
}

export function getSupplier(id: number): Supplier | undefined {
  return get<Supplier>("SELECT * FROM suppliers WHERE id = ?", [id]);
}

export function createSupplier(input: {
  name: string;
  agency?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
}): number {
  const n = input.name.trim();
  if (!n) throw new Error("Supplier name is required");
  const res = run(
    `INSERT INTO suppliers (name, agency, phone, address, notes) VALUES (?,?,?,?,?)`,
    [n, input.agency?.trim() || null, input.phone?.trim() || null, input.address?.trim() || null, input.notes?.trim() || null]
  );
  return res.lastInsertRowid;
}

export function updateSupplier(
  id: number,
  input: { name: string; agency?: string | null; phone?: string | null; address?: string | null; notes?: string | null }
): void {
  run(
    `UPDATE suppliers SET name = ?, agency = ?, phone = ?, address = ?, notes = ? WHERE id = ?`,
    [
      input.name.trim(),
      input.agency?.trim() || null,
      input.phone?.trim() || null,
      input.address?.trim() || null,
      input.notes?.trim() || null,
      id,
    ]
  );
}

export function softDeleteSupplier(id: number): void {
  run("UPDATE suppliers SET active = 0 WHERE id = ?", [id]);
}

// ---------------------------- Companies ------------------------------------
export function listCompanies() {
  return query<{ id: number; name: string; product_count: number }>(
    `SELECT co.id, co.name,
            (SELECT COUNT(*) FROM products p WHERE p.company_id = co.id AND p.active = 1) AS product_count
       FROM companies co WHERE co.active = 1 ORDER BY co.name COLLATE NOCASE`
  );
}

export function createCompany(name: string): number {
  const n = name.trim();
  if (!n) throw new Error("Company name is required");
  const exists = get<{ id: number }>("SELECT id FROM companies WHERE name = ?", [n]);
  if (exists) return exists.id;
  return run("INSERT INTO companies (name) VALUES (?)", [n]).lastInsertRowid;
}

export function renameCompany(id: number, name: string): void {
  const n = name.trim();
  if (!n) throw new Error("Company name is required");
  run("UPDATE companies SET name = ? WHERE id = ?", [n, id]);
}

export function deleteCompany(id: number): void {
  // Products ko na hatao -- sirf company hata do (data safe rahe)
  run("UPDATE products SET company_id = NULL WHERE company_id = ?", [id]);
  run("UPDATE companies SET active = 0 WHERE id = ?", [id]);
}

// ---------------------------- Helpers --------------------------------------
export function productStock(productId: number): number {
  return scalar<number>(
    "SELECT COALESCE(SUM(qty_base), 0) AS s FROM batches WHERE product_id = ? AND active = 1",
    [productId]
  );
}

export { toBaseUnits };
