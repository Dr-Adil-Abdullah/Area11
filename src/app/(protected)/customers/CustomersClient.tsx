"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { HandCoins, Plus } from "lucide-react";
import { formatPKR, toPaisa } from "@/lib/money";

type C = { id: number; name: string; phone: string | null; category: string; balance_paisa: number; credit_limit_paisa: number };

export default function CustomersClient({ initial }: { initial: C[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [f, setF] = useState({ name: "", phone: "", category: "normal", limit: "" });
  const [pay, setPay] = useState<{ id: number; amt: string } | null>(null);
  const [msg, setMsg] = useState("");
  const owed = rows.reduce((a, c) => a + Math.max(0, c.balance_paisa), 0);

  async function reload() { const r = await (await fetch("/api/customers", { cache: "no-store" })).json(); if (r.ok) setRows(r.customers); router.refresh(); }
  async function call(url: string, body: unknown) {
    setMsg("");
    const r = await (await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
    if (!r.ok) { setMsg(r.error); return false; }
    return true;
  }
  async function add() {
    if (!f.name.trim()) return setMsg("Name is required.");
    if (await call("/api/customers", { name: f.name, phone: f.phone || null, category: f.category, creditLimitPaisa: toPaisa(f.limit || 0) })) { setF({ name: "", phone: "", category: "normal", limit: "" }); reload(); }
  }
  async function receive() {
    if (!pay) return;
    if (await call("/api/customers/pay", { customerId: pay.id, amountPaisa: toPaisa(pay.amt || 0) })) { setPay(null); reload(); }
  }

  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-semibold text-slate-800">Customers &amp; credit (udhaar)</h1>
        <p className="text-sm text-slate-500">Total to collect: <span className="font-semibold text-rose-600">{formatPKR(owed)}</span></p></div>
      <div className="card card-body grid gap-3 md:grid-cols-5">
        <input className="input" placeholder="Name *" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input className="input" placeholder="Phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        <select className="select" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}><option value="normal">Normal</option><option value="vip">VIP</option><option value="doctor">Doctor</option></select>
        <input className="input" placeholder="Credit limit Rs (0 = none)" value={f.limit} onChange={(e) => setF({ ...f, limit: e.target.value })} />
        <button className="btn-primary" onClick={add}><Plus className="h-4 w-4" /> Add customer</button>
        {msg && <div className="md:col-span-5 text-sm text-rose-600">{msg}</div>}
      </div>
      <div className="card overflow-auto">
        <table className="tbl"><thead><tr><th>Customer</th><th>Phone</th><th>Type</th><th className="text-right">Limit</th><th className="text-right">Owes</th><th></th></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td className="font-medium">{c.name}</td><td>{c.phone ?? "—"}</td><td className="text-xs">{c.category}</td>
                <td className="text-right text-xs">{c.credit_limit_paisa ? formatPKR(c.credit_limit_paisa) : "—"}</td>
                <td className={`text-right font-medium ${c.balance_paisa > 0 ? "text-rose-600" : ""}`}>{formatPKR(c.balance_paisa)}</td>
                <td className="text-right">
                  {pay?.id === c.id ? (
                    <span className="inline-flex gap-1"><input autoFocus className="input-sm w-28" placeholder="Rs" value={pay.amt} onChange={(e) => setPay({ id: c.id, amt: e.target.value })} />
                      <button className="btn-primary !py-1" onClick={receive}>Receive</button><button className="btn-ghost" onClick={() => setPay(null)}>×</button></span>
                  ) : c.balance_paisa > 0 && <button className="btn-secondary !py-1" onClick={() => setPay({ id: c.id, amt: String(c.balance_paisa / 100) })}><HandCoins className="h-4 w-4" /> Receive payment</button>}
                </td>
              </tr>))}
            {rows.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-sm text-slate-500">No customers yet.</td></tr>}
          </tbody></table>
      </div>
    </div>
  );
}
