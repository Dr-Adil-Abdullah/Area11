"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Pencil, Save, Search, Trash2, Truck, X } from "lucide-react";
import { formatPKR, toPaisa } from "@/lib/money";

type Supplier = {
  id: number;
  name: string;
  agency: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  balance_paisa: number;
};

const empty = { id: 0, name: "", agency: "", phone: "", address: "", notes: "", opening: "" };

export default function SuppliersClient({ initialSuppliers }: { initialSuppliers: Supplier[] }) {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ ...empty });
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((s) =>
      [s.name, s.agency, s.phone].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))
    );
  }, [suppliers, search]);

  async function reload() {
    const res = await fetch("/api/suppliers", { cache: "no-store" });
    const data = await res.json();
    if (data.ok) setSuppliers(data.suppliers);
    router.refresh();
  }

  async function save() {
    if (!form.name.trim()) {
      setError("Supplier name is required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const payload = {
        id: form.id || undefined,
        name: form.name,
        agency: form.agency || null,
        phone: form.phone || null,
        address: form.address || null,
        notes: form.notes || null,
      };
      const res = await fetch("/api/suppliers", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Save failed");
      setShowForm(false);
      setForm({ ...empty });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function payNow(s: Supplier) {
    const v = prompt(`Pay ${s.name}. Amount in Rs (we owe ${(s.balance_paisa / 100).toFixed(2)}):`, String(Math.max(0, s.balance_paisa) / 100));
    if (!v) return;
    const r = await (await fetch("/api/suppliers/pay", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ supplierId: s.id, amountPaisa: toPaisa(v) }) })).json();
    if (!r.ok) alert(r.error); else await reload();
  }

  async function remove(s: Supplier) {
    if (!confirm(`Remove supplier "${s.name}"? Old purchase records stay safe.`)) return;
    setBusy(true);
    try {
      await fetch(`/api/suppliers?id=${s.id}`, { method: "DELETE" });
      await reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Suppliers</h1>
          <p className="text-sm text-slate-500">
            Distributors / agencies. Balances update automatically with every purchase and payment.
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => {
            setForm({ ...empty });
            setShowForm(true);
          }}
        >
          <Plus className="h-4 w-4" /> Add supplier
        </button>
      </div>

      {showForm && (
        <div className="card">
          <div className="card-head">
            <div className="card-title">{form.id ? "Edit supplier" : "New supplier"}</div>
            <button className="btn-ghost" onClick={() => setShowForm(false)}>
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="card-body grid gap-4 md:grid-cols-3">
            <div>
              <label className="label">Name *</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
            </div>
            <div>
              <label className="label">Agency / company</label>
              <input className="input" value={form.agency} onChange={(e) => setForm({ ...form, agency: e.target.value })} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className="label">Address</label>
              <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div>
              <label className="label">Notes</label>
              <input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>

            {error && <div className="md:col-span-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

            <div className="md:col-span-3 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn-primary" onClick={save} disabled={busy}>
                <Save className="h-4 w-4" /> {busy ? "Saving…" : "Save supplier"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <div className="card-title">Supplier list</div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
            <input
              className="input-sm w-64 pl-8"
              placeholder="Search supplier…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Supplier</th>
              <th>Phone</th>
              <th className="text-right">Balance (we owe)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td>
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-slate-400" />
                    <div>
                      <Link href={`/suppliers/${s.id}`} className="font-medium text-slate-800 hover:underline">{s.name}</Link>
                      <div className="text-[11px] text-slate-500">{s.agency || s.address || "—"}</div>
                    </div>
                  </div>
                </td>
                <td className="text-slate-600">{s.phone || "—"}</td>
                <td className={`text-right font-medium ${s.balance_paisa > 0 ? "text-rose-600" : "text-slate-600"}`}>
                  {formatPKR(s.balance_paisa)}
                </td>
                <td>
                  <div className="flex justify-end gap-1">
                    <button
                      className="btn-ghost !px-2"
                      onClick={() => {
                        setForm({
                          id: s.id,
                          name: s.name,
                          agency: s.agency ?? "",
                          phone: s.phone ?? "",
                          address: s.address ?? "",
                          notes: s.notes ?? "",
                          opening: "",
                        });
                        setShowForm(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {s.balance_paisa > 0 && <button className="btn-secondary !py-1 !text-xs" onClick={() => payNow(s)}>Pay</button>}
                    <button className="btn-ghost !px-2 text-rose-600" onClick={() => remove(s)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="py-10 text-center text-sm text-slate-500">
                  No suppliers yet. Add the distributors you buy from.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        Note: {formatPKR(toPaisa("0"))} — balances are automatically updated when you record purchases or payments.
      </p>
    </div>
  );
}
