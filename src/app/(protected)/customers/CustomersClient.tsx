"use client";
import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HandCoins, Pencil, Plus, Save, X } from "lucide-react";
import { formatPKR, toPaisa } from "@/lib/money";
import type { CustomField } from "@/lib/custom-fields-shared";

type C = { id: number; name: string; phone: string | null; category: string; balance_paisa: number; credit_limit_paisa: number };

export default function CustomersClient({
  initial,
  initialCustom,
}: {
  initial: C[];
  initialCustom?: Record<string, Record<string, string>>;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [f, setF] = useState({ name: "", phone: "", category: "normal", limit: "" });
  const [pay, setPay] = useState<{ id: number; amt: string } | null>(null);
  const [edit, setEdit] = useState<{ id: number; name: string; phone: string; category: string; limit: string } | null>(null);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [newCustom, setNewCustom] = useState<Record<string, string>>({});
  const [editCustom, setEditCustom] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const owed = rows.reduce((a, c) => a + Math.max(0, c.balance_paisa), 0);

  useEffect(() => {
    void (async () => {
      const r = await (await fetch("/api/custom-fields?entity=customer", { cache: "no-store" })).json();
      if (r.ok) setCustomFields(r.fields);
    })();
  }, []);

  async function reload() { const r = await (await fetch("/api/customers", { cache: "no-store" })).json(); if (r.ok) setRows(r.customers); router.refresh(); }
  async function call(url: string, body: unknown) {
    setMsg("");
    const r = await (await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
    if (!r.ok) { setMsg(r.error); return false; }
    return true;
  }
  async function add() {
    if (!f.name.trim()) return setMsg("Name is required.");
    if (await call("/api/customers", { name: f.name, phone: f.phone || null, category: f.category, creditLimitPaisa: toPaisa(f.limit || 0), custom: newCustom })) {
      setF({ name: "", phone: "", category: "normal", limit: "" });
      setNewCustom({});
      reload();
    }
  }
  async function saveEdit() {
    if (!edit) return;
    if (!edit.name.trim()) return setMsg("Name is required.");
    setMsg("");
    const r = await (await fetch("/api/customers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: edit.id,
        name: edit.name.trim(),
        phone: edit.phone.trim() || null,
        category: edit.category,
        creditLimitPaisa: toPaisa(edit.limit || 0),
        custom: editCustom,
      }),
    })).json();
    if (!r.ok) return setMsg(r.error ?? "Update failed.");
    setEdit(null);
    reload();
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
        {customFields.length > 0 && (
          <div className="md:col-span-5 grid gap-3 md:grid-cols-3">
            {customFields.map((cf) => (
              <div key={cf.id}>
                <label className="label">{cf.label}{cf.required ? " *" : ""}</label>
                {cf.type === "select" ? (
                  <select className="select" value={newCustom[String(cf.id)] ?? ""} onChange={(e) => setNewCustom({ ...newCustom, [String(cf.id)]: e.target.value })}>
                    <option value="">— chunein —</option>
                    {cf.options.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : cf.type === "check" ? (
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={(newCustom[String(cf.id)] ?? "") === "1"} onChange={(e) => setNewCustom({ ...newCustom, [String(cf.id)]: e.target.checked ? "1" : "0" })} /> Haan
                  </label>
                ) : (
                  <input
                    className="input"
                    type={cf.type === "number" ? "number" : cf.type === "date" ? "date" : "text"}
                    value={newCustom[String(cf.id)] ?? ""}
                    onChange={(e) => setNewCustom({ ...newCustom, [String(cf.id)]: e.target.value })}
                  />
                )}
              </div>
            ))}
          </div>
        )}
        {msg && <div className="md:col-span-5 text-sm text-rose-600">{msg}</div>}
      </div>
      <div className="card overflow-auto">
        <table className="tbl"><thead><tr><th>Customer</th><th>Phone</th><th>Type</th><th className="text-right">Limit</th><th className="text-right">Owes</th><th></th></tr></thead>
          <tbody>
            {rows.map((c) => (
              <Fragment key={c.id}>
              {edit?.id === c.id ? (
                <tr key={c.id} className="bg-amber-50">
                  <td>
                    <input
                      autoFocus
                      className="input-sm"
                      value={edit.name}
                      onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                      onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                    />
                  </td>
                  <td>
                    <input
                      className="input-sm"
                      placeholder="Phone"
                      value={edit.phone}
                      onChange={(e) => setEdit({ ...edit, phone: e.target.value })}
                    />
                  </td>
                  <td>
                    <select className="select !py-1 !text-xs" value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })}>
                      <option value="normal">normal</option>
                      <option value="vip">vip</option>
                      <option value="doctor">doctor</option>
                    </select>
                  </td>
                  <td className="text-right">
                    <input
                      className="input-sm w-24 text-right"
                      placeholder="Rs"
                      value={edit.limit}
                      onChange={(e) => setEdit({ ...edit, limit: e.target.value })}
                    />
                  </td>
                  <td className={`text-right font-medium ${c.balance_paisa > 0 ? "text-rose-600" : ""}`}>{formatPKR(c.balance_paisa)}</td>
                  <td className="text-right">
                    <span className="inline-flex gap-1">
                      <button className="btn-primary !py-1" onClick={saveEdit}><Save className="h-4 w-4" /> Save</button>
                      <button className="btn-ghost !py-1" onClick={() => setEdit(null)}><X className="h-4 w-4" /></button>
                    </span>
                  </td>
                </tr>
              ) : null}
              {edit?.id === c.id && customFields.length > 0 ? (
                <tr key={`${c.id}-custom`} className="bg-amber-50">
                  <td colSpan={6} className="grid gap-3 md:grid-cols-3">
                    {customFields.map((cf) => (
                      <div key={cf.id}>
                        <label className="label">{cf.label}{cf.required ? " *" : ""}</label>
                        {cf.type === "select" ? (
                          <select className="select" value={editCustom[String(cf.id)] ?? ""} onChange={(e) => setEditCustom({ ...editCustom, [String(cf.id)]: e.target.value })}>
                            <option value="">— chunein —</option>
                            {cf.options.map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : cf.type === "check" ? (
                          <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={(editCustom[String(cf.id)] ?? "") === "1"} onChange={(e) => setEditCustom({ ...editCustom, [String(cf.id)]: e.target.checked ? "1" : "0" })} /> Haan
                          </label>
                        ) : (
                          <input
                            className="input"
                            type={cf.type === "number" ? "number" : cf.type === "date" ? "date" : "text"}
                            value={editCustom[String(cf.id)] ?? ""}
                            onChange={(e) => setEditCustom({ ...editCustom, [String(cf.id)]: e.target.value })}
                          />
                        )}
                      </div>
                    ))}
                  </td>
                </tr>
              ) : null}
              {edit?.id === c.id ? null : (
              <tr>
                <td className="font-medium">
                  <Link href={`/customers/${c.id}`} className="hover:underline">{c.name}</Link>
                </td>
                <td>{c.phone ?? "—"}</td><td className="text-xs">{c.category}</td>
                <td className="text-right text-xs">{c.credit_limit_paisa ? formatPKR(c.credit_limit_paisa) : "—"}</td>
                <td className={`text-right font-medium ${c.balance_paisa > 0 ? "text-rose-600" : ""}`}>{formatPKR(c.balance_paisa)}</td>
                <td className="text-right">
                  {pay?.id === c.id ? (
                    <span className="inline-flex gap-1"><input autoFocus className="input-sm w-28" placeholder="Rs" value={pay.amt} onChange={(e) => setPay({ id: c.id, amt: e.target.value })} />
                      <button className="btn-primary !py-1" onClick={receive}>Receive</button><button className="btn-ghost" onClick={() => setPay(null)}>×</button></span>
                  ) : (
                    <span className="inline-flex gap-1">
                      {c.balance_paisa > 0 && (
                        <button className="btn-secondary !py-1" onClick={() => setPay({ id: c.id, amt: String(c.balance_paisa / 100) })}>
                          <HandCoins className="h-4 w-4" /> Receive payment
                        </button>
                      )}
                      <button
                        className="btn-ghost !py-1"
                        title="Gahak ki tafseel badlein"
                        onClick={() => {
                          setEdit({ id: c.id, name: c.name, phone: c.phone ?? "", category: c.category, limit: c.credit_limit_paisa ? String(c.credit_limit_paisa / 100) : "" });
                          setEditCustom({ ...(initialCustom?.[String(c.id)] ?? {}) });
                        }}
                      >
                        <Pencil className="h-4 w-4" /> Edit
                      </button>
                    </span>
                  )}
                </td>
              </tr>
              )}
              </Fragment>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-sm text-slate-500">No customers yet.</td></tr>}
          </tbody></table>
      </div>
    </div>
  );
}
