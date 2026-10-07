"use client";

// ---------------------------------------------------------------------------
// WAPSI KA MAAL JO STOCK ME WAPAS NAHI DALA GAYA (khaas surat)
// ---------------------------------------------------------------------------
// MALIK KA HUKUM (U-32, 6-Oct-2026): "jaisay hi paisay niklen ge, stock add
// ho jaye ga" -- yani aam wapsi par maal FORAN stock me chala jata hai, koi
// quarantine nahi (kharaab / tarikh-guzashta maal hum late hi nahi).
// Ye card sirf un (nadiri) suraton ke liye hai jahan wapsi ke waqt
// jaan-bujh kar "maal stock me wapas nahi" chuna gaya ho (restock = 0).
// Yahan se ek click se shelf par bheja ja sakta hai (black box me record).
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { CheckCircle2, PackageSearch } from "lucide-react";
import { formatPKR } from "@/lib/money";

type Row = {
  id: number; date: string; product_id: number; name: string;
  batch_id: number | null; batch_no: string | null; base_unit: string;
  qty_base: number; refund_paisa: number; reason: string | null;
  sale_code: string | null; customer_name: string | null; user_name: string | null;
};

export default function QuarantineCard({
  initial,
  canRelease,
}: {
  initial: Row[];
  /** sirf owner/manager maal wapas shelf par daal sakte hain */
  canRelease: boolean;
}) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [busy, setBusy] = useState<number | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => setRows(initial), [initial]);

  async function release(id: number) {
    setBusy(id);
    setMsg("");
    try {
      const r = await (
        await fetch("/api/quarantine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        })
      ).json();
      if (!r.ok) throw new Error(r.error);
      setMsg(`${r.productName}: ${r.qtyBase} wapas shelf par (stock me aa gaya).`);
      setRows((rs) => rs.filter((x) => x.id !== id));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "fail");
    } finally {
      setBusy(null);
    }
  }

  if (rows.length === 0) return null;

  return (
    <div className="card border-amber-200">
      <div className="card-head">
        <div>
          <div className="card-title flex items-center gap-2">
            <PackageSearch className="h-4 w-4 text-amber-600" />
            واپسی کا مال جو اسٹاک میں واپس نہیں ڈالا گیا
          </div>
          <div className="text-xs font-normal text-slate-500">
            مالک کے حکم کے مطابق عام واپسی پر مال <b>فوراً اسٹاک</b> میں جاتا ہے۔
            یہ فہرست صرف ان نادری صورتوں کے لیے ہے جہاں واپسی کے وقت جان بوجھ کر
            مال اسٹاک میں واپس نہیں ڈالا گیا — &quot;شیلف پر ڈالیں&quot; دبانے سے اسٹاک میں شامل ہو جائے گا
            (بلیک باکس میں ریکارڈ کے ساتھ)۔
          </div>
        </div>
        <span className="badge-amber">{rows.length}</span>
      </div>
      <div className="card-body overflow-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th>دوا</th>
              <th>بِل</th>
              <th>بیچ</th>
              <th className="text-right">مقدار</th>
              <th className="text-right">رقم واپس</th>
              <th>وجہ / کس نے</th>
              {canRelease && <th></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="font-medium">{r.name}</td>
                <td className="text-xs text-slate-500">{r.sale_code ?? "—"}</td>
                <td className="text-xs">{r.batch_no ?? "—"}</td>
                <td className="text-right font-semibold text-amber-700">
                  {r.qty_base} {r.base_unit}
                </td>
                <td className="text-right text-xs">{formatPKR(r.refund_paisa)}</td>
                <td className="text-xs text-slate-500">
                  {r.reason ?? "—"}
                  {r.user_name ? ` · ${r.user_name}` : ""}
                </td>
                {canRelease && (
                  <td className="text-right">
                    <button
                      className="btn-secondary !py-1 !text-xs"
                      disabled={busy === r.id}
                      onClick={() => release(r.id)}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {busy === r.id ? "…" : "شیلف پر ڈالیں"}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {msg && <div className="mt-2 rounded bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{msg}</div>}
      </div>
    </div>
  );
}
