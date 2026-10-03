// ---------------------------------------------------------------------------
// Area11 - Excel se purana data laane ka system (Q-19)
// ---------------------------------------------------------------------------
// Kaam ka tareeqa:
//   1) buildTemplateFile()  -> khaali (namoona) Excel file
//   2) previewImport(buf)   -> pehle SIRF dikhata hai: kaunsi line theek hai,
//                              kaunsi galat (dry-run) -- kuch DB me nahi jata
//   3) commitImport(buf)    -> sirf theek lines DB me daalta hai (ek hi
//                              transaction, is liye aadha-adhoora import nahi hota)
// ---------------------------------------------------------------------------

import * as XLSX from "xlsx";
import { get, run, tx } from "./db";
import { createCategory, createCompany, createProduct, createSupplier } from "./catalog";
import { createCustomer } from "./customers";
import { toBaseUnits } from "./money";
import { audit } from "./audit";

// ------------------------------- columns -----------------------------------

type ColSpec = {
  key: string;
  header: string;
  required?: boolean;
  hint: string;
};

export const PRODUCT_COLS: ColSpec[] = [
  { key: "name", header: "Name", required: true, hint: "Dawa ka naam (zaroori)" },
  { key: "generic", header: "Generic", hint: "Salt / generic naam" },
  { key: "company", header: "Company", hint: "Company (nayi ho to khud ban jayegi)" },
  { key: "category", header: "Category", hint: "Jaise Tablet / Syrup (khud ban jayegi)" },
  { key: "brand", header: "Brand", hint: "Brand naam" },
  { key: "barcode", header: "Barcode", hint: "Scanner wala number" },
  { key: "rack", header: "Rack", hint: "Rack / shelf number" },
  { key: "boxStrips", header: "Strips_in_Box", hint: "1 box me kitni strip? (na ho to 1)" },
  { key: "stripTablets", header: "Tablets_in_Strip", hint: "1 strip me kitni goli? (na ho to 1)" },
  { key: "baseUnit", header: "Base_Unit", hint: "tablet / piece / ml / gm" },
  { key: "cost", header: "Cost", hint: "Kharid rate RUPEY me (12.50 likh sakte hain)" },
  { key: "retail", header: "Retail", hint: "Aam grahak rate (rupey)" },
  { key: "vip", header: "VIP", hint: "VIP rate (khali chhod sakte hain)" },
  { key: "doctor", header: "Doctor", hint: "Doctor rate (khali chhod sakte hain)" },
  { key: "reorder", header: "Reorder_Level", hint: "Kitni goli bach jaye to alert?" },
  { key: "openingQty", header: "Opening_Qty", hint: "Aaj jitna stock mojood hai" },
  { key: "openingUnit", header: "Opening_Unit", hint: "box / strip / tablet" },
  { key: "batchNo", header: "Batch_No", hint: "Batch number (khali ho to OPEN)" },
  { key: "expiry", header: "Expiry", hint: "YYYY-MM ya MM/YYYY (jaise 2027-06)" },
];

export const CUSTOMER_COLS: ColSpec[] = [
  { key: "name", header: "Name", required: true, hint: "Gahak ka naam (zaroori)" },
  { key: "phone", header: "Phone", hint: "Mobile number" },
  { key: "category", header: "Category", hint: "normal / vip / doctor" },
  { key: "creditLimit", header: "Credit_Limit", hint: "Udhaar ki hadd (rupey, 0 = koi hadd nahi)" },
  { key: "balance", header: "Balance", hint: "Gahak se lena hai jo purana udhaar (rupey)" },
];

export const SUPPLIER_COLS: ColSpec[] = [
  { key: "name", header: "Name", required: true, hint: "Supplier ka naam (zaroori)" },
  { key: "agency", header: "Agency", hint: "Agency / firm ka naam" },
  { key: "phone", header: "Phone", hint: "Mobile / landline" },
  { key: "address", header: "Address", hint: "Pata" },
  { key: "balance", header: "Balance", hint: "Supplier ko hum ne dena hai (rupey, +)" },
];

const SHEET_PRODUCTS = "Products";
const SHEET_CUSTOMERS = "Customers";
const SHEET_SUPPLIERS = "Suppliers";
const SHEET_HELP = "Instructions";

const EXAMPLE = {
  Products: {
    Name: "Panadol 500mg", Generic: "Paracetamol", Company: "GSK", Category: "Tablet",
    Brand: "Panadol", Barcode: "8964000123456", Rack: "A-1", Strips_in_Box: 10,
    Tablets_in_Strip: 10, Base_Unit: "tablet", Cost: 5.0, Retail: 6.75, VIP: 6.5,
    Doctor: 6.0, Reorder_Level: 100, Opening_Qty: 2, Opening_Unit: "box",
    Batch_No: "B-1102", Expiry: "2027-06",
  },
  Customers: { Name: "Ali Raza", Phone: "03001234567", Category: "normal", Credit_Limit: 5000, Balance: 0 },
  Suppliers: { Name: "Rashid Medicine Agency", Agency: "Rashid & Co", Phone: "03007654321", Address: "Main Bazar", Balance: 25000 },
};

// ------------------------------- helpers -----------------------------------

function normHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return v;
  const s = String(v).replace(/[,\s]/g, "").replace(/^rs\.?/i, "");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/** Rupey -> paisa (12.5 -> 1250). Galat likha ho to NaN */
function money(v: unknown): number | null {
  const n = num(v);
  if (n === null) return null;
  if (Number.isNaN(n)) return NaN;
  return Math.round(n * 100);
}

function text(v: unknown): string {
  return v === null || v === undefined ? "" : String(v).trim();
}

function yes(v: unknown, fallback = true): boolean {
  const s = text(v).toLowerCase();
  if (!s) return fallback;
  return ["yes", "y", "1", "true", "haan", "han", "ji"].includes(s);
}

/** expiry: 2027-06 | 06/2027 | 6-2027 | 2027-06-15 -> "2027-06" + "2027-06-15" */
export function parseExpiry(raw: unknown): { ym: string | null; date: string | null; problem?: string } {
  const s = text(raw);
  if (!s) return { ym: null, date: null };
  let y = 0, m = 0, d = 0;
  let mm = /^(\d{4})[-/.](\d{1,2})$/.exec(s);            // 2027-06
  if (mm) { y = +mm[1]; m = +mm[2]; }
  if (!mm) {
    mm = /^(\d{1,2})[-/.](\d{4})$/.exec(s);              // 06/2027
    if (mm) { y = +mm[2]; m = +mm[1]; }
  }
  if (!y) {
    const full = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s); // 2027-06-15
    if (full) { y = +full[1]; m = +full[2]; d = +full[3]; }
  }
  if (!y || m < 1 || m > 12) return { ym: null, date: null, problem: `Expiry "${s}" samajh nahi aayi (YYYY-MM likhein)` };
  const ym = `${y}-${String(m).padStart(2, "0")}`;
  const date = d ? `${ym}-${String(d).padStart(2, "0")}` : null;
  return { ym, date };
}

function rowsOf(wb: XLSX.WorkBook, sheetName: string, cols: ColSpec[]): { rowNo: number; raw: Record<string, unknown> }[] {
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return [];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: true });
  const map: Record<string, string> = {};
  for (const c of cols) map[normHeader(c.header)] = c.key;
  const out: { rowNo: number; raw: Record<string, unknown> }[] = [];
  json.forEach((j, i) => {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(j)) {
      const key = map[normHeader(k)];
      if (key) obj[key] = v;
    }
    const hasAny = Object.values(obj).some((v) => text(v) !== "");
    if (hasAny) out.push({ rowNo: i + 2, raw: obj }); // +2 = Excel ki asal line (header pehli)
  });
  return out;
}

// ------------------------------- template -----------------------------------

export function buildTemplateFile(): Buffer {
  const wb = XLSX.utils.book_new();

  const add = (name: string, cols: ColSpec[], example: Record<string, unknown>) => {
    const header = cols.map((c) => c.header);
    const ws = XLSX.utils.aoa_to_sheet([header, header.map((h) => example[h] ?? "")]);
    ws["!cols"] = header.map((h) => ({ wch: Math.max(12, h.length + 2) }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  add(SHEET_PRODUCTS, PRODUCT_COLS, EXAMPLE.Products);
  add(SHEET_CUSTOMERS, CUSTOMER_COLS, EXAMPLE.Customers);
  add(SHEET_SUPPLIERS, SUPPLIER_COLS, EXAMPLE.Suppliers);

  const help: string[][] = [
    ["Area11 — purana data Excel se laana (namoona file)"],
    [""],
    ["Tareeqa:"],
    ["1. Har sheet me apna data bharein. Pehli line (header) ko na badlein, na hataein."],
    ["2. Namoona line (jo abhi example ke tor par likhi hai) ko mita dein ya apne data se badal dein."],
    ["3. Jo cheez maloom na ho, khali chhod dein — app khud munasib default laga degi."],
    ["4. File save karein (.xlsx), phir app me Safha 'Import' par ja kar upload karein."],
    ["5. App pehle POORA PREVIEW dikhayegi (kaunsi line theek, kaunsi galat). Jab tak aap 'Import karein' na dabayein, database me kuch nahi jayega."],
    [""],
    ["Ahem baatein:"],
    ["• Rate (Cost/Retail) RUPEY me likhein, jaise 6.75 — app khud paisa (675) bana legi."],
    ["• Products sheet me Opening_Qty + Opening_Unit se purana stock bhi aa jayega (ek batch ke tor par)."],
    ["• Customers sheet ka Balance = gahak se lena hai (purana udhaar)."],
    ["• Suppliers sheet ka Balance = supplier ko dena hai."],
    ["• Jo naam pehle se app me hain, woh line 'skip' ho jayegi (dobara nahi banegi)."],
    [""],
    ["Sheets ki tafseel:"],
  ];
  for (const [sheetName, cols] of [
    [SHEET_PRODUCTS, PRODUCT_COLS],
    [SHEET_CUSTOMERS, CUSTOMER_COLS],
    [SHEET_SUPPLIERS, SUPPLIER_COLS],
  ] as [string, ColSpec[]][]) {
    help.push([`— ${sheetName}`]);
    for (const c of cols) help.push([`   ${c.header}${c.required ? " *" : ""}`, c.hint]);
    help.push([""]);
  }
  const wsHelp = XLSX.utils.aoa_to_sheet(help);
  wsHelp["!cols"] = [{ wch: 24 }, { wch: 70 }];
  XLSX.utils.book_append_sheet(wb, wsHelp, SHEET_HELP);

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

// ------------------------------- preview ------------------------------------

export type RowStatus = "ok" | "skip" | "error";

export type PreviewRow = {
  sheet: string;
  rowNo: number;
  status: RowStatus;
  title: string;
  messages: string[];
  /** jo DB me jayega (sirf status=ok par) */
  data?: Record<string, unknown>;
};

export type ImportPreview = {
  sheets: { name: string; found: boolean; ok: number; skip: number; error: number }[];
  rows: PreviewRow[];
  totals: { ok: number; skip: number; error: number };
  empty: boolean;
};

function validateProducts(wb: XLSX.WorkBook): PreviewRow[] {
  const out: PreviewRow[] = [];
  const seen = new Set<string>();
  for (const { rowNo, raw } of rowsOf(wb, SHEET_PRODUCTS, PRODUCT_COLS)) {
    const messages: string[] = [];
    const name = text(raw.name);
    if (!name) {
      out.push({ sheet: SHEET_PRODUCTS, rowNo, status: "error", title: "(naam nahi)", messages: ["Name khali hai"] });
      continue;
    }
    const key = name.toLowerCase();
    if (seen.has(key)) {
      out.push({ sheet: SHEET_PRODUCTS, rowNo, status: "error", title: name, messages: ["Isi file me yeh naam pehle aa chuka hai"] });
      continue;
    }
    seen.add(key);

    const cost = money(raw.cost);
    const retail = money(raw.retail);
    if (cost !== null && Number.isNaN(cost)) messages.push("Cost samajh nahi aaya");
    if (retail !== null && Number.isNaN(retail)) messages.push("Retail samajh nahi aaya");

    const baseUnit = text(raw.baseUnit) || "tablet";
    const boxStrips = Math.max(0, Math.round(num(raw.boxStrips) ?? 1) || 1);
    const stripTablets = Math.max(0, Math.round(num(raw.stripTablets) ?? 1) || 1);

    const qtyRaw = num(raw.openingQty);
    const unitRaw = (text(raw.openingUnit) || "tablet").toLowerCase();
    if (qtyRaw !== null && Number.isNaN(qtyRaw)) messages.push("Opening_Qty samajh nahi aayi");
    const qty = qtyRaw === null || Number.isNaN(qtyRaw) ? 0 : qtyRaw;
    let qtyBase = 0;
    if (qty > 0) {
      const unit = unitRaw.startsWith("box") ? "box" : unitRaw.startsWith("strip") ? "strip" : "base";
      qtyBase = toBaseUnits(qty, unit, boxStrips, stripTablets);
    }

    const exp = parseExpiry(raw.expiry);
    if (exp.problem) messages.push(exp.problem);

    // Pehle se mojood?
    const dup = get<{ id: number }>(`SELECT id FROM products WHERE lower(name) = ? AND active = 1 LIMIT 1`, [key]);
    if (dup) {
      out.push({ sheet: SHEET_PRODUCTS, rowNo, status: "skip", title: name, messages: messages.concat("Pehle se app me mojood hai — chhod diya") });
      continue;
    }

    const fatal = messages.some((m) => m.includes("samajh nahi"));
    out.push({
      sheet: SHEET_PRODUCTS,
      rowNo,
      status: fatal ? "error" : "ok",
      title: name,
      messages: messages.concat(
        qtyBase > 0 ? `Purana stock: ${qtyBase} ${baseUnit}${exp.ym ? ` (expiry ${exp.ym})` : ""}` : "Stock 0"
      ),
      data: {
        name, generic: text(raw.generic) || null, company: text(raw.company) || null,
        category: text(raw.category) || null, brand: text(raw.brand) || null,
        barcode: text(raw.barcode) || null, rack: text(raw.rack) || null,
        baseUnit, boxStrips, stripTablets,
        costPaisa: cost && !Number.isNaN(cost) ? cost : 0,
        retailPaisa: retail && !Number.isNaN(retail) ? retail : 0,
        vipPaisa: (() => { const v = money(raw.vip); return v && !Number.isNaN(v) ? v : 0; })(),
        doctorPaisa: (() => { const v = money(raw.doctor); return v && !Number.isNaN(v) ? v : 0; })(),
        reorderLevel: Math.max(0, Math.round(num(raw.reorder) ?? 0) || 0),
        qtyBase, batchNo: text(raw.batchNo) || "OPEN",
        expiryYm: exp.ym, expiryDate: exp.date,
        trackExpiry: yes(raw.trackExpiry, true),
      },
    });
  }
  return out;
}

function validateCustomers(wb: XLSX.WorkBook): PreviewRow[] {
  const out: PreviewRow[] = [];
  for (const { rowNo, raw } of rowsOf(wb, SHEET_CUSTOMERS, CUSTOMER_COLS)) {
    const name = text(raw.name);
    const phone = text(raw.phone);
    if (!name) { out.push({ sheet: SHEET_CUSTOMERS, rowNo, status: "error", title: "(naam nahi)", messages: ["Name khali hai"] }); continue; }
    const bal = money(raw.balance) ?? 0;
    const lim = money(raw.creditLimit) ?? 0;
    if (Number.isNaN(bal) || Number.isNaN(lim)) {
      out.push({ sheet: SHEET_CUSTOMERS, rowNo, status: "error", title: name, messages: ["Balance ya Credit_Limit samajh nahi aaya"] });
      continue;
    }
    const cat = (text(raw.category) || "normal").toLowerCase();
    const category = ["normal", "vip", "doctor"].includes(cat) ? cat : "normal";
    const messages: string[] = [`Purana udhaar: Rs ${(bal / 100).toFixed(2)}`];
    if (category !== cat) messages.push("Category samajh nahi aayi — 'normal' lagaya");
    const dup = phone
      ? get<{ id: number }>(`SELECT id FROM customers WHERE phone = ? AND active = 1 LIMIT 1`, [phone])
      : undefined;
    if (dup) {
      out.push({ sheet: SHEET_CUSTOMERS, rowNo, status: "skip", title: name, messages: [`Phone ${phone} pehle se mojood hai — chhod diya`] });
      continue;
    }
    out.push({
      sheet: SHEET_CUSTOMERS, rowNo, status: "ok", title: name, messages,
      data: { name, phone: phone || null, category, creditLimitPaisa: lim, balancePaisa: bal },
    });
  }
  return out;
}

function validateSuppliers(wb: XLSX.WorkBook): PreviewRow[] {
  const out: PreviewRow[] = [];
  for (const { rowNo, raw } of rowsOf(wb, SHEET_SUPPLIERS, SUPPLIER_COLS)) {
    const name = text(raw.name);
    if (!name) { out.push({ sheet: SHEET_SUPPLIERS, rowNo, status: "error", title: "(naam nahi)", messages: ["Name khali hai"] }); continue; }
    const bal = money(raw.balance) ?? 0;
    if (Number.isNaN(bal)) { out.push({ sheet: SHEET_SUPPLIERS, rowNo, status: "error", title: name, messages: ["Balance samajh nahi aaya"] }); continue; }
    const dup = get<{ id: number }>(`SELECT id FROM suppliers WHERE lower(name) = ? AND active = 1 LIMIT 1`, [name.toLowerCase()]);
    if (dup) {
      out.push({ sheet: SHEET_SUPPLIERS, rowNo, status: "skip", title: name, messages: ["Pehle se app me mojood hai — chhod diya"] });
      continue;
    }
    out.push({
      sheet: SHEET_SUPPLIERS, rowNo, status: "ok", title: name,
      messages: [`Hum ne dena hai: Rs ${(bal / 100).toFixed(2)}`],
      data: { name, agency: text(raw.agency) || null, phone: text(raw.phone) || null, address: text(raw.address) || null, balancePaisa: bal },
    });
  }
  return out;
}

export function previewImport(buf: Buffer): ImportPreview {
  const wb = XLSX.read(buf, { type: "buffer" });
  const rows = [
    ...validateProducts(wb),
    ...validateCustomers(wb),
    ...validateSuppliers(wb),
  ];
  const sheets = [
    { name: SHEET_PRODUCTS, cols: PRODUCT_COLS },
    { name: SHEET_CUSTOMERS, cols: CUSTOMER_COLS },
    { name: SHEET_SUPPLIERS, cols: SUPPLIER_COLS },
  ].map(({ name }) => {
    const mine = rows.filter((r) => r.sheet === name);
    return {
      name,
      found: !!wb.Sheets[name],
      ok: mine.filter((r) => r.status === "ok").length,
      skip: mine.filter((r) => r.status === "skip").length,
      error: mine.filter((r) => r.status === "error").length,
    };
  });
  const totals = {
    ok: sheets.reduce((n, s) => n + s.ok, 0),
    skip: sheets.reduce((n, s) => n + s.skip, 0),
    error: sheets.reduce((n, s) => n + s.error, 0),
  };
  return { sheets, rows, totals, empty: rows.length === 0 };
}

// ------------------------------- commit ------------------------------------

export type ImportResult = { products: number; customers: number; suppliers: number; batches: number; stockBase: number };

export async function commitImport(buf: Buffer, user?: { id?: number; name?: string }): Promise<ImportResult> {
  const preview = previewImport(buf);
  const good = preview.rows.filter((r) => r.status === "ok");

  const result: ImportResult = { products: 0, customers: 0, suppliers: 0, batches: 0, stockBase: 0 };

  tx(() => {
    for (const row of good) {
      const d = row.data as Record<string, any>;
      if (row.sheet === SHEET_PRODUCTS) {
        const companyId = d.company ? createCompany(String(d.company)) : null;
        const categoryId = d.category ? createCategory(String(d.category)) : null;
        const id = createProduct(
          {
            name: d.name, generic: d.generic, brand: d.brand, barcode: d.barcode,
            companyId, categoryId, rackNo: d.rack, baseUnit: d.baseUnit,
            boxStrips: d.boxStrips, stripTablets: d.stripTablets,
            costPaisa: d.costPaisa, retailPaisa: d.retailPaisa,
            vipPaisa: d.vipPaisa, doctorPaisa: d.doctorPaisa,
            reorderLevel: d.reorderLevel, trackExpiry: d.trackExpiry,
          },
          user
        );
        result.products++;
        if (d.qtyBase > 0) {
          const b = run(
            `INSERT INTO batches (product_id, batch_no, expiry_date, expiry_ym, qty_base, cost_paisa, retail_paisa, vip_paisa, doctor_paisa)
             VALUES (?,?,?,?,?,?,?,?,?)`,
            [id, d.batchNo, d.expiryDate, d.expiryYm, d.qtyBase, d.costPaisa, d.retailPaisa, d.vipPaisa, d.doctorPaisa]
          );
          run(
            `INSERT INTO stock_movements (product_id, batch_id, type, qty_base, ref_type, ref_code, note, user_id)
             VALUES (?,?,?,?,?,?,?,?)`,
            [id, b.lastInsertRowid, "in", d.qtyBase, "import", "IMPORT", "Excel import (purana stock)", user?.id ?? null]
          );
          result.batches++;
          result.stockBase += d.qtyBase;
        }
      } else if (row.sheet === SHEET_CUSTOMERS) {
        const id = createCustomer({ name: d.name, phone: d.phone, category: d.category, creditLimitPaisa: d.creditLimitPaisa });
        if (d.balancePaisa > 0) run(`UPDATE customers SET balance_paisa = ? WHERE id = ?`, [d.balancePaisa, id]);
        result.customers++;
      } else if (row.sheet === SHEET_SUPPLIERS) {
        const id = createSupplier({ name: d.name, agency: d.agency, phone: d.phone, address: d.address });
        if (d.balancePaisa > 0) {
          run(`UPDATE suppliers SET opening_balance_paisa = ?, balance_paisa = ? WHERE id = ?`, [d.balancePaisa, d.balancePaisa, id]);
        }
        result.suppliers++;
      }
    }
  });

  await audit({
    action: "create",
    userId: user?.id ?? null,
    userName: user?.name ?? null,
    entity: "Import",
    details: { ...result, skipped: preview.totals.skip, errors: preview.totals.error },
  });

  return result;
}

/** preview me jo products "ok" the unka stock base nikalne ke liye chhota helper */
export function previewStockBase(preview: ImportPreview): number {
  return preview.rows
    .filter((r) => r.sheet === SHEET_PRODUCTS && r.status === "ok")
    .reduce((n, r) => n + Number((r.data?.qtyBase as number) ?? 0), 0);
}
