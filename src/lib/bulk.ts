// ---------------------------------------------------------------------------
// Area11 - Sare records ek file se UPDATE karna (bulk edit) -- photos ke siwa
// ---------------------------------------------------------------------------
// Owner chahte hain: "sab records (customers, suppliers, products, settings,
// category ...) ek file me milen, usi file me badal kar wapas daal dein to sab
// update ho jaye."
//
// Tareeqa:
//   1) buildDataFile()      -> mojuda data ki .xlsx file (photos ke baghair)
//   2) previewBulkUpdate()  -> pehle SIRF dikhata hai (dry-run): kaunsi line
//                              kya badalegi / kaunsi nahi milegi / kya ghalat
//   3) commitBulkUpdate()   -> sab kuch EK transaction me likhta hai
//
// AHEM USOOL:
//   * KHALI cell = "koi tabdeeli nahi" (ghalti se kuch mitay nahi jata)
//   * kisi field ko saaf karna ho to us me likhein: __CLEAR__
//   * Milap (match) ID se hota hai; ID na ho to Name / Phone / Barcode se
//   * Jo record na mile wo "skip" -- NAYI cheez banane ke liye purana
//     "Import old data" istemal karein
//   * Balance (khata) kabhi file se nahi badalta -- wo ledger ka hisab hai
//   * Settings sirf wahi keys badalti hain jo pehle se maujood hain, aur
//     security wali keys (secret waghaira) kabhi nahi
// ---------------------------------------------------------------------------

import * as XLSX from "xlsx";
import { get, query, run, tx } from "./db";
import { toPaisa, toRupees } from "./money";
import { audit } from "./audit";

// ---------------------------------------------------------------------------
// Columns (yehi export aur update dono me istemal hote hain)
// ---------------------------------------------------------------------------
type Col = {
  key: string;
  header: string;
  hint: string;
  readOnly?: boolean; // sirf dekhne ke liye -- update me nazar-andaz
};

export const PRODUCT_COLS: Col[] = [
  { key: "id", header: "ID", hint: "App ka ID — badlein nahi (milap isi se hota hai)" },
  { key: "name", header: "Name", hint: "Dawa ka naam" },
  { key: "generic", header: "Generic", hint: "Salt / generic naam" },
  { key: "company", header: "Company", hint: "Company (nayi ho to khud ban jayegi)" },
  { key: "category", header: "Category", hint: "Category (nayi ho to khud ban jayegi)" },
  { key: "brand", header: "Brand", hint: "Brand naam" },
  { key: "barcode", header: "Barcode", hint: "Scanner wala number" },
  { key: "rack", header: "Rack", hint: "Rack / shelf" },
  { key: "room", header: "Room", hint: "Kamra / almari" },
  { key: "boxStrips", header: "Strips_in_Box", hint: "1 box me kitni strip" },
  { key: "stripTablets", header: "Tablets_in_Strip", hint: "1 strip me kitni goli" },
  { key: "baseUnit", header: "Base_Unit", hint: "tablet / piece / ml" },
  { key: "cost", header: "Cost_Rs", hint: "Kharid rate RUPEY me (6.75)" },
  { key: "retail", header: "Retail_Rs", hint: "Aam rate (rupey)" },
  { key: "vip", header: "VIP_Rs", hint: "VIP rate (rupey)" },
  { key: "doctor", header: "Doctor_Rs", hint: "Doctor rate (rupey)" },
  { key: "reorder", header: "Reorder_Level", hint: "Kitni goli bach jaye to alert" },
  { key: "stock", header: "Stock_Info", hint: "Sirf maloomat — ginti ke safhe se badlein", readOnly: true },
];

export const CUSTOMER_COLS: Col[] = [
  { key: "id", header: "ID", hint: "App ka ID — badlein nahi" },
  { key: "name", header: "Name", hint: "Gahak ka naam" },
  { key: "phone", header: "Phone", hint: "Mobile number" },
  { key: "category", header: "Category", hint: "normal / vip / doctor" },
  { key: "creditLimit", header: "Credit_Limit_Rs", hint: "Udhaar ki hadd (rupey, 0 = koi hadd nahi)" },
  { key: "notes", header: "Notes", hint: "Koi yaad-dasht" },
  { key: "balance", header: "Balance_Info", hint: "Sirf maloomat — khata se hisab chalta hai", readOnly: true },
];

export const SUPPLIER_COLS: Col[] = [
  { key: "id", header: "ID", hint: "App ka ID — badlein nahi" },
  { key: "name", header: "Name", hint: "Supplier ka naam" },
  { key: "agency", header: "Agency", hint: "Agency / firm" },
  { key: "phone", header: "Phone", hint: "Mobile / landline" },
  { key: "address", header: "Address", hint: "Pata" },
  { key: "balance", header: "Balance_Info", hint: "Sirf maloomat — payment ke safhe se badlein", readOnly: true },
];

export const CATEGORY_COLS: Col[] = [
  { key: "id", header: "ID", hint: "App ka ID — badlein nahi" },
  { key: "name", header: "Name", hint: "Category ka naam" },
  { key: "parent", header: "Parent", hint: "Upar wali category (khali = sab se upar)" },
];

export const COMPANY_COLS: Col[] = [
  { key: "id", header: "ID", hint: "App ka ID — badlein nahi" },
  { key: "name", header: "Name", hint: "Company ka naam" },
];

export const SETTINGS_COLS: Col[] = [
  { key: "key", header: "Key", hint: "Setting ka naam — badlein nahi" },
  { key: "value", header: "Value", hint: "Nayi qeemat (true / false / number / likhat)" },
  { key: "note", header: "Note", hint: "Ye setting kya karti hai", readOnly: true },
];

export const STOCK_COLS: Col[] = [
  { key: "id", header: "Batch_ID", hint: "Batch ka ID — badlein nahi" },
  { key: "product", header: "Product", hint: "Dawa ka naam", readOnly: true },
  { key: "batchNo", header: "Batch_No", hint: "Batch number" },
  { key: "expiry", header: "Expiry", hint: "YYYY-MM (jaise 2027-06)" },
  { key: "cost", header: "Cost_Rs", hint: "Is batch ka kharid rate (rupey)" },
  { key: "qty", header: "Qty_Info", hint: "Sirf maloomat — ginti ya write-off se badlein", readOnly: true },
];

const SHEETS = {
  Products: PRODUCT_COLS,
  Customers: CUSTOMER_COLS,
  Suppliers: SUPPLIER_COLS,
  Categories: CATEGORY_COLS,
  Companies: COMPANY_COLS,
  Stock: STOCK_COLS,
  Settings: SETTINGS_COLS,
} as const;

/** Kabhi file se na badalne wali settings (suraksha) */
const LOCKED_SETTINGS = ["security.sessionSecret", "bill.nextSaleNo", "bill.nextPurchaseNo", "bill.nextProvisionalNo", "bill.nextSupplierReturnNo", "bill.nextStockTakeNo"];

const CLEAR = "__CLEAR__";

// ---------------------------------------------------------------------------
// 1) EXPORT -- sare records ki file (photos ke baghair)
// ---------------------------------------------------------------------------
export function buildDataFile(): Buffer {
  const wb = XLSX.utils.book_new();

  const addSheet = (name: string, cols: Col[], rows: Record<string, unknown>[]) => {
    const header = cols.map((c) => c.header);
    const aoa: unknown[][] = [header, ...rows.map((r) => cols.map((c) => r[c.key] ?? ""))];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = header.map((h) => ({ wch: Math.max(12, String(h).length + 2) }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  };

  // --- Products (photo ka zikr hi nahi -- owner ne mana kiya hai) ---
  const products = query<Record<string, unknown>>(
    `SELECT p.id, p.name, p.generic, p.brand, p.barcode, p.rack_no, p.room,
            p.box_strips, p.strip_tablets, p.base_unit,
            p.cost_paisa, p.retail_paisa, p.vip_paisa, p.doctor_paisa, p.reorder_level,
            c.name AS company, cat.name AS category,
            (SELECT COALESCE(SUM(qty_base),0) FROM batches b WHERE b.product_id = p.id AND b.active = 1) AS stock
       FROM products p
       LEFT JOIN companies c ON c.id = p.company_id
       LEFT JOIN categories cat ON cat.id = p.category_id
      WHERE p.active = 1
      ORDER BY p.name`
  );
  addSheet(
    "Products",
    PRODUCT_COLS,
    products.map((p) => ({
      id: p.id,
      name: p.name,
      generic: p.generic ?? "",
      company: p.company ?? "",
      category: p.category ?? "",
      brand: p.brand ?? "",
      barcode: p.barcode ?? "",
      rack: p.rack_no ?? "",
      room: p.room ?? "",
      boxStrips: p.box_strips,
      stripTablets: p.strip_tablets,
      baseUnit: p.base_unit,
      cost: toRupees(Number(p.cost_paisa ?? 0)),
      retail: toRupees(Number(p.retail_paisa ?? 0)),
      vip: toRupees(Number(p.vip_paisa ?? 0)),
      doctor: toRupees(Number(p.doctor_paisa ?? 0)),
      reorder: p.reorder_level,
      stock: p.stock,
    }))
  );

  const customers = query<Record<string, unknown>>(
    `SELECT id, name, phone, category, credit_limit_paisa, notes, balance_paisa
       FROM customers WHERE active = 1 ORDER BY name`
  );
  addSheet(
    "Customers",
    CUSTOMER_COLS,
    customers.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone ?? "",
      category: c.category ?? "normal",
      creditLimit: toRupees(Number(c.credit_limit_paisa ?? 0)),
      notes: c.notes ?? "",
      balance: toRupees(Number(c.balance_paisa ?? 0)),
    }))
  );

  const suppliers = query<Record<string, unknown>>(
    `SELECT id, name, agency, phone, address, balance_paisa FROM suppliers WHERE active = 1 ORDER BY name`
  );
  addSheet(
    "Suppliers",
    SUPPLIER_COLS,
    suppliers.map((s) => ({
      id: s.id,
      name: s.name,
      agency: s.agency ?? "",
      phone: s.phone ?? "",
      address: s.address ?? "",
      balance: toRupees(Number(s.balance_paisa ?? 0)),
    }))
  );

  const cats = query<Record<string, unknown>>(
    `SELECT c.id, c.name, p.name AS parent
       FROM categories c LEFT JOIN categories p ON p.id = c.parent_id
      ORDER BY COALESCE(p.name, c.name), c.name`
  );
  addSheet("Categories", CATEGORY_COLS, cats.map((c) => ({ id: c.id, name: c.name, parent: c.parent ?? "" })));

  const comps = query<Record<string, unknown>>(`SELECT id, name FROM companies ORDER BY name`);
  addSheet("Companies", COMPANY_COLS, comps.map((c) => ({ id: c.id, name: c.name })));

  const batches = query<Record<string, unknown>>(
    `SELECT b.id, p.name AS product, b.batch_no, b.expiry_ym, b.qty_base, b.cost_paisa
       FROM batches b JOIN products p ON p.id = b.product_id
      WHERE b.active = 1 ORDER BY p.name, b.expiry_ym`
  );
  addSheet(
    "Stock",
    STOCK_COLS,
    batches.map((b) => ({
      id: b.id,
      product: b.product,
      batchNo: b.batch_no ?? "",
      expiry: b.expiry_ym ?? "",
      cost: toRupees(Number(b.cost_paisa ?? 0)),
      qty: b.qty_base,
    }))
  );

  const settingNotes: Record<string, string> = {
    "store.name": "Dukan ka naam (rasid par chhapta hai)",
    "bill.salePrefix": "Bill number ka prefix (INV-)",
    "bill.roundMode": "Round karna: down10 ya none",
    "tax.enabled": "Tax on/off",
    "tax.percent": "Tax ka percent",
    "discount.enabled": "Discount on/off",
    "discount.maxPercentCashier": "Cashier ki chhoot ki hadd (%)",
    "discount.maxPercentManager": "Manager ki chhoot ki hadd (%)",
    "loyalty.enabled": "Loyalty points on/off",
    "loyalty.rupeesPerPoint": "Kitne rupey par 1 point",
    "credit.blockOverLimit": "Udhaar ki hadd poori ho to band kar do",
    "credit.managerCanOverride": "Manager hadd ke upar udhaar de sakta hai",
    "payment.methods": "Kaun se payment tareeqe (cash, credit, online, card)",
  };
  const settings = query<{ key: string; value: string }>(
    `SELECT key, value FROM settings WHERE key NOT LIKE 'security.%' ORDER BY key`
  );
  addSheet(
    "Settings",
    SETTINGS_COLS,
    settings.map((s) => ({
      key: s.key,
      value: safeSettingText(s.value),
      note: settingNotes[s.key] ?? "",
    }))
  );

  // --- Hidayat ka safha ---
  const help: string[][] = [
    ["Area11 — sare records ek file se UPDATE karna"],
    [""],
    ["Tareeqa:"],
    ["1. Neeche diye gaye safhon me jo bhi cheez badalni hai, wahi cell badlein."],
    ["2. KHALI cell ka matlab hai 'koi tabdeeli nahi' — kuch mitay nahi jata."],
    ["   (agar koi field bilkul saaf karni ho to us me likhein:  __CLEAR__ )"],
    ["3. File save karein (.xlsx), phir app me 'Data (Excel)' safhe par Update wale hisse me upload karein."],
    ["4. App pehle POORA PREVIEW dikhayegi — har line ke sath likha hoga ke kya badal raha hai."],
    ["   Jab tak aap 'Update karein' na dabayein, database me kuch nahi jayega."],
    ["5. Update ke waqt aap select kar sakte hain ke Settings bhi badlein ya nahi (ihtiyat ke tor par band rehta hai)."],
    [""],
    ["Ahem baatein:"],
    ["• ID wala column na badlein — isi se app record pehchan-ta hai."],
    ["• Jo record na mile (galat ID / naam), wo line 'skip' ho jayegi — NAYA record banane ke liye"],
    ["  upar wala 'Import old data (naya data)' istemal karein."],
    ["• Rate (Cost / Retail) RUPEY me likhein, jaise 6.75 — app khud paisa bana legi."],
    ["• Balance (khata) kabhi file se nahi badalta — wo khata/payment se hisab rakhta hai."],
    ["• Photos is file me nahi aate (un ko product ke safhe par alag se lagayein)."],
    ["• Stock ki Quantity bhi is file se nahi badalti — ginti (Stock-take) ya Write-off istemal karein."],
    ["• Security wali settings (secret, agla bill number) kabhi file se nahi badalti."],
    ["• Settings me jo qeemat [ ] ya { } se shuru ho, wo asal JSON hai — usi shakal me rakhein"],
    ["  (masalan payment.methods ki qeemat likhein:  [\"cash\",\"credit\"] )."],
    [""],
    ["Safhe (sheets) aur un ke column:"],
  ];
  for (const [name, cols] of Object.entries(SHEETS)) {
    help.push([`— ${name}`]);
    for (const c of cols) {
      help.push([`   ${c.header}${c.readOnly ? " (sirf dekhein)" : ""}`, c.hint]);
    }
    help.push([""]);
  }
  const wsHelp = XLSX.utils.aoa_to_sheet(help);
  wsHelp["!cols"] = [{ wch: 30 }, { wch: 72 }];
  XLSX.utils.book_append_sheet(wb, wsHelp, "Instructions");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/** Setting ki asal qeemat (array/object/number/string) */
function parseSetting(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/** File me dikhane ke liye: array/object ho to poora JSON, warni saada likhat */
function safeSettingText(raw: string): string {
  const v = parseSetting(raw);
  if (v == null) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** File se wapas padhte waqt: qisam (number / true-false / JSON) pehle jaisi rahe */
function parseSettingInput(raw: string): unknown {
  if (raw === "") return "";
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  if (raw.startsWith("[") || raw.startsWith("{")) {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

// ---------------------------------------------------------------------------
// 2) PREVIEW (dry run)
// ---------------------------------------------------------------------------
export type BulkStatus = "ok" | "skip" | "error";

export type BulkRow = {
  sheet: string;
  rowNo: number;
  status: BulkStatus;
  title: string;
  changes: string[];
  messages: string[];
};

export type BulkPreview = {
  sheets: string[];
  rows: BulkRow[];
  counts: { ok: number; skip: number; error: number };
  totals: Record<string, { ok: number; skip: number; error: number }>;
};

type Opts = { includeSettings?: boolean };

function text(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

/** KHALI = chhoR do · __CLEAR__ = saaf kar do · warna naya value */
function val(v: unknown): { set: boolean; clear: boolean; raw: string } {
  const t = text(v);
  if (t === "") return { set: false, clear: false, raw: "" };
  if (t.toUpperCase() === CLEAR) return { set: true, clear: true, raw: "" };
  return { set: true, clear: false, raw: t };
}

function readSheet(buf: Buffer, name: string): { rowNo: number; raw: Record<string, unknown> }[] {
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[name];
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
  return rows
    .map((r, i) => ({ rowNo: i + 2, raw: r }))
    .filter((r) => Object.values(r.raw).some((v) => text(v) !== ""));
}

function findProductByRef(idRaw: unknown, nameRaw: unknown, barcodeRaw: unknown) {
  const id = Number(text(idRaw));
  if (id > 0) {
    const p = get<{ id: number; name: string }>("SELECT id, name FROM products WHERE id = ? AND active = 1", [id]);
    if (p) return p;
  }
  const bc = text(barcodeRaw);
  if (bc) {
    const p = get<{ id: number; name: string }>("SELECT id, name FROM products WHERE barcode = ? AND active = 1", [bc]);
    if (p) return p;
  }
  const nm = text(nameRaw);
  if (nm) {
    const p = get<{ id: number; name: string }>("SELECT id, name FROM products WHERE name = ? COLLATE NOCASE AND active = 1", [nm]);
    if (p) return p;
  }
  return undefined;
}

function ensureCategory(name: string): number {
  const found = get<{ id: number }>("SELECT id FROM categories WHERE name = ? COLLATE NOCASE", [name]);
  if (found) return found.id;
  const r = run("INSERT INTO categories (name) VALUES (?)", [name.trim()]);
  return Number(r.lastInsertRowid);
}

function ensureCompany(name: string): number {
  const found = get<{ id: number }>("SELECT id FROM companies WHERE name = ? COLLATE NOCASE", [name]);
  if (found) return found.id;
  const r = run("INSERT INTO companies (name) VALUES (?)", [name.trim()]);
  return Number(r.lastInsertRowid);
}

export function previewBulkUpdate(buf: Buffer, opts: Opts = {}): BulkPreview {
  const rows: BulkRow[] = [];

  // ---------------- Products ----------------
  for (const r of readSheet(buf, "Products")) {
    const o = r.raw;
    const found = findProductByRef(o["ID"], o["Name"], o["Barcode"]);
    if (!found) {
      rows.push({
        sheet: "Products",
        rowNo: r.rowNo,
        status: "skip",
        title: text(o["Name"]) || text(o["ID"]) || "(khaali line)",
        changes: [],
        messages: ["Yeh dawa app me nahi mili — nayi dawa banane ke liye 'Import old data' istemal karein."],
      });
      continue;
    }
    const cur = get<Record<string, unknown>>(
      `SELECT p.*, c.name AS company, cat.name AS category FROM products p
        LEFT JOIN companies c ON c.id = p.company_id
        LEFT JOIN categories cat ON cat.id = p.category_id
       WHERE p.id = ?`,
      [found.id]
    );
    if (!cur) continue;

    const changes: string[] = [];
    const cmpText = (label: string, incoming: unknown, current: unknown) => {
      const v = val(incoming);
      if (!v.set) return;
      const now = text(current ?? "");
      const next = v.clear ? "" : v.raw;
      if (next !== now) changes.push(`${label}: "${now || "—"}" → "${next || "khaali"}"`);
    };
    const cmpNum = (label: string, incoming: unknown, current: unknown, rupees = false) => {
      const v = val(incoming);
      if (!v.set) return;
      const next = v.clear ? null : Number(v.raw);
      if (next != null && !isFinite(next)) {
        rows.push({ sheet: "Products", rowNo: r.rowNo, status: "error", title: found.name, changes, messages: [`${label}: "${v.raw}" theek number nahi`] });
        return;
      }
      const now = current == null ? null : Number(current);
      if (next !== now) {
        changes.push(`${label}: ${now ?? "—"}${rupees ? " Rs" : ""} → ${next ?? "khaali"}${rupees ? " Rs" : ""}`);
      }
    };

    cmpText("Naam", o["Name"], cur.name);
    cmpText("Generic", o["Generic"], cur.generic);
    cmpText("Company", o["Company"], cur.company);
    cmpText("Category", o["Category"], cur.category);
    cmpText("Brand", o["Brand"], cur.brand);
    cmpText("Barcode", o["Barcode"], cur.barcode);
    cmpText("Rack", o["Rack"], cur.rack_no);
    cmpText("Room", o["Room"], cur.room);
    cmpText("Base unit", o["Base_Unit"], cur.base_unit);
    cmpNum("Strip/box", o["Strips_in_Box"], cur.box_strips);
    cmpNum("Goli/strip", o["Tablets_in_Strip"], cur.strip_tablets);
    cmpNum("Kharid rate", o["Cost_Rs"], cur.cost_paisa == null ? null : toRupees(Number(cur.cost_paisa)), true);
    cmpNum("Retail", o["Retail_Rs"], cur.retail_paisa == null ? null : toRupees(Number(cur.retail_paisa)), true);
    cmpNum("VIP", o["VIP_Rs"], cur.vip_paisa == null ? null : toRupees(Number(cur.vip_paisa)), true);
    cmpNum("Doctor", o["Doctor_Rs"], cur.doctor_paisa == null ? null : toRupees(Number(cur.doctor_paisa)), true);
    cmpNum("Reorder", o["Reorder_Level"], cur.reorder_level);

    rows.push({
      sheet: "Products",
      rowNo: r.rowNo,
      status: changes.length ? "ok" : "skip",
      title: found.name,
      changes,
      messages: changes.length ? [] : ["Koi tabdeeli nahi (sab kuch waisa hi hai)."],
    });
  }

  // ---------------- Customers ----------------
  for (const r of readSheet(buf, "Customers")) {
    const o = r.raw;
    const found = findCustomer(o["ID"], o["Phone"], o["Name"]);
    if (!found) {
      rows.push({
        sheet: "Customers", rowNo: r.rowNo, status: "skip",
        title: text(o["Name"]) || text(o["Phone"]) || "(khaali line)",
        changes: [], messages: ["Yeh gahak app me nahi mila — naya gahak banane ke liye 'Import old data' istemal karein."],
      });
      continue;
    }
    const cur = get<Record<string, unknown>>("SELECT * FROM customers WHERE id = ?", [found.id]);
    if (!cur) continue;
    const changes: string[] = [];
    const cmpText = (label: string, incoming: unknown, current: unknown) => {
      const v = val(incoming);
      if (!v.set) return;
      const now = text(current ?? "");
      const next = v.clear ? "" : v.raw;
      if (next !== now) changes.push(`${label}: "${now || "—"}" → "${next || "khaali"}"`);
    };
    cmpText("Naam", o["Name"], cur.name);
    cmpText("Phone", o["Phone"], cur.phone);
    cmpText("Category", o["Category"], cur.category);
    cmpText("Notes", o["Notes"], cur.notes);
    const lim = val(o["Credit_Limit_Rs"]);
    if (lim.set) {
      const next = lim.clear ? 0 : toPaisa(lim.raw || "0");
      const now = Number(cur.credit_limit_paisa ?? 0);
      if (next !== now) changes.push(`Udhaar ki hadd: ${toRupees(now)} Rs → ${toRupees(next)} Rs`);
    }
    rows.push({
      sheet: "Customers", rowNo: r.rowNo, status: changes.length ? "ok" : "skip",
      title: found.name, changes,
      messages: changes.length ? [] : ["Koi tabdeeli nahi."],
    });
  }

  // ---------------- Suppliers ----------------
  for (const r of readSheet(buf, "Suppliers")) {
    const o = r.raw;
    const found = findSupplier(o["ID"], o["Name"]);
    if (!found) {
      rows.push({
        sheet: "Suppliers", rowNo: r.rowNo, status: "skip",
        title: text(o["Name"]) || "(khaali line)", changes: [],
        messages: ["Yeh supplier app me nahi mila — naya banane ke liye 'Import old data' istemal karein."],
      });
      continue;
    }
    const cur = get<Record<string, unknown>>("SELECT * FROM suppliers WHERE id = ?", [found.id]);
    if (!cur) continue;
    const changes: string[] = [];
    const cmpText = (label: string, incoming: unknown, current: unknown) => {
      const v = val(incoming);
      if (!v.set) return;
      const now = text(current ?? "");
      const next = v.clear ? "" : v.raw;
      if (next !== now) changes.push(`${label}: "${now || "—"}" → "${next || "khaali"}"`);
    };
    cmpText("Naam", o["Name"], cur.name);
    cmpText("Agency", o["Agency"], cur.agency);
    cmpText("Phone", o["Phone"], cur.phone);
    cmpText("Address", o["Address"], cur.address);
    rows.push({
      sheet: "Suppliers", rowNo: r.rowNo, status: changes.length ? "ok" : "skip",
      title: found.name, changes, messages: changes.length ? [] : ["Koi tabdeeli nahi."],
    });
  }

  // ---------------- Categories ----------------
  for (const r of readSheet(buf, "Categories")) {
    const o = r.raw;
    const found = findCategory(o["ID"], o["Name"]);
    if (!found) {
      rows.push({ sheet: "Categories", rowNo: r.rowNo, status: "skip", title: text(o["Name"]) || "(khaali line)", changes: [], messages: ["Yeh category app me nahi mili."] });
      continue;
    }
    const name = val(o["Name"]);
    const parent = val(o["Parent"]);
    const changes: string[] = [];
    if (name.set && name.raw !== found.name) changes.push(`Naam: "${found.name}" → "${name.clear ? "khaali" : name.raw}"`);
    if (parent.set) {
      const curParent = get<{ name: string }>("SELECT name FROM categories WHERE id = ?", [found.parent_id ?? 0]);
      const now = curParent?.name ?? "";
      const next = parent.clear ? "" : parent.raw;
      if (next !== now) changes.push(`Parent: "${now || "—"}" → "${next || "sab se upar"}"`);
    }
    rows.push({ sheet: "Categories", rowNo: r.rowNo, status: changes.length ? "ok" : "skip", title: found.name, changes, messages: changes.length ? [] : ["Koi tabdeeli nahi."] });
  }

  // ---------------- Companies ----------------
  for (const r of readSheet(buf, "Companies")) {
    const o = r.raw;
    const id = Number(text(o["ID"]));
    const found =
      (id > 0 && get<{ id: number; name: string }>("SELECT id, name FROM companies WHERE id = ?", [id])) ||
      get<{ id: number; name: string }>("SELECT id, name FROM companies WHERE name = ? COLLATE NOCASE", [text(o["Name"])]) ||
      undefined;
    if (!found) {
      rows.push({ sheet: "Companies", rowNo: r.rowNo, status: "skip", title: text(o["Name"]) || "(khaali line)", changes: [], messages: ["Yeh company app me nahi mili."] });
      continue;
    }
    const nm = val(o["Name"]);
    const changes: string[] = [];
    if (nm.set && nm.raw !== found.name) changes.push(`Naam: "${found.name}" → "${nm.clear ? "khaali" : nm.raw}"`);
    rows.push({ sheet: "Companies", rowNo: r.rowNo, status: changes.length ? "ok" : "skip", title: found.name, changes, messages: changes.length ? [] : ["Koi tabdeeli nahi."] });
  }

  // ---------------- Stock (batches) ----------------
  for (const r of readSheet(buf, "Stock")) {
    const o = r.raw;
    const id = Number(text(o["Batch_ID"]));
    const found = id > 0 ? get<{ id: number; batch_no: string | null; expiry_ym: string | null; cost_paisa: number; product_id: number }>("SELECT id, batch_no, expiry_ym, cost_paisa, product_id FROM batches WHERE id = ? AND active = 1", [id]) : undefined;
    if (!found) {
      rows.push({ sheet: "Stock", rowNo: r.rowNo, status: "skip", title: text(o["Product"]) || text(o["Batch_ID"]) || "(khaali line)", changes: [], messages: ["Yeh batch app me nahi mila."] });
      continue;
    }
    const changes: string[] = [];
    const bn = val(o["Batch_No"]);
    if (bn.set) {
      const now = found.batch_no ?? "";
      const next = bn.clear ? "" : bn.raw;
      if (next !== now) changes.push(`Batch: "${now || "—"}" → "${next || "khaali"}"`);
    }
    const ex = val(o["Expiry"]);
    if (ex.set) {
      const next = ex.clear ? "" : ex.raw.replace("/", "-").slice(0, 7);
      const now = found.expiry_ym ?? "";
      if (next !== now) changes.push(`Expiry: "${now || "—"}" → "${next || "khaali"}"`);
    }
    const cst = val(o["Cost_Rs"]);
    if (cst.set) {
      const next = cst.clear ? 0 : toPaisa(cst.raw || "0");
      const now = Number(found.cost_paisa ?? 0);
      if (next !== now) changes.push(`Kharid rate: ${toRupees(now)} Rs → ${toRupees(next)} Rs`);
    }
    rows.push({ sheet: "Stock", rowNo: r.rowNo, status: changes.length ? "ok" : "skip", title: `${text(o["Product"]) || "batch"} ${found.batch_no ?? ""}`.trim(), changes, messages: changes.length ? [] : ["Koi tabdeeli nahi."] });
  }

  // ---------------- Settings ----------------
  for (const r of readSheet(buf, "Settings")) {
    const o = r.raw;
    const key = text(o["Key"]);
    if (!opts.includeSettings) {
      rows.push({ sheet: "Settings", rowNo: r.rowNo, status: "skip", title: key || "(khaali line)", changes: [], messages: ["Settings badalne ka tick nahi kiya gaya — ye line chhoR di jayegi."] });
      continue;
    }
    if (!key) {
      rows.push({ sheet: "Settings", rowNo: r.rowNo, status: "error", title: "(khaali line)", changes: [], messages: ["Key khaali hai."] });
      continue;
    }
    if (LOCKED_SETTINGS.includes(key)) {
      rows.push({ sheet: "Settings", rowNo: r.rowNo, status: "skip", title: key, changes: [], messages: ["Ye setting suraksha ki wajah se file se nahi badalti."] });
      continue;
    }
    const cur = get<{ value: string }>("SELECT value FROM settings WHERE key = ?", [key]);
    if (!cur) {
      rows.push({ sheet: "Settings", rowNo: r.rowNo, status: "skip", title: key, changes: [], messages: ["Ye setting is app me maujood nahi — nayi setting file se nahi ban sakti."] });
      continue;
    }
    const v = val(o["Value"]);
    if (!v.set) {
      rows.push({ sheet: "Settings", rowNo: r.rowNo, status: "skip", title: key, changes: [], messages: ["Nayi qeemat khaali hai — koi tabdeeli nahi."] });
      continue;
    }
    const nowText = safeSettingText(cur.value);
    const nextText = v.clear ? "" : v.raw;
    const same = nextText === nowText || JSON.stringify(parseSettingInput(nextText)) === JSON.stringify(parseSetting(cur.value));
    rows.push({
      sheet: "Settings", rowNo: r.rowNo,
      status: same ? "skip" : "ok",
      title: key,
      changes: same ? [] : [`Qeemat: "${nowText}" → "${nextText}"`],
      messages: same ? ["Koi tabdeeli nahi."] : [],
    });
  }

  const totals: BulkPreview["totals"] = {};
  for (const r of rows) {
    totals[r.sheet] ??= { ok: 0, skip: 0, error: 0 };
    totals[r.sheet][r.status]++;
  }
  return {
    sheets: Object.keys(SHEETS),
    rows,
    counts: {
      ok: rows.filter((r) => r.status === "ok").length,
      skip: rows.filter((r) => r.status === "skip").length,
      error: rows.filter((r) => r.status === "error").length,
    },
    totals,
  };
}

function findCustomer(idRaw: unknown, phoneRaw: unknown, nameRaw: unknown) {
  const id = Number(text(idRaw));
  if (id > 0) {
    const c = get<{ id: number; name: string }>("SELECT id, name FROM customers WHERE id = ? AND active = 1", [id]);
    if (c) return c;
  }
  const ph = text(phoneRaw);
  if (ph) {
    const c = get<{ id: number; name: string }>("SELECT id, name FROM customers WHERE phone = ? AND active = 1", [ph]);
    if (c) return c;
  }
  const nm = text(nameRaw);
  if (nm) {
    const c = get<{ id: number; name: string }>("SELECT id, name FROM customers WHERE name = ? COLLATE NOCASE AND active = 1", [nm]);
    if (c) return c;
  }
  return undefined;
}

function findSupplier(idRaw: unknown, nameRaw: unknown) {
  const id = Number(text(idRaw));
  if (id > 0) {
    const s = get<{ id: number; name: string }>("SELECT id, name FROM suppliers WHERE id = ? AND active = 1", [id]);
    if (s) return s;
  }
  const nm = text(nameRaw);
  if (nm) {
    const s = get<{ id: number; name: string }>("SELECT id, name FROM suppliers WHERE name = ? COLLATE NOCASE AND active = 1", [nm]);
    if (s) return s;
  }
  return undefined;
}

function findCategory(idRaw: unknown, nameRaw: unknown) {
  const id = Number(text(idRaw));
  if (id > 0) {
    const c = get<{ id: number; name: string; parent_id: number | null }>("SELECT id, name, parent_id FROM categories WHERE id = ?", [id]);
    if (c) return c;
  }
  const nm = text(nameRaw);
  if (nm) {
    const c = get<{ id: number; name: string; parent_id: number | null }>("SELECT id, name, parent_id FROM categories WHERE name = ? COLLATE NOCASE", [nm]);
    if (c) return c;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// 3) COMMIT -- sab kuch ek transaction me
// ---------------------------------------------------------------------------
export type BulkResult = {
  products: number;
  customers: number;
  suppliers: number;
  categories: number;
  companies: number;
  batches: number;
  settings: number;
  skipped: number;
};

export async function commitBulkUpdate(
  buf: Buffer,
  opts: Opts = {},
  user?: { id?: number; name?: string }
): Promise<BulkResult> {
  const out: BulkResult = { products: 0, customers: 0, suppliers: 0, categories: 0, companies: 0, batches: 0, settings: 0, skipped: 0 };

  // Sirf wahi line likhein jis me WAAQAI tabdeeli ho -- preview jis line ko
  // "ok" kahe bas wahi. Is se result ki ginti preview se milti hai.
  const pv = previewBulkUpdate(buf, opts);
  const changed = new Set(
    pv.rows.filter((r) => r.status === "ok").map((r) => `${r.sheet}:${r.rowNo}`)
  );
  const isChanged = (sheet: string, rowNo: number) => changed.has(`${sheet}:${rowNo}`);

  tx(() => {
    // ---- Products ----
    for (const r of readSheet(buf, "Products")) {
      if (!isChanged("Products", r.rowNo)) { out.skipped++; continue; }
      const o = r.raw;
      const found = findProductByRef(o["ID"], o["Name"], o["Barcode"]);
      if (!found) { out.skipped++; continue; }
      const cur = get<Record<string, unknown>>(
        `SELECT p.*, c.name AS company, cat.name AS category FROM products p
          LEFT JOIN companies c ON c.id = p.company_id
          LEFT JOIN categories cat ON cat.id = p.category_id
         WHERE p.id = ?`,
        [found.id]
      );
      if (!cur) { out.skipped++; continue; }

      const nextName = val(o["Name"]).set && !val(o["Name"]).clear ? text(o["Name"]) : text(cur.name);
      if (!nextName) { out.skipped++; continue; }

      // company / category: nayi ho to bana dete hain (owner ki rule U-18)
      let companyId = cur.company_id as number | null;
      const cv = val(o["Company"]);
      if (cv.set) companyId = cv.clear ? null : ensureCompany(cv.raw);

      let categoryId = cur.category_id as number | null;
      const catv = val(o["Category"]);
      if (catv.set) categoryId = catv.clear ? null : ensureCategory(catv.raw);

      const pickText = (incoming: unknown, current: unknown) => {
        const v = val(incoming);
        if (!v.set) return text(current ?? "") || null;
        if (v.clear) return null;
        return v.raw;
      };
      const pickNum = (incoming: unknown, current: unknown) => {
        const v = val(incoming);
        if (!v.set) return current == null ? null : Number(current);
        if (v.clear) return null;
        const n = Number(v.raw);
        return isFinite(n) ? n : current == null ? null : Number(current);
      };
      const pickPaisa = (incoming: unknown, current: unknown) => {
        const v = val(incoming);
        if (!v.set) return current == null ? 0 : Number(current);
        if (v.clear) return 0;
        return toPaisa(v.raw || "0");
      };

      run(
        `UPDATE products SET
           name = ?, generic = ?, brand = ?, barcode = ?, company_id = ?, category_id = ?,
           rack_no = ?, room = ?, base_unit = ?, box_strips = ?, strip_tablets = ?,
           cost_paisa = ?, retail_paisa = ?, vip_paisa = ?, doctor_paisa = ?, reorder_level = ?,
           updated_at = datetime('now','localtime')
         WHERE id = ?`,
        [
          nextName,
          pickText(o["Generic"], cur.generic),
          pickText(o["Brand"], cur.brand),
          pickText(o["Barcode"], cur.barcode),
          companyId,
          categoryId,
          pickText(o["Rack"], cur.rack_no),
          pickText(o["Room"], cur.room),
          pickText(o["Base_Unit"], cur.base_unit) ?? "tablet",
          pickNum(o["Strips_in_Box"], cur.box_strips) ?? 1,
          pickNum(o["Tablets_in_Strip"], cur.strip_tablets) ?? 1,
          pickPaisa(o["Cost_Rs"], cur.cost_paisa),
          pickPaisa(o["Retail_Rs"], cur.retail_paisa),
          pickPaisa(o["VIP_Rs"], cur.vip_paisa),
          pickPaisa(o["Doctor_Rs"], cur.doctor_paisa),
          pickNum(o["Reorder_Level"], cur.reorder_level) ?? 0,
          found.id,
        ]
      );
      out.products++;
    }

    // ---- Customers ----
    for (const r of readSheet(buf, "Customers")) {
      if (!isChanged("Customers", r.rowNo)) { out.skipped++; continue; }
      const o = r.raw;
      const found = findCustomer(o["ID"], o["Phone"], o["Name"]);
      if (!found) { out.skipped++; continue; }
      const cur = get<Record<string, unknown>>("SELECT * FROM customers WHERE id = ?", [found.id]);
      if (!cur) { out.skipped++; continue; }
      const nm = val(o["Name"]);
      const name = nm.set && !nm.clear ? text(o["Name"]) : text(cur.name);
      if (!name) { out.skipped++; continue; }

      const pickText = (incoming: unknown, current: unknown) => {
        const v = val(incoming);
        if (!v.set) return text(current ?? "") || null;
        if (v.clear) return null;
        return v.raw;
      };
      const lim = val(o["Credit_Limit_Rs"]);
      const limit = lim.set ? (lim.clear ? 0 : toPaisa(lim.raw || "0")) : Number(cur.credit_limit_paisa ?? 0);

      run(
        `UPDATE customers SET name = ?, phone = ?, category = ?, credit_limit_paisa = ?, notes = ?
         WHERE id = ?`,
        [name, pickText(o["Phone"], cur.phone), pickText(o["Category"], cur.category) ?? "normal", limit, pickText(o["Notes"], cur.notes), found.id]
      );
      out.customers++;
    }

    // ---- Suppliers ----
    for (const r of readSheet(buf, "Suppliers")) {
      if (!isChanged("Suppliers", r.rowNo)) { out.skipped++; continue; }
      const o = r.raw;
      const found = findSupplier(o["ID"], o["Name"]);
      if (!found) { out.skipped++; continue; }
      const cur = get<Record<string, unknown>>("SELECT * FROM suppliers WHERE id = ?", [found.id]);
      if (!cur) { out.skipped++; continue; }
      const nm = val(o["Name"]);
      const name = nm.set && !nm.clear ? text(o["Name"]) : text(cur.name);
      if (!name) { out.skipped++; continue; }
      const pickText = (incoming: unknown, current: unknown) => {
        const v = val(incoming);
        if (!v.set) return text(current ?? "") || null;
        if (v.clear) return null;
        return v.raw;
      };
      run(
        `UPDATE suppliers SET name = ?, agency = ?, phone = ?, address = ? WHERE id = ?`,
        [name, pickText(o["Agency"], cur.agency), pickText(o["Phone"], cur.phone), pickText(o["Address"], cur.address), found.id]
      );
      out.suppliers++;
    }

    // ---- Categories ----
    for (const r of readSheet(buf, "Categories")) {
      if (!isChanged("Categories", r.rowNo)) { out.skipped++; continue; }
      const o = r.raw;
      const found = findCategory(o["ID"], o["Name"]);
      if (!found) { out.skipped++; continue; }
      const nm = val(o["Name"]);
      let name = nm.set && !nm.clear ? text(o["Name"]) : found.name;
      if (!name) { out.skipped++; continue; }

      let parentId: number | null = found.parent_id;
      const pv = val(o["Parent"]);
      if (pv.set) {
        if (pv.clear) parentId = null;
        else if (pv.raw) {
          const p = get<{ id: number }>("SELECT id FROM categories WHERE name = ? COLLATE NOCASE", [pv.raw]);
          parentId = p ? p.id : ensureCategory(pv.raw);
        }
      }
      // khud ko apna parent banana mana
      if (parentId === found.id) parentId = found.parent_id;

      run("UPDATE categories SET name = ?, parent_id = ? WHERE id = ?", [name, parentId, found.id]);
      out.categories++;
    }

    // ---- Companies ----
    for (const r of readSheet(buf, "Companies")) {
      if (!isChanged("Companies", r.rowNo)) { out.skipped++; continue; }
      const o = r.raw;
      const id = Number(text(o["ID"]));
      const found = (id > 0 && get<{ id: number; name: string }>("SELECT id, name FROM companies WHERE id = ?", [id])) ||
        get<{ id: number; name: string }>("SELECT id, name FROM companies WHERE name = ? COLLATE NOCASE", [text(o["Name"])]) || undefined;
      if (!found) { out.skipped++; continue; }
      const nm = val(o["Name"]);
      const name = nm.set && !nm.clear ? text(o["Name"]) : found.name;
      if (!name) { out.skipped++; continue; }
      run("UPDATE companies SET name = ? WHERE id = ?", [name, found.id]);
      out.companies++;
    }

    // ---- Stock (batches): sirf batch no / expiry / cost ----
    for (const r of readSheet(buf, "Stock")) {
      if (!isChanged("Stock", r.rowNo)) { out.skipped++; continue; }
      const o = r.raw;
      const id = Number(text(o["Batch_ID"]));
      if (!(id > 0)) { out.skipped++; continue; }
      const b = get<{ id: number; batch_no: string | null; expiry_ym: string | null; cost_paisa: number }>(
        "SELECT id, batch_no, expiry_ym, cost_paisa FROM batches WHERE id = ? AND active = 1",
        [id]
      );
      if (!b) { out.skipped++; continue; }
      const bn = val(o["Batch_No"]);
      const ex = val(o["Expiry"]);
      const cst = val(o["Cost_Rs"]);
      if (!bn.set && !ex.set && !cst.set) { out.skipped++; continue; }
      const batchNo = bn.set ? (bn.clear ? null : bn.raw) : b.batch_no;
      const expiry = ex.set ? (ex.clear ? null : ex.raw.replace("/", "-").slice(0, 7)) : b.expiry_ym;
      const cost = cst.set ? (cst.clear ? 0 : toPaisa(cst.raw || "0")) : Number(b.cost_paisa ?? 0);
      run("UPDATE batches SET batch_no = ?, expiry_ym = ?, cost_paisa = ? WHERE id = ?", [batchNo, expiry, cost, id]);
      out.batches++;
    }

    // ---- Settings (sirf tab jab owner ne kaha ho) ----
    if (opts.includeSettings) {
      for (const r of readSheet(buf, "Settings")) {
        if (!isChanged("Settings", r.rowNo)) { out.skipped++; continue; }
        const o = r.raw;
        const key = text(o["Key"]);
        if (!key || LOCKED_SETTINGS.includes(key)) { out.skipped++; continue; }
        const cur = get<{ value: string }>("SELECT value FROM settings WHERE key = ?", [key]);
        if (!cur) { out.skipped++; continue; }
        const v = val(o["Value"]);
        if (!v.set) { out.skipped++; continue; }
        const next = v.clear ? "" : v.raw;
        run("UPDATE settings SET value = ? WHERE key = ?", [JSON.stringify(parseSettingInput(next)), key]);
        out.settings++;
      }
    }
  });

  await audit({
    action: "update",
    userId: user?.id ?? null,
    userName: user?.name ?? null,
    entity: "bulk_update",
    module: "Import",
    before: null,
    after: {
      products: out.products,
      customers: out.customers,
      suppliers: out.suppliers,
      categories: out.categories,
      companies: out.companies,
      batches: out.batches,
      settings: out.settings,
      skipped: out.skipped,
    },
    details: out,
  });

  return out;
}
