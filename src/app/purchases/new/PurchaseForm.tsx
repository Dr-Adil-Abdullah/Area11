"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Plus, Save, Search, Trash2, Truck, X } from "lucide-react";
import { formatPKR, toPaisa } from "@/lib/money";

type Supplier = { id: number; name: string; agency: string | null; phone: string | null };

type PosBatch = { id: number; batch_no: string; expiry_ym: string | null; qty_base: number; status: string };
type PosProduct = {
  id: number;
  name: string;
  generic: string | null;
  brand: string | null;
  pack_size_label: string | null;
  base_unit: string;
  box_strips: number;
  strip_tablets: number;
  cost_paisa: number;
  retail_paisa: number;
  vip_paisa: number;
  doctor_paisa: number;
  stock_base: number;
  batches: PosBatch[];
};

type Row = {
  key: string;
  productId: number;
  name: string;
  unit: "box" | "strip" | "base";
  qty: string;
  batchNo: string;
  expiry: string; // YYYY-MM
  cost: string;
  retail: string;
  vip: string;
  doctor: string;
  isSample: boolean;
  pack: string;
};

function unitToBase(qty: number, unit: Row["unit"], boxStrips: number, stripTablets: number) {
  if (unit === "box") {
    const per = boxStrips > 0 && stripTablets > 0 ? boxStrips * stripTablets : boxStrips || 1;
    return qty * per;
  }
  if (unit === "strip") return qty * (stripTablets || 1);
  return qty;
}

export default function PurchaseForm({
  suppliers: initialSuppliers,
  nextCode,
}: {
  suppliers: Supplier[];
  nextCode: string;
}) {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [supplierId, setSupplierId] = useState<string>("");
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<Row[]>([]);
  const [discount, setDiscount] = useState("");
  const [paid, setPaid] = useState("");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<PosProduct[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ code: string; id: number; total: number } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [newSupplier, setNewSupplier] = useState("");
  const [showNewSupplier, setShowNewSupplier] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!search.trim()) {
        setResults([]);
        return;
      }
      const res = await fetch(`/api/pos/search?q=${encodeURIComponent(search)}&limit=8`, { cache: "no-store" });
      const data = await res.json();
      if (data.ok) {
        setResults(data.products ?? []);
        setShowResults(true);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [search]);

  function packLabel(p: PosProduct) {
    if (p.box_strips && p.strip_tablets) return `1 Box = ${p.box_strips} Strip = ${p.box_strips * p.strip_tablets} ${p.base_unit}`;
    if (p.strip_tablets) return `1 Strip = ${p.strip_tablets} ${p.base_unit}`;
    return p.base_unit;
  }

  function addProduct(p: PosProduct) {
    const unit: Row["unit"] = p.box_strips > 0 || p.strip_tablets > 0 ? "box" : "base";
    setRows((r) => [
      ...r,
      {
        key: `${p.id}-${Date.now()}`,
        productId: p.id,
        name: p.name,
        unit,
        qty: "1",
        batchNo: "",
        expiry: "",
        cost: p.cost_paisa ? String(p.cost_paisa / 100) : "",
        retail: p.retail_paisa ? String(p.retail_paisa / 100) : "",
        vip: p.vip_paisa ? String(p.vip_paisa / 100) : "",
        doctor: p.doctor_paisa ? String(p.doctor_paisa / 100) : "",
        isSample: false,
        pack: packLabel(p),
      },
    ]);
    setSearch("");
    setResults([]);
    setShowResults(false);
    searchRef.current?.focus();
  }

  function setRow(key: string, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function rowBase(r: Row) {
    const p = results.find((x) => x.id === r.productId);
    const boxStrips = p?.box_strips ?? 0;
    const stripTablets = p?.strip_tablets ?? 0;
    return unitToBase(Number(r.qty) || 0, r.unit, boxStrips, stripTablets);
  }

  const subtotal = rows.reduce((s, r) => s + toPaisa(r.cost || 0) * rowBase(r), 0);
  const discountPaisa = toPaisa(discount || 0);
  const total = Math.max(0, subtotal - discountPaisa);
  const paidPaisa = paid === "" ? total : Math.min(toPaisa(paid || 0), total);
  const due = Math.max(0, total - paidPaisa);

  async function addSupplier() {
    if (!newSupplier.trim()) return;
    const res = await fetch("/api/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newSupplier }),
    });
    const data = await res.json();
    if (data.ok) {
      const rc = await fetch("/api/suppliers", { cache: "no-store" });
      const rd = await rc.json();
      if (rd.ok) setSuppliers(rd.suppliers);
      setSupplierId(String(data.id));
      setNewSupplier("");
      setShowNewSupplier(false);
    }
  }

  async function save() {
    if (!rows.length) {
      setError("Add at least one item.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const payload = {
        supplierId: supplierId ? Number(supplierId) : null,
        supplierInvoiceNo: supplierInvoiceNo || null,
        date,
        discountPaisa,
        paidPaisa,
        notes: notes || null,
        items: rows.map((r) => ({
          productId: r.productId,
          unit: r.unit,
          qty: Number(r.qty) || 0,
          batchNo: r.batchNo || null,
          expiryDate: r.expiry || null,
          costPaisa: toPaisa(r.cost || 0),
          retailPaisa: toPaisa(r.retail || 0),
          vipPaisa: toPaisa(r.vip || 0),
          doctorPaisa: toPaisa(r.doctor || 0),
          isSample: r.isSample,
        })),
      };
      const res = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Save failed");
      setDone({ code: data.code, id: data.id, total: data.totalPaisa });
      setRows([]);
      setDiscount("");
      setPaid("");
      setNotes("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">New purchase (Stock-In)</h1>
          <p className="text-sm text-slate-500">
            Bill: <span className="font-medium text-slate-700">{nextCode}</span> • stock and batches are created
            automatically when you save.
          </p>
        </div>
        <Link href="/purchases" className="btn-secondary">Back to purchases</Link>
      </div>

      {done && (
        <div className="card border-l-4 border-emerald-400">
          <div className="card-body flex flex-wrap items-center gap-3">
            <Check className="h-5 w-5 text-emerald-600" />
            <div className="text-sm text-slate-700">
              <span className="font-semibold">{done.code}</span> saved • stock added • total {formatPKR(done.total)}
            </div>
            <Link href={`/receipt/${done.id}?type=purchase`} className="btn-secondary">
              View bill
            </Link>
            <button className="btn-ghost" onClick={() => setDone(null)}>Dismiss</button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="card">
        <div className="card-body grid gap-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className="label">Supplier</label>
            <div className="flex gap-2">
              <select className="select" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">— none —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.agency ? ` (${s.agency})` : ""}
                  </option>
                ))}
              </select>
              <button className="btn-secondary whitespace-nowrap" onClick={() => setShowNewSupplier((v) => !v)}>
                <Plus className="h-4 w-4" /> New
              </button>
            </div>
            {showNewSupplier && (
              <div className="mt-2 flex gap-2">
                <input
                  className="input-sm flex-1"
                  placeholder="Supplier name (quick add)"
                  value={newSupplier}
                  onChange={(e) => setNewSupplier(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addSupplier()}
                  autoFocus
                />
                <button className="btn-secondary !px-2" onClick={addSupplier}>
                  <Check className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
          <div>
            <label className="label">Supplier invoice no</label>
            <input className="input" value={supplierInvoiceNo} onChange={(e) => setSupplierInvoiceNo(e.target.value)} placeholder="optional" />
          </div>
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Item search */}
      <div className="card">
        <div className="card-head">
          <div className="card-title">Add items — search medicine by name, salt or barcode</div>
          <Link href="/products" className="text-xs text-slate-500 underline" target="_blank">
            Product not in list? Add it
          </Link>
        </div>
        <div className="card-body">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              ref={searchRef}
              className="input pl-9"
              placeholder="Start typing… (e.g. panadol, paracetamol, 5012345)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => results.length && setShowResults(true)}
            />
            {showResults && results.length > 0 && (
              <div className="absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                {results.map((p) => (
                  <button
                    key={p.id}
                    className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 text-left hover:bg-slate-50"
                    onClick={() => addProduct(p)}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-800">{p.name}</div>
                      <div className="truncate text-[11px] text-slate-500">
                        {[p.generic, p.brand, p.pack_size_label].filter(Boolean).join(" • ")} • {packLabel(p)}
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-xs text-slate-500">
                      <div>cost {formatPKR(p.cost_paisa)}</div>
                      <div>retail {formatPKR(p.retail_paisa)}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="card">
        <div className="card-head">
          <div className="card-title">Items ({rows.length})</div>
          {rows.length > 0 && (
            <button className="btn-ghost text-rose-600" onClick={() => setRows([])}>
              Clear all
            </button>
          )}
        </div>
        <div className="overflow-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Product</th>
                <th className="w-28">Unit</th>
                <th className="w-24">Qty</th>
                <th className="w-32">Batch no</th>
                <th className="w-32">Expiry</th>
                <th className="w-28">Cost</th>
                <th className="w-28">Retail</th>
                <th className="text-right">Line total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td>
                    <div className="text-sm font-medium text-slate-800">{r.name}</div>
                    <div className="text-[11px] text-slate-500">{r.pack}</div>
                  </td>
                  <td>
                    <select className="select !py-1 !text-xs" value={r.unit} onChange={(e) => setRow(r.key, { unit: e.target.value as Row["unit"] })}>
                      <option value="box">Box</option>
                      <option value="strip">Strip</option>
                      <option value="base">Base</option>
                    </select>
                  </td>
                  <td>
                    <input type="number" min="0" step="1" className="input !py-1 !text-xs" value={r.qty} onChange={(e) => setRow(r.key, { qty: e.target.value })} />
                  </td>
                  <td>
                    <input className="input !py-1 !text-xs" placeholder="e.g. A123" value={r.batchNo} onChange={(e) => setRow(r.key, { batchNo: e.target.value })} />
                  </td>
                  <td>
                    <input type="month" className="input !py-1 !text-xs" value={r.expiry} onChange={(e) => setRow(r.key, { expiry: e.target.value })} />
                  </td>
                  <td>
                    <input type="number" step="0.01" className="input !py-1 !text-xs" value={r.cost} onChange={(e) => setRow(r.key, { cost: e.target.value })} />
                  </td>
                  <td>
                    <input type="number" step="0.01" className="input !py-1 !text-xs" value={r.retail} onChange={(e) => setRow(r.key, { retail: e.target.value })} />
                  </td>
                  <td className="text-right text-sm text-slate-700">
                    {formatPKR(toPaisa(r.cost || 0) * rowBase(r))}
                    <div className="text-[11px] text-slate-400">{rowBase(r)} {r.unit === "base" ? "units" : "base units"}</div>
                  </td>
                  <td>
                    <button className="btn-ghost !px-2 text-rose-600" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-sm text-slate-500">
                    Search above and click a medicine to add it here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Totals */}
      <div className="card">
        <div className="card-body grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div>
              <label className="label">Bill discount (Rs)</label>
              <input type="number" step="0.01" className="input" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className="label">Paid now (Rs)</label>
              <input type="number" step="0.01" className="input" value={paid} onChange={(e) => setPaid(e.target.value)} placeholder={String(total / 100)} />
            </div>
            <div>
              <label className="label">Notes</label>
              <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="optional" />
            </div>
            {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
          </div>

          <div className="space-y-2 rounded-lg bg-slate-50 p-4">
            <div className="flex justify-between text-sm text-slate-600">
              <span>Subtotal</span>
              <span>{formatPKR(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-600">
              <span>Discount</span>
              <span>- {formatPKR(discountPaisa)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-800">
              <span>Total</span>
              <span>{formatPKR(total)}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-600">
              <span>Paid now</span>
              <span>{formatPKR(paidPaisa)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Remaining (added to supplier account)</span>
              <span className={due > 0 ? "font-medium text-rose-600" : "text-slate-500"}>{formatPKR(due)}</span>
            </div>

            <button className="btn-primary mt-3 w-full" onClick={save} disabled={busy || !rows.length}>
              <Save className="h-4 w-4" /> {busy ? "Saving…" : "Save purchase & add stock"}
            </button>
            <p className="flex items-center gap-1 text-[11px] text-slate-500">
              <Truck className="h-3 w-3" /> Stock, batches and supplier balance are all updated automatically.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
