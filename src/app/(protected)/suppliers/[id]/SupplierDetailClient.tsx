"use client";

// Area11 - supplier ki poori tafseel: khata, bills, payments, returns + wapas bhejna
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HandCoins, PackagePlus, Pencil, Plus, Save, Undo2, X } from "lucide-react";
import { formatPKR, toPaisa } from "@/lib/money";
import type { CustomField } from "@/lib/custom-fields-shared";

type Ledger = {
  supplier: {
    id: number; name: string; agency: string | null; phone: string | null;
    address: string | null; notes: string | null;
    opening_balance_paisa: number; balance_paisa: number; created_at: string;
  };
  purchases: {
    id: number; code: string; date: string; total_paisa: number;
    paid_paisa: number; due_paisa: number; supplier_invoice_no: string | null; items: number;
  }[];
  payments: { id: number; date: string; method: string; amount_paisa: number; note: string | null }[];
  returns: {
    id: number; code: string; date: string; total_paisa: number;
    reason: string | null; note: string | null; settled: number; items?: number;
  }[];
  stats: {
    bills: number; boughtPaisa: number; paidPaisa: number;
    returnedPaisa: number; outstandingPaisa: number; lastPurchaseAt: string | null;
  };
};

type Batch = { id: number; batch_no: string; qty_base: number; expiry_ym: string | null; cost_paisa: number };
type Product = { id: number; name: string; batches: Batch[] };

const REASONS = [
  ["expired", "Expiry ho gayi"], ["damaged", "Kharaab / toota"], ["wrong_item", "Ghalat maal bheja"],
  ["overstock", "Zarurat se zyada"], ["rate_issue", "Rate ka masla"], ["other", "Koi aur wajah"],
] as const;

export default function SupplierDetailClient({
  ledger, products, fields, custom,
}: {
  ledger: Ledger; products: Product[]; fields: CustomField[]; custom: Record<string, string>;
}) {
  const router = useRouter();
  const s = ledger.supplier;
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({
    name: s.name, agency: s.agency ?? "", phone: s.phone ?? "",
    address: s.address ?? "", notes: s.notes ?? "",
  });
  const [cf, setCf] = useState<Record<string, string>>(custom);
  const [tab, setTab] = useState<"bills" | "payments" | "returns">("bills");
  const [pay, setPay] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  // Wapas bhejne wala form
  const [showReturn, setShowReturn] = useState(false);
  const [rProduct, setRProduct] = useState("");
  const [rBatch, setRBatch] = useState("");
  const [rQty, setRQty] = useState("");
  const [rReason, setRReason] = useState<string>("expired");
  const [rNote, setRNote] = useState("");
  const [rCash, setRCash] = useState(false);
  const [rLines, setRLines] = useState<
    { productId: number; batchId: number | null; name: string; batchNo: string; qtyBase: number; costPaisa: number }[]
  >([]);

  const selectedBatches: Batch[] = rProduct
    ? (products.find((p) => String(p.id) === rProduct)?.batches ?? [])
    : [];

  async function save() {
    setBusy(true); setMsg("");
    try {
      const r = await (await fetch("/api/suppliers", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: s.id, name: f.name, agency: f.agency || null, phone: f.phone || null, address: f.address || null, notes: f.notes || null }),
      })).json();
      if (!r.ok) throw new Error(r.error);
      setEdit(false); router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "save failed");
    } finally { setBusy(false); }
  }

  async function paySupplier() {
    const amt = toPaisa(pay || 0);
    if (!(amt > 0)) return setMsg("Raqam likhein.");
    setBusy(true); setMsg("");
    try {
      const r = await (await fetch("/api/suppliers/pay", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplierId: s.id, amountPaisa: amt, note: "Supplier ko adaigi" }),
      })).json();
      if (!r.ok) throw new Error(r.error);
      setPay(""); router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "failed");
    } finally { setBusy(false); }
  }

  function addLine() {
    const p = products.find((x) => String(x.id) === rProduct);
    if (!p) return setMsg("Dawa chunein.");
    const qty = Number(rQty);
    if (!(qty > 0)) return setMsg("Miqdar likhein.");
    const b = rBatch ? selectedBatches.find((x) => String(x.id) === rBatch) : null;
    if (rBatch && !b) return setMsg("Batch chunein.");
    if (b && qty > b.qty_base) return setMsg(`Is batch me sirf ${b.qty_base} hain.`);
    setRLines((l) => [...l, { productId: p.id, batchId: b?.id ?? null, name: p.name, batchNo: b?.batch_no ?? "—", qtyBase: qty, costPaisa: b?.cost_paisa ?? 0 }]);
    setRQty(""); setRBatch("");
    setMsg("");
  }

  async function submitReturn() {
    if (rLines.length === 0) return setMsg("Kam az kam ek dawa shamil karein.");
    setBusy(true); setMsg("");
    try {
      const r = await (await fetch("/api/supplier-returns", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: s.id, reason: rReason, note: rNote || null, settled: rCash,
          lines: rLines.map((l) => ({ productId: l.productId, batchId: l.batchId, qtyBase: l.qtyBase, costPaisa: l.costPaisa })),
        }),
      })).json();
      if (!r.ok) throw new Error(r.error);
      setMsg(`Return ${r.code} darj ho gaya — ${formatPKR(r.totalPaisa)} ka maal wapas gaya.`);
      setRLines([]); setRNote(""); setRCash(false); setShowReturn(false);
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "failed");
    } finally { setBusy(false); }
  }

  const owes = ledger.stats.outstandingPaisa;

  return (
    <div className="space-y-4 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">{s.name}</h1>
          <p className="text-sm text-slate-500">
            {s.agency ? `${s.agency} · ` : ""}{s.phone ?? "no phone"} · {ledger.stats.bills} bills
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/suppliers" className="btn-secondary">← All suppliers</Link>
          <button className="btn-primary" onClick={() => setShowReturn((v) => !v)}>
            <Undo2 className="h-4 w-4" /> Maal wapas bhejein
          </button>
        </div>
      </div>

      {msg && <div className={`rounded px-3 py-2 text-sm ${msg.includes("gaya") ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"}`}>{msg}</div>}

      {/* Supplier ko maal wapas */}
      {showReturn && (
        <div className="card card-body space-y-3">
          <div className="card-title">Maal wapas bhejein (expiry / damaged / ghalat maal)</div>
          <div className="grid gap-2 md:grid-cols-5">
            <select className="select" value={rProduct} onChange={(e) => { setRProduct(e.target.value); setRBatch(""); }}>
              <option value="">Dawa chunein</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select className="select" value={rBatch} onChange={(e) => setRBatch(e.target.value)}>
              <option value="">Batch (ikhtiyari)</option>
              {selectedBatches.map((b) => (
                <option key={b.id} value={b.id}>{b.batch_no} — {b.qty_base} (exp {b.expiry_ym ?? "—"})</option>
              ))}
            </select>
            <input className="input" type="number" placeholder="Miqdar" value={rQty} onChange={(e) => setRQty(e.target.value)} />
            <select className="select" value={rReason} onChange={(e) => setRReason(e.target.value)}>
              {REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <button className="btn-secondary" onClick={addLine}><Plus className="h-4 w-4" /> Add</button>
          </div>
          {rLines.length > 0 && (
            <table className="tbl">
              <thead><tr><th>Dawa</th><th>Batch</th><th className="text-right">Qty</th><th className="text-right">Qeemat</th><th></th></tr></thead>
              <tbody>
                {rLines.map((l, i) => (
                  <tr key={i}>
                    <td>{l.name}</td>
                    <td className="text-xs">{l.batchNo}</td>
                    <td className="text-right">{l.qtyBase}</td>
                    <td className="text-right">{formatPKR(l.costPaisa * l.qtyBase)}</td>
                    <td className="text-right"><button className="text-rose-600" onClick={() => setRLines((x) => x.filter((_, j) => j !== i))}><X className="h-4 w-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="grid gap-2 md:grid-cols-3">
            <input className="input" placeholder="Tafseel / note" value={rNote} onChange={(e) => setRNote(e.target.value)} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={rCash} onChange={(e) => setRCash(e.target.checked)} />
              Naqad wapas mil gaya (warnah balance kam hoga)
            </label>
            <button className="btn-primary" onClick={submitReturn} disabled={busy}><Save className="h-4 w-4" /> Return darj karein</button>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Profile */}
        <div className="card card-body space-y-2">
          <div className="card-title">Tafseel</div>
          {edit ? (
            <div className="grid gap-2">
              <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Naam" />
              <input className="input" value={f.agency} onChange={(e) => setF({ ...f, agency: e.target.value })} placeholder="Agency" />
              <input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="Phone" />
              <input className="input" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} placeholder="Pata" />
              <textarea className="input" rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Note" />
              <div className="flex gap-2">
                <button className="btn-primary" onClick={save} disabled={busy}><Save className="h-4 w-4" /> Save</button>
                <button className="btn-ghost" onClick={() => setEdit(false)}><X className="h-4 w-4" /> Cancel</button>
              </div>
            </div>
          ) : (
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Phone</span><span>{s.phone ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Agency</span><span>{s.agency ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Pata</span><span className="text-right">{s.address ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Opening balance</span><span>{formatPKR(s.opening_balance_paisa)}</span></div>
              {s.notes && <p className="rounded bg-slate-50 p-2 text-xs">{s.notes}</p>}
              <button className="btn-secondary mt-1" onClick={() => setEdit(true)}><Pencil className="h-4 w-4" /> Edit</button>
            </div>
          )}
          {fields.length > 0 && (
            <div className="mt-2 space-y-2 border-t pt-2">
              {fields.map((c) => (
                <div key={c.id}>
                  <label className="label">{c.label}</label>
                  {c.type === "check" ? (
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={(cf[String(c.id)] ?? "") === "1"} onChange={(e) => setCf({ ...cf, [String(c.id)]: e.target.checked ? "1" : "0" })} /> Haan
                    </label>
                  ) : (
                    <input className="input" value={cf[String(c.id)] ?? ""} readOnly />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Khata */}
        <div className="card card-body space-y-1">
          <div className="card-title mb-1">Khata</div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Baqaya</span>
            <span className={`font-semibold ${owes > 0 ? "text-rose-600" : owes < 0 ? "text-emerald-700" : ""}`}>
              {owes > 0 ? `Hum ne dena: ${formatPKR(owes)}` : owes < 0 ? `Wo denge: ${formatPKR(-owes)}` : "Saaf"}
            </span>
          </div>
          <div className="flex justify-between text-sm"><span className="text-slate-500">Khareeda</span><span>{formatPKR(ledger.stats.boughtPaisa)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-slate-500">Adaigi</span><span>{formatPKR(ledger.stats.paidPaisa)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-slate-500">Wapas bheja</span><span>{formatPKR(ledger.stats.returnedPaisa)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-slate-500">Aakhri khareed</span><span>{ledger.stats.lastPurchaseAt?.slice(0, 10) ?? "—"}</span></div>
          <div className="mt-2 flex gap-2">
            <input className="input-sm w-28" placeholder="Rs" value={pay} onChange={(e) => setPay(e.target.value)} />
            <button className="btn-primary" onClick={paySupplier} disabled={busy}><HandCoins className="h-4 w-4" /> Adaigi</button>
          </div>
        </div>

        {/* Quick */}
        <div className="card card-body space-y-2">
          <div className="card-title">Jaldi kaam</div>
          <Link href="/purchases" className="btn-secondary"><PackagePlus className="h-4 w-4" /> Nayi khareed (PINV)</Link>
          <p className="text-xs text-slate-500">
            Maal wapas bhejne se stock **nikal** jata hai aur supplier ka balance **kam** ho jata hai.
            Agar balance pehle se 0 ho to wo humein dene lagega (credit note).
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="card-head">
          <div className="flex gap-2">
            {(["bills", "payments", "returns"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`rounded px-3 py-1 text-sm ${tab === t ? "bg-slate-800 text-white" : "bg-slate-100"}`}>
                {t === "bills" ? `Bills (${ledger.purchases.length})` : t === "payments" ? `Payments (${ledger.payments.length})` : `Returns (${ledger.returns.length})`}
              </button>
            ))}
          </div>
        </div>
        <div className="card-body overflow-auto">
          {tab === "bills" && (
            <table className="tbl">
              <thead><tr><th>Bill</th><th>Tareekh</th><th>Supplier inv.</th><th className="text-right">Items</th><th className="text-right">Total</th><th className="text-right">Baqaya</th></tr></thead>
              <tbody>
                {ledger.purchases.map((p) => (
                  <tr key={p.id}>
                    <td className="font-medium">{p.code}</td>
                    <td className="text-xs">{p.date.slice(0, 16)}</td>
                    <td className="text-xs">{p.supplier_invoice_no ?? "—"}</td>
                    <td className="text-right">{p.items}</td>
                    <td className="text-right">{formatPKR(p.total_paisa)}</td>
                    <td className={`text-right ${p.due_paisa > 0 ? "text-rose-600" : ""}`}>{formatPKR(p.due_paisa)}</td>
                  </tr>
                ))}
                {ledger.purchases.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-sm text-slate-500">Koi khareed nahi.</td></tr>}
              </tbody>
            </table>
          )}
          {tab === "payments" && (
            <table className="tbl">
              <thead><tr><th>Tareekh</th><th>Tarika</th><th className="text-right">Raqam</th><th>Note</th></tr></thead>
              <tbody>
                {ledger.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="text-xs">{p.date.slice(0, 16)}</td>
                    <td className="text-xs">{p.method}</td>
                    <td className={`text-right ${p.amount_paisa < 0 ? "text-rose-600" : ""}`}>{formatPKR(p.amount_paisa)}</td>
                    <td className="text-xs text-slate-500">{p.note ?? "—"}</td>
                  </tr>
                ))}
                {ledger.payments.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-sm text-slate-500">Koi adaigi nahi.</td></tr>}
              </tbody>
            </table>
          )}
          {tab === "returns" && (
            <table className="tbl">
              <thead><tr><th>Return</th><th>Tareekh</th><th>Wajah</th><th className="text-right">Qeemat</th><th>Halat</th></tr></thead>
              <tbody>
                {ledger.returns.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium">{r.code}</td>
                    <td className="text-xs">{r.date.slice(0, 16)}</td>
                    <td className="text-xs">{REASONS.find((x) => x[0] === r.reason)?.[1] ?? r.reason ?? "—"}</td>
                    <td className="text-right">{formatPKR(r.total_paisa)}</td>
                    <td className="text-xs">{r.settled ? "Naqad wapas mila" : "Balance kam hua"}</td>
                  </tr>
                ))}
                {ledger.returns.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-sm text-slate-500">Koi return nahi.</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
