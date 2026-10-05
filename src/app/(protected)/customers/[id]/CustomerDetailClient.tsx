"use client";

// Area11 - gahak ki poori tafseel: profile + photo + apni fields + khata + bills
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, HandCoins, Pencil, Receipt, Save, X } from "lucide-react";
import { formatPKR, toPaisa } from "@/lib/money";
import type { CustomField } from "@/lib/custom-fields-shared";
import type { getCustomerDetail } from "@/lib/details";

type Detail = NonNullable<ReturnType<typeof getCustomerDetail>>;

/** Photo chhoti kar ke data-URL banao (DB me mehfooz, offline bhi chalti hai) */
async function shrink(file: File, max = 512): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  c.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  return c.toDataURL("image/jpeg", 0.72);
}

export default function CustomerDetailClient({
  detail,
  fields,
}: {
  detail: Detail;
  fields: CustomField[];
}) {
  const router = useRouter();
  const c = detail.customer;
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({
    name: c.name, phone: c.phone ?? "", category: c.category,
    limit: c.credit_limit_paisa ? String(c.credit_limit_paisa / 100) : "", notes: c.notes ?? "",
  });
  const [custom, setCustom] = useState<Record<string, string>>(detail.custom);
  const [pay, setPay] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"bills" | "payments" | "returns">("bills");

  async function save() {
    setBusy(true); setMsg("");
    try {
      const r = await (await fetch("/api/customers", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: c.id, name: f.name, phone: f.phone || null, category: f.category,
          creditLimitPaisa: toPaisa(f.limit || 0), notes: f.notes || null, custom,
        }),
      })).json();
      if (!r.ok) throw new Error(r.error);
      setEdit(false); router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "save failed");
    } finally { setBusy(false); }
  }

  async function uploadPhoto(file: File) {
    setBusy(true); setMsg("");
    try {
      const dataUrl = await shrink(file);
      const r = await (await fetch("/api/customers", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: c.id, photo: dataUrl }),
      })).json();
      if (!r.ok) throw new Error(r.error);
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "photo failed");
    } finally { setBusy(false); }
  }

  async function receive() {
    const amt = toPaisa(pay || 0);
    if (!(amt > 0)) return setMsg("Raqam likhein.");
    setBusy(true); setMsg("");
    try {
      const r = await (await fetch("/api/customers/pay", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: c.id, amountPaisa: amt, note: "Counter par wasool" }),
      })).json();
      if (!r.ok) throw new Error(r.error);
      setPay(""); router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "failed");
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-800">{c.name}</h1>
        <Link href="/customers" className="btn-secondary">← All customers</Link>
      </div>

      {msg && <div className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{msg}</div>}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Profile */}
        <div className="card card-body space-y-3">
          <div className="flex items-center gap-3">
            <label className="relative block h-20 w-20 cursor-pointer overflow-hidden rounded-full bg-slate-100">
              {c.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.photo} alt={c.name} className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-2xl font-semibold text-slate-400">
                  {c.name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="absolute bottom-0 right-0 rounded-full bg-slate-800 p-1 text-white"><Camera className="h-3.5 w-3.5" /></span>
              <input
                type="file" accept="image/*" className="hidden"
                onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadPhoto(file); }}
              />
            </label>
            <div className="text-sm">
              <div className="text-lg font-semibold">{c.name}</div>
              <div className="text-slate-500">{c.phone ?? "no phone"}</div>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs uppercase">{c.category}</span>
            </div>
          </div>

          {edit ? (
            <div className="grid gap-2">
              <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Name" />
              <input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="Phone" />
              <select className="select" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
                <option value="normal">normal</option><option value="vip">vip</option><option value="doctor">doctor</option>
              </select>
              <input className="input" value={f.limit} onChange={(e) => setF({ ...f, limit: e.target.value })} placeholder="Credit limit Rs" />
              <textarea className="input" rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Notes (marzi ka text)" />
              {fields.map((cf) => (
                <div key={cf.id}>
                  <label className="label">{cf.label}{cf.required ? " *" : ""}</label>
                  {cf.type === "select" ? (
                    <select className="select" value={custom[String(cf.id)] ?? ""} onChange={(e) => setCustom({ ...custom, [String(cf.id)]: e.target.value })}>
                      <option value="">— chunein —</option>
                      {cf.options.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : cf.type === "check" ? (
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={(custom[String(cf.id)] ?? "") === "1"} onChange={(e) => setCustom({ ...custom, [String(cf.id)]: e.target.checked ? "1" : "0" })} /> Haan
                    </label>
                  ) : (
                    <input className="input" type={cf.type === "number" ? "number" : cf.type === "date" ? "date" : "text"}
                      value={custom[String(cf.id)] ?? ""} onChange={(e) => setCustom({ ...custom, [String(cf.id)]: e.target.value })} />
                  )}
                </div>
              ))}
              <div className="flex gap-2">
                <button className="btn-primary" onClick={save} disabled={busy}><Save className="h-4 w-4" /> Save</button>
                <button className="btn-ghost" onClick={() => setEdit(false)}><X className="h-4 w-4" /> Cancel</button>
              </div>
            </div>
          ) : (
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Credit limit</span><span>{c.credit_limit_paisa ? formatPKR(c.credit_limit_paisa) : "—"}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Came since</span><span>{c.created_at.slice(0, 10)}</span></div>
              {c.notes && <p className="rounded bg-slate-50 p-2 text-xs text-slate-600">{c.notes}</p>}
              {fields.map((cf) => (
                <div key={cf.id} className="flex justify-between gap-2">
                  <span className="text-slate-500">{cf.label}</span>
                  <span className="text-right">{cf.type === "check" ? ((custom[String(cf.id)] ?? "") === "1" ? "Haan" : "Nahi") : (custom[String(cf.id)] || "—")}</span>
                </div>
              ))}
              <button className="btn-secondary mt-1" onClick={() => setEdit(true)}><Pencil className="h-4 w-4" /> Edit details</button>
            </div>
          )}
        </div>

        {/* Khata */}
        <div className="card card-body space-y-2">
          <div className="card-title">Khata (account)</div>
          <div className="flex justify-between text-sm"><span className="text-slate-500">Baqaya (owes us)</span><span className={`font-semibold ${c.balance_paisa > 0 ? "text-rose-600" : "text-emerald-700"}`}>{formatPKR(c.balance_paisa)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-slate-500">Total bills</span><span>{detail.stats.bills}</span></div>
          <div className="flex justify-between text-sm"><span className="text-slate-500">Total kharid</span><span>{formatPKR(detail.stats.spentPaisa)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-slate-500">Total wasooli</span><span>{formatPKR(detail.stats.paidPaisa)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-slate-500">Refund diye</span><span>{formatPKR(detail.stats.refundedPaisa)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-slate-500">Aakhri visit</span><span>{detail.stats.lastVisit?.slice(0, 10) ?? "—"}</span></div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Loyalty points</span>
            <span className="font-semibold text-amber-700">{detail.customer.loyalty_points ?? 0}</span>
          </div>
          {(detail.customer.stars ?? 0) > 0 && (
            <div className="flex justify-between text-sm"><span className="text-slate-500">Stars</span><span>{"★".repeat(Math.min(5, detail.customer.stars ?? 0))}</span></div>
          )}
          <div className="mt-2 flex gap-2">
            <input className="input-sm w-28" placeholder="Rs" value={pay} onChange={(e) => setPay(e.target.value)} />
            <button className="btn-primary" onClick={receive} disabled={busy}><HandCoins className="h-4 w-4" /> Receive</button>
          </div>
        </div>

        {/* Provisional */}
        <div className="card card-body space-y-2">
          <div className="card-title">Rush returns (bill ke baghair)</div>
          {detail.provisional.length === 0 && <p className="text-sm text-slate-500">Koi nahi.</p>}
          {detail.provisional.map((p) => (
            <div key={p.id} className={`flex justify-between rounded px-2 py-1 text-sm ${p.status === "pending" ? "bg-rose-50" : "bg-slate-50"}`}>
              <span>{p.code} · {p.date.slice(0, 10)}</span>
              <span>{formatPKR(p.refund_paisa)} <span className="text-xs text-slate-500">{p.status}</span></span>
            </div>
          ))}
          <p className="text-[11px] text-slate-400">Yeh phone number se juri entries hain (same phone wale customers).</p>
        </div>
      </div>

      {/* Bills / payments / returns */}
      <div className="card">
        <div className="card-head">
          <div className="flex gap-2">
            {(["bills", "payments", "returns"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`rounded px-3 py-1 text-sm ${tab === t ? "bg-slate-800 text-white" : "bg-slate-100"}`}>
                {t === "bills" ? `Bills (${detail.bills.length})` : t === "payments" ? `Payments (${detail.payments.length})` : `Returns (${detail.returns.length})`}
              </button>
            ))}
          </div>
        </div>
        <div className="card-body overflow-auto">
          {tab === "bills" && (
            <table className="tbl">
              <thead><tr><th>Bill</th><th>Tareekh</th><th>Items</th><th className="text-right">Total</th><th className="text-right">Baqaya</th><th></th></tr></thead>
              <tbody>
                {detail.bills.map((b) => (
                  <tr key={b.id} className={b.status === "void" ? "opacity-50" : ""}>
                    <td className="font-medium">{b.code}</td>
                    <td className="text-xs">{b.date.slice(0, 16)}</td>
                    <td>{b.items}</td>
                    <td className="text-right">{formatPKR(b.total_paisa)}</td>
                    <td className={`text-right ${b.due_paisa > 0 ? "text-rose-600" : ""}`}>{formatPKR(b.due_paisa)}</td>
                    <td className="text-right">
                      <Link className="btn-ghost !py-1" href={`/receipt/${b.id}`}><Receipt className="h-4 w-4" /> Receipt</Link>
                    </td>
                  </tr>
                ))}
                {detail.bills.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-sm text-slate-500">Koi bill nahi.</td></tr>}
              </tbody>
            </table>
          )}
          {tab === "payments" && (
            <table className="tbl">
              <thead><tr><th>Tareekh</th><th>Tarika</th><th className="text-right">Raqam</th><th>Note</th></tr></thead>
              <tbody>
                {detail.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="text-xs">{p.date.slice(0, 16)}</td>
                    <td className="text-xs">{p.method}</td>
                    <td className={`text-right ${p.amount_paisa < 0 ? "text-rose-600" : ""}`}>{formatPKR(p.amount_paisa)}</td>
                    <td className="text-xs text-slate-500">{p.note ?? "—"}</td>
                  </tr>
                ))}
                {detail.payments.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-sm text-slate-500">Koi payment nahi.</td></tr>}
              </tbody>
            </table>
          )}
          {tab === "returns" && (
            <table className="tbl">
              <thead><tr><th>Bill</th><th>Tareekh</th><th>Qty</th><th className="text-right">Refund</th><th>Wajah</th></tr></thead>
              <tbody>
                {detail.returns.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium">{r.code}</td>
                    <td className="text-xs">{r.date.slice(0, 16)}</td>
                    <td>{r.qty_base}</td>
                    <td className="text-right">{formatPKR(r.refund_paisa)}</td>
                    <td className="text-xs text-slate-500">{r.reason ?? "—"}</td>
                  </tr>
                ))}
                {detail.returns.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-sm text-slate-500">Koi return nahi.</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
