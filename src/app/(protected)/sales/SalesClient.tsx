"use client";
import { Fragment, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, Receipt, Search, Undo2 } from "lucide-react";
import { formatPKR } from "@/lib/money";
import ProvisionalCard from "./ProvisionalCard";

type Sale = { id: number; code: string; date: string; customer_name: string | null; items: number; total_paisa: number; status: string; payment_method: string; profit_paisa: number };
type Item = { id: number; name: string; qty_base: number; returned_qty: number };

type Prov = { pending: number; returns: Parameters<typeof ProvisionalCard>[0]["initial"]["returns"] };

export default function SalesClient({ sales, from, to, q, filters, provisional }: {
  sales: Sale[];
  from: string;
  to: string;
  q: string;
  filters: { method: string; status: string; margin: string; min: string; sort: string; all: boolean };
  provisional: Prov;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<number | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [qty, setQty] = useState<Record<number, string>>({});
  const [restock, setRestock] = useState(false);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const live = sales.filter((s) => s.status !== "void");
  const total = live.reduce((a, s) => a + s.total_paisa, 0);
  const profit = live.reduce((a, s) => a + s.profit_paisa, 0);

  async function openReturn(id: number) {
    if (open === id) return setOpen(null);
    const r = await (await fetch(`/api/sales/${id}`, { cache: "no-store" })).json();
    if (r.ok) { setItems(r.items); setQty({}); setMsg(""); setReason(""); setRestock(false); setOpen(id); }
  }
  async function post(url: string, body: unknown) {
    setBusy(true); setMsg("");
    try {
      const r = await (await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
      if (!r.ok) throw new Error(r.error);
      return r;
    } catch (e) { setMsg(e instanceof Error ? e.message : "failed"); return null; } finally { setBusy(false); }
  }
  async function doReturn(id: number) {
    const lines = items.map((i) => ({ saleItemId: i.id, qtyBase: Number(qty[i.id]) || 0, restock })).filter((l) => l.qtyBase > 0);
    const r = await post(`/api/sales/${id}/return`, { lines, reason });
    if (r) {
      setOpen(null);
      alert(
        `Refund ${formatPKR(r.refundPaisa)} (cash back ${formatPKR(r.cashBackPaisa)}, credit reduced ${formatPKR(r.creditReducedPaisa)})` +
        (r.restockBlocked ? "\n\nNote: stock me wapas daalne ka ikhtiyar sirf owner/manager ke paas hai — maal QUARANTINE me rakha gaya." : "")
      );
      router.refresh();
    }
  }
  async function doVoid(s: Sale) {
    const why = prompt(`Void ${s.code}? Stock will be restored and money refunded.\nReason:`);
    if (why === null) return;
    const r = await post(`/api/sales/${s.id}/void`, { reason: why });
    if (r) router.refresh(); else alert(msg);
  }

  return (
    <div className="space-y-4">
      <ProvisionalCard initial={provisional} />
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Sales history</h1>
        <p className="text-sm text-slate-500">Find any bill, reprint it, return items or void it. Originals are never edited.</p>
      </div>
      <form className="card card-body flex flex-wrap items-end gap-3" method="get">
        <div><label className="label">From</label><input type="date" name="from" defaultValue={from} className="input" /></div>
        <div><label className="label">To</label><input type="date" name="to" defaultValue={to} className="input" /></div>
        <div className="flex-1 min-w-48"><label className="label">Bill no / customer / phone / dawa</label><input name="q" defaultValue={q} className="input" placeholder="INV-0001 ya Panadol" /></div>
        <div>
          <label className="label">Payment</label>
          <select name="method" defaultValue={filters.method} className="select">
            <option value="all">Sab</option><option value="cash">Cash</option><option value="credit">Udhaar</option>
          </select>
        </div>
        <div>
          <label className="label">Halat</label>
          <select name="status" defaultValue={filters.status} className="select">
            <option value="all">Sab</option><option value="paid">Paid</option><option value="due">Baqaya</option>
            <option value="void">Cancelled</option><option value="returned">Wapas hua</option>
          </select>
        </div>
        <div>
          <label className="label">Munafa</label>
          <select name="margin" defaultValue={filters.margin} className="select">
            <option value="all">Sab</option><option value="profit">Munafa wale</option><option value="loss">Nuqsan wale</option>
          </select>
        </div>
        <div><label className="label">Kam se kam Rs</label><input name="min" defaultValue={filters.min} className="input w-28" placeholder="0" /></div>
        <div>
          <label className="label">Tarteeb</label>
          <select name="sort" defaultValue={filters.sort} className="select">
            <option value="recent">Naye pehle</option><option value="oldest">Purane pehle</option>
            <option value="biggest">Bare bill pehle</option><option value="profit">Zyada munafa pehle</option>
          </select>
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" name="all" value="1" defaultChecked={filters.all} /> Poori tarikh</label>
        <button className="btn-primary"><Search className="h-4 w-4" /> Show</button>
      </form>
      <div className="grid grid-cols-3 gap-3">
        <div className="card card-body"><div className="text-xs text-slate-500">Bills</div><div className="text-lg font-semibold">{live.length}</div></div>
        <div className="card card-body"><div className="text-xs text-slate-500">Sales total</div><div className="text-lg font-semibold">{formatPKR(total)}</div></div>
        <div className="card card-body"><div className="text-xs text-slate-500">Profit (before returns)</div><div className="text-lg font-semibold text-emerald-700">{formatPKR(profit)}</div></div>
      </div>
      <div className="card overflow-auto">
        <table className="tbl">
          <thead><tr><th>Bill</th><th>Time</th><th>Customer</th><th>Pay</th><th className="text-right">Items</th><th className="text-right">Total</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {sales.map((s) => (
              <Fragment key={s.id}>
                <tr className={s.status === "void" ? "opacity-50" : ""}>
                  <td className="font-medium">{s.code}</td>
                  <td className="text-xs text-slate-500">{s.date.slice(0, 16)}</td>
                  <td>{s.customer_name ?? "Walk-in"}</td>
                  <td className="text-xs">{s.payment_method}</td>
                  <td className="text-right">{s.items}</td>
                  <td className="text-right font-medium">{formatPKR(s.total_paisa)}</td>
                  <td><span className={s.status === "void" ? "badge-red" : s.status === "paid" ? "badge-green" : "badge-amber"}>{s.status}</span></td>
                  <td className="whitespace-nowrap text-right">
                    <Link href={`/receipt/${s.id}`} target="_blank" className="btn-ghost !px-2" title="Reprint"><Receipt className="h-4 w-4" /></Link>
                    {s.status !== "void" && <>
                      <button className="btn-ghost !px-2" title="Return items" onClick={() => openReturn(s.id)}><Undo2 className="h-4 w-4" /></button>
                      <button className="btn-ghost !px-2 text-rose-600" title="Void bill" onClick={() => doVoid(s)}><Ban className="h-4 w-4" /></button></>}
                  </td>
                </tr>
                {open === s.id && (
                  <tr><td colSpan={8} className="bg-slate-50">
                    <div className="space-y-2 p-3">
                      <div className="text-sm font-medium">Return items from {s.code} (quantity in smallest units)</div>
                      {items.map((i) => (
                        <div key={i.id} className="flex items-center gap-3 text-sm">
                          <span className="w-64 truncate">{i.name}</span>
                          <span className="text-xs text-slate-500">
                            sold {i.qty_base} · returned {i.returned_qty} ·{" "}
                            <b className="text-emerald-700">baqi {Math.max(0, i.qty_base - i.returned_qty)}</b>
                          </span>
                          <input
                            className="input-sm w-24"
                            type="number"
                            min={0}
                            max={Math.max(0, i.qty_base - i.returned_qty)}
                            placeholder="0"
                            value={qty[i.id] ?? ""}
                            onChange={(e) => {
                              const left = Math.max(0, i.qty_base - i.returned_qty);
                              const v = Number(e.target.value);
                              setQty({ ...qty, [i.id]: v > left ? String(left) : e.target.value });
                            }}
                          />
                          {Number(qty[i.id]) > Math.max(0, i.qty_base - i.returned_qty) && (
                            <span className="text-xs text-rose-600">hadd se zyada</span>
                          )}
                        </div>))}
                      <div className="flex flex-wrap items-center gap-3">
                        <input className="input-sm w-64" placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
                        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} /> Put back in stock (only if inspected &amp; not expired). Unticked = quarantine.</label>
                        <button className="btn-primary" disabled={busy} onClick={() => doReturn(s.id)}>Refund</button>
                      </div>
                      {msg && <div className="text-xs text-rose-600">{msg}</div>}
                    </div></td></tr>)}
              </Fragment>))}
            {sales.length === 0 && <tr><td colSpan={8} className="py-10 text-center text-sm text-slate-500">No bills in this period.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
