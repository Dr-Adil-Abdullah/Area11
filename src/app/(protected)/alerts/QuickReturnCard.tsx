"use client";

// Area11 - expiry wali dawaen seedha supplier ko wapas (do click)
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PackageX, Undo2 } from "lucide-react";
import { formatPKR } from "@/lib/money";

type Row = {
  batch_id: number;
  product_id: number;
  name: string;
  batch_no: string;
  expiry_ym: string | null;
  qty_base: number;
  cost_paisa: number;
  supplier_id: number | null;
  supplier_name: string | null;
};

type Sample = {
  batch_id: number; product_id: number; name: string; batch_no: string;
  expiry_ym: string | null; qty_base: number; supplier: string | null; purchase_code: string | null;
};

export default function QuickReturnCard({
  expired,
  samples,
  suppliers,
}: {
  expired: Row[];
  samples: Sample[];
  suppliers: { id: number; name: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [picked, setPicked] = useState<Record<number, boolean>>({});

  const chosen = expired.filter((r) => picked[r.batch_id]);

  async function sendBack() {
    if (chosen.length === 0) return setMsg("Pehle koi dawa chunein.");
    // Supplier alag alag ho sakte hain -> har supplier ke liye alag return
    const bySupplier = new Map<number, Row[]>();
    for (const r of chosen) {
      const sid = r.supplier_id ?? 0;
      if (!bySupplier.has(sid)) bySupplier.set(sid, []);
      bySupplier.get(sid)!.push(r);
    }
    if (bySupplier.has(0)) {
      return setMsg("Kuch dawaon ka supplier maloom nahi — unhein supplier ke page se wapas bhejein.");
    }

    setBusy(true); setMsg("");
    const done: string[] = [];
    for (const [sid, rows] of bySupplier) {
      const r = await (await fetch("/api/supplier-returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: sid,
          reason: "expired",
          note: "Expiry alert se wapas bheja gaya",
          lines: rows.map((x) => ({ productId: x.product_id, batchId: x.batch_id, qtyBase: x.qty_base, costPaisa: x.cost_paisa })),
        }),
      })).json();
      if (r.ok) done.push(r.code);
      else {
        setMsg(r.error ?? "failed");
        setBusy(false);
        return;
      }
    }
    setMsg(`Wapas bhej diya: ${done.join(", ")}`);
    setPicked({});
    router.refresh();
    setBusy(false);
  }

  const totalLoss = chosen.reduce((n, r) => n + r.qty_base * r.cost_paisa, 0);

  return (
    <div className="card">
      <div className="card-head flex-col !items-start gap-0.5">
        <div className="card-title">Expiry wali dawaen wapas bhejein</div>
        <div className="text-xs font-normal text-slate-500">
          Expiry ho chuki batches — tick karein aur seedha supplier ko lota dein (stock nikal jayega, balance kam hoga).
        </div>
      </div>
      <div className="card-body space-y-3">
        {expired.length === 0 && (
          <p className="text-sm text-slate-500">Koi expired batch nahi — sab theek hai.</p>
        )}
        {expired.length > 0 && (
          <>
            <div className="max-h-56 overflow-auto">
              <table className="tbl">
                <thead><tr><th className="w-8"></th><th>Dawa</th><th>Batch</th><th>Expiry</th><th className="text-right">Qty</th><th>Supplier</th><th className="text-right">Qeemat</th></tr></thead>
                <tbody>
                  {expired.map((r) => (
                    <tr key={r.batch_id} className={picked[r.batch_id] ? "bg-rose-50" : ""}>
                      <td>
                        <input
                          type="checkbox"
                          checked={!!picked[r.batch_id]}
                          onChange={(e) => setPicked({ ...picked, [r.batch_id]: e.target.checked })}
                        />
                      </td>
                      <td className="font-medium">{r.name}</td>
                      <td className="text-xs">{r.batch_no}</td>
                      <td className="text-xs">{r.expiry_ym ?? "—"}</td>
                      <td className="text-right">{r.qty_base}</td>
                      <td className="text-xs">{r.supplier_name ?? <span className="text-amber-700">maloom nahi</span>}</td>
                      <td className="text-right text-xs">{formatPKR(Math.round(r.qty_base * r.cost_paisa))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button className="btn-primary" onClick={sendBack} disabled={busy || chosen.length === 0}>
                <Undo2 className="h-4 w-4" /> {chosen.length} wapas bhejein
              </button>
              {chosen.length > 0 && (
                <span className="text-sm text-slate-600">Qeemat (cost): <b>{formatPKR(Math.round(totalLoss))}</b></span>
              )}
              <button className="btn-ghost text-xs" onClick={() => setPicked(Object.fromEntries(expired.map((r) => [r.batch_id, true])))}>
                Sab chunein
              </button>
            </div>
          </>
        )}

        {/* Sample / bonus stock */}
        <div className="border-t pt-3">
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <PackageX className="h-4 w-4" /> Sample / bonus maal ({samples.length})
          </div>
          {samples.length === 0 ? (
            <p className="text-xs text-slate-500">Koi sample maal nahi. (Purchase me "Free" tick karne par yahan aata hai.)</p>
          ) : (
            <div className="max-h-40 overflow-auto">
              <table className="tbl">
                <thead><tr><th>Dawa</th><th>Batch</th><th className="text-right">Qty</th><th>Supplier</th><th>Bill</th></tr></thead>
                <tbody>
                  {samples.map((s) => (
                    <tr key={s.batch_id}>
                      <td className="font-medium">{s.name}</td>
                      <td className="text-xs">{s.batch_no}</td>
                      <td className="text-right">{s.qty_base}</td>
                      <td className="text-xs">{s.supplier ?? "—"}</td>
                      <td className="text-xs">{s.purchase_code ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {msg && <div className={`rounded px-3 py-2 text-sm ${msg.includes("bhej diya") ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"}`}>{msg}</div>}
      </div>
    </div>
  );
}
