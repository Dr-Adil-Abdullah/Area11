"use client";

// Area11 - dawa ki poori tafseel: photo, rates, batches/expiry, bikri, price history, movements
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, PackageMinus, Pencil, Save, X } from "lucide-react";
import { formatPKR, toPaisa } from "@/lib/money";
import type { CustomField } from "@/lib/custom-fields-shared";
import type { getProductDetail } from "@/lib/details";

type Detail = NonNullable<ReturnType<typeof getProductDetail>>;

async function shrink(file: File, max = 640): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  c.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  return c.toDataURL("image/jpeg", 0.72);
}

const MOVE_LABEL: Record<string, string> = {
  in: "Stock aaya", out: "Bik gaya", adjust: "Adjust", writeoff: "Nuqsan",
  return_in: "Wapas aaya", return_out: "Return gaya", sample: "Sample/bonus",
};

export default function ProductDetailClient({ detail, fields }: { detail: Detail; fields: CustomField[] }) {
  const router = useRouter();
  const p = detail.product;
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({
    cost: p.cost_paisa ? String(p.cost_paisa / 100) : "",
    retail: p.retail_paisa ? String(p.retail_paisa / 100) : "",
    vip: p.vip_paisa ? String(p.vip_paisa / 100) : "",
    doctor: p.doctor_paisa ? String(p.doctor_paisa / 100) : "",
    rack: p.rack_no ?? "",
    room: p.room ?? "",
    reorder: p.reorder_level ? String(p.reorder_level) : "",
    barcode: p.barcode ?? "",
  });
  const [custom, setCustom] = useState<Record<string, string>>(detail.custom);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"batches" | "moves" | "price">("batches");

  async function save() {
    setBusy(true); setMsg("");
    try {
      const r = await (await fetch(`/api/products/${p.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: p.name, generic: p.generic, brand: p.brand, barcode: f.barcode || null,
          companyId: p.company_id, categoryId: p.category_id, rackNo: f.rack || null,
          room: f.room || null,
          baseUnit: p.base_unit, boxStrips: p.box_strips, stripTablets: p.strip_tablets,
          costPaisa: toPaisa(f.cost || 0), retailPaisa: toPaisa(f.retail || 0),
          vipPaisa: toPaisa(f.vip || 0), doctorPaisa: toPaisa(f.doctor || 0),
          reorderLevel: Number(f.reorder) || 0, trackExpiry: !!p.track_expiry,
          custom,
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
      const r = await (await fetch(`/api/products/${p.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: p.name, generic: p.generic, brand: p.brand, barcode: p.barcode,
          companyId: p.company_id, categoryId: p.category_id, rackNo: p.rack_no, room: p.room,
          baseUnit: p.base_unit, boxStrips: p.box_strips, stripTablets: p.strip_tablets,
          costPaisa: p.cost_paisa, retailPaisa: p.retail_paisa, vipPaisa: p.vip_paisa,
          doctorPaisa: p.doctor_paisa, reorderLevel: p.reorder_level, trackExpiry: !!p.track_expiry,
          photo: dataUrl,
        }),
      })).json();
      if (!r.ok) throw new Error(r.error);
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "photo failed");
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-800">{p.name}</h1>
        <Link href="/products" className="btn-secondary">← All products</Link>
      </div>

      {msg && <div className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{msg}</div>}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Photo + identity */}
        <div className="card card-body space-y-3">
          <div className="flex gap-3">
            <label className="relative block h-24 w-24 shrink-0 cursor-pointer overflow-hidden rounded-lg bg-slate-100">
              {p.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.photo} alt={p.name} className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-3xl">💊</span>
              )}
              <span className="absolute bottom-0 right-0 rounded-tl bg-slate-800 p-1 text-white"><Camera className="h-3.5 w-3.5" /></span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadPhoto(file); }} />
            </label>
            <div className="text-sm">
              <div className="text-slate-500">{p.generic ?? "—"}</div>
              <div>{p.brand ?? ""} {p.company_name ? `• ${p.company_name}` : ""}</div>
              <div className="text-xs text-slate-500">{p.category_name ?? "no category"} • {p.rack_no ? `rack ${p.rack_no}` : "no rack"} • {p.room ? `kamra ${p.room}` : "no room"}</div>
              <div className="mt-1 rounded bg-slate-100 px-2 py-0.5 text-xs">
                1 Box = {p.box_strips || 1} Strip = {(p.box_strips || 1) * (p.strip_tablets || 1)} {p.base_unit}
              </div>
            </div>
          </div>

          {edit ? (
            <div className="grid grid-cols-2 gap-2">
              {([["cost", "Cost Rs"], ["retail", "Retail Rs"], ["vip", "VIP Rs"], ["doctor", "Doctor Rs"], ["rack", "Rack"], ["room", "Kamra / Almari"], ["reorder", "Reorder level"], ["barcode", "Barcode"]] as const).map(([k, label]) => (
                <div key={k} className={k === "barcode" ? "col-span-2" : ""}>
                  <label className="label">{label}</label>
                  <input className="input" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
                </div>
              ))}
              {fields.map((cf) => (
                <div key={cf.id} className="col-span-2">
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
              <div className="col-span-2 flex gap-2">
                <button className="btn-primary" onClick={save} disabled={busy}><Save className="h-4 w-4" /> Save</button>
                <button className="btn-ghost" onClick={() => setEdit(false)}><X className="h-4 w-4" /> Cancel</button>
              </div>
            </div>
          ) : (
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Cost</span><span>{formatPKR(p.cost_paisa)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Retail</span><span className="font-medium">{formatPKR(p.retail_paisa)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">VIP / Doctor</span><span>{formatPKR(p.vip_paisa)} / {formatPKR(p.doctor_paisa)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Barcode</span><span>{p.barcode ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Reorder level</span><span>{p.reorder_level}</span></div>
              {fields.map((cf) => (
                <div key={cf.id} className="flex justify-between gap-2">
                  <span className="text-slate-500">{cf.label}</span>
                  <span className="text-right">{cf.type === "check" ? ((custom[String(cf.id)] ?? "") === "1" ? "Haan" : "Nahi") : (custom[String(cf.id)] || "—")}</span>
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <button className="btn-secondary" onClick={() => setEdit(true)}><Pencil className="h-4 w-4" /> Edit rates/details</button>
                <Link className="btn-ghost" href="/stock"><PackageMinus className="h-4 w-4" /> Nuqsan darj</Link>
              </div>
            </div>
          )}
        </div>

        {/* Numbers */}
        <div className="card card-body space-y-1">
          <div className="card-title mb-1">Hisab</div>
          <div className="flex justify-between text-sm"><span className="text-slate-500">Stock abhi</span><span className="font-semibold">{detail.stats.stockBase} {p.base_unit}</span></div>
          <div className="flex justify-between text-sm"><span className="text-slate-500">Stock ki qeemat (cost)</span><span>{formatPKR(detail.stats.stockValuePaisa)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-slate-500">Batches</span><span>{detail.stats.batches}</span></div>
          <div className="my-1 border-t" />
          <div className="flex justify-between text-sm"><span className="text-slate-500">Total bikri (qty)</span><span>{detail.stats.soldQty} {p.base_unit}</span></div>
          <div className="flex justify-between text-sm"><span className="text-slate-500">Total bikri (raqam)</span><span>{formatPKR(detail.stats.soldValuePaisa)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-slate-500">Kitne bills me</span><span>{detail.stats.soldBills}</span></div>
          <div className="flex justify-between text-sm"><span className="text-slate-500">Aakhri bikri</span><span>{detail.stats.lastSoldAt?.slice(0, 10) ?? "—"}</span></div>
          <div className="flex justify-between text-sm"><span className="text-slate-500">Fi unit munafa</span><span className={detail.stats.marginPaisa > 0 ? "text-emerald-700" : "text-rose-600"}>{formatPKR(detail.stats.marginPaisa)}</span></div>
          {detail.stats.stockBase <= p.reorder_level && (
            <div className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">Stock reorder level se kam/nichla hai — order karein.</div>
          )}
        </div>

        {/* Batches quick */}
        <div className="card card-body space-y-2">
          <div className="card-title">Batches &amp; expiry</div>
          {detail.batches.length === 0 && <p className="text-sm text-slate-500">Koi batch nahi.</p>}
          <div className="max-h-64 overflow-auto">
            <table className="tbl">
              <thead><tr><th>Batch</th><th>Expiry</th><th className="text-right">Qty</th><th>Halat</th></tr></thead>
              <tbody>
                {detail.batches.map((b) => (
                  <tr key={b.id}>
                    <td className="text-xs font-medium">{b.batch_no}<div className="text-[11px] text-slate-400">{b.supplier_name ?? ""}</div></td>
                    <td className="text-xs">{b.expiry_ym ?? "—"}</td>
                    <td className="text-right text-xs">{b.qty_base}</td>
                    <td className="text-xs">
                      {b.status === "theek" && <span className="text-emerald-700">theek</span>}
                      {b.status === "jaldi" && <span className="text-amber-700">jaldi expire</span>}
                      {b.status === "expired" && <span className="text-rose-700">expired</span>}
                      {b.status === "khali" && <span className="text-slate-400">khali</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Tabs: movements + price history */}
      <div className="card">
        <div className="card-head">
          <div className="flex gap-2">
            {(["batches", "moves", "price"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`rounded px-3 py-1 text-sm ${tab === t ? "bg-slate-800 text-white" : "bg-slate-100"}`}>
                {t === "batches" ? "Full batches" : t === "moves" ? `Stock movements (${detail.movements.length})` : `Price history (${detail.priceHistory.length})`}
              </button>
            ))}
          </div>
        </div>
        <div className="card-body overflow-auto">
          {tab === "batches" && (
            <table className="tbl">
              <thead><tr><th>Batch</th><th>Expiry</th><th className="text-right">Qty</th><th className="text-right">Cost</th><th className="text-right">Retail</th><th>Supplier</th><th>Purchase</th></tr></thead>
              <tbody>
                {detail.batches.map((b) => (
                  <tr key={b.id}>
                    <td className="font-medium">{b.batch_no}</td>
                    <td>{b.expiry_ym ?? "—"}</td>
                    <td className="text-right">{b.qty_base}</td>
                    <td className="text-right">{formatPKR(b.cost_paisa)}</td>
                    <td className="text-right">{formatPKR(b.retail_paisa)}</td>
                    <td className="text-xs">{b.supplier_name ?? "—"}</td>
                    <td className="text-xs">{b.purchase_code ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === "moves" && (
            <table className="tbl">
              <thead><tr><th>Kab</th><th>Kya hua</th><th className="text-right">Qty</th><th>Hawala</th><th>Note</th><th>Kis ne</th></tr></thead>
              <tbody>
                {detail.movements.map((m) => (
                  <tr key={m.id}>
                    <td className="text-xs">{m.created_at.slice(0, 16)}</td>
                    <td className="text-xs">{MOVE_LABEL[m.type] ?? m.type}</td>
                    <td className={`text-right text-xs ${m.qty_base < 0 ? "text-rose-600" : "text-emerald-700"}`}>{m.qty_base > 0 ? "+" : ""}{m.qty_base}</td>
                    <td className="text-xs">{m.ref_code ?? m.ref_type ?? "—"}</td>
                    <td className="text-xs text-slate-500">{m.note ?? "—"}</td>
                    <td className="text-xs">{m.user_name ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === "price" && (
            <table className="tbl">
              <thead><tr><th>Kab</th><th>Kya badla</th><th>Purana</th><th>Naya</th><th>Kis ne</th></tr></thead>
              <tbody>
                {detail.priceHistory.map((h) => (
                  <tr key={h.id}>
                    <td className="text-xs">{h.at.slice(0, 16)}</td>
                    <td className="text-xs">{String(h.data.field ?? "price")}</td>
                    <td className="text-xs">{typeof h.data.from === "number" ? formatPKR(h.data.from as number) : "—"}</td>
                    <td className="text-xs">{typeof h.data.to === "number" ? formatPKR(h.data.to as number) : "—"}</td>
                    <td className="text-xs">{h.by ?? "—"}</td>
                  </tr>
                ))}
                {detail.priceHistory.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-sm text-slate-500">Abhi koi rate change record nahi.</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
