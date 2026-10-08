"use client";

// ---------------------------------------------------------------------------
// QUARANTINE (U-34): har item ka MUSTAQIL number (Q-0001) + poora pata
// ---------------------------------------------------------------------------
// Malik ka hukum:
//   * har saman jo quarantine me ho, us ka apna SPECIFIC NUMBER ho jo
//     change na ho sake
//   * jab history dekhein to sara saman show ho -- kiska saman kidhar gaya
//   * quarantine se saman (الف) stock me wapas, (ب) expiry/kharaab, (ج) becha
//     ja sakta hai
//   * jab tak faisla na ho ALERT jata rahe ga
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, PackageSearch, Trash2, ShoppingCart } from "lucide-react";
import { formatPKR } from "@/lib/money";

type Row = {
  id: number; date: string; product_id: number; name: string;
  batch_id: number | null; batch_no: string | null; base_unit: string;
  qty_base: number; refund_paisa: number; reason: string | null;
  sale_code: string | null; customer_name: string | null; user_name: string | null;
  qcode: string | null;
  disposition: string;
  disposed_at: string | null;
  disposed_note: string | null;
  return_code: string | null;
};

const LABEL: Record<string, { ur: string; cls: string }> = {
  quarantine: { ur: "قرنطینہ میں", cls: "badge-amber" },
  restocked: { ur: "اسٹاک میں واپس", cls: "badge-green" },
  expired: { ur: "ایکسپائری / خراب", cls: "badge-red" },
  sold: { ur: "فروخت ہو گیا", cls: "badge-slate" },
};

export default function QuarantineCard({
  initial,
  history,
  canDecide,
}: {
  initial: Row[];
  history: Row[];
  /** sirf owner/manager faisla kar sakte hain */
  canDecide: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(initial);
  const [hist, setHist] = useState<Row[]>(history);
  const [busy, setBusy] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const [askId, setAskId] = useState<number | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => setRows(initial), [initial]);
  useEffect(() => setHist(history), [history]);

  async function decide(id: number, disposition: "restocked" | "expired" | "sold") {
    setBusy(id);
    setMsg("");
    try {
      const r = await (
        await fetch("/api/quarantine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, disposition, note }),
        })
      ).json();
      if (!r.ok) throw new Error(r.error);
      const where =
        disposition === "restocked" ? "اسٹاک (شیلف) میں واپس" :
        disposition === "expired" ? "ایکسپائری / خراب" : "فروخت";
      setMsg(`${r.qcode ?? ""}: ${r.productName} → ${where}۔ (نمبر ${r.qcode} ہمیشہ رہے گا)`);
      setAskId(null);
      setNote("");
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "fail");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      {/* ===== (1) ABHI QUARANTINE ME ===== */}
      <div className="card border-amber-200">
        <div className="card-head">
          <div>
            <div className="card-title flex items-center gap-2">
              <PackageSearch className="h-4 w-4 text-amber-600" />
              قرنطینہ — واپسی کا مال جو ابھی شیلف پر نہیں
            </div>
            <div className="text-xs font-normal text-slate-500">
              مالک کے حکم کے مطابق عام واپسی پر مال <b>فوراً اسٹاک</b> میں جاتا ہے۔ یہ فہرست صرف
              اُن صورتوں کے لیے ہے جہاں مال ابھی قرنطینہ میں ہے — ہر آئٹم کا اپنا
              <b> مستقل نمبر (Q-…)</b> ہے جو کبھی نہیں بدلتا۔ مالک فیصلہ کریں:
              <b> اسٹاک میں واپس</b>، <b>ایکسپائری/خراب</b>، یا <b>فروخت</b>۔
            </div>
          </div>
          <span className="badge-amber">{rows.length}</span>
        </div>
        <div className="card-body overflow-auto">
          {rows.length === 0 ? (
            <div className="py-3 text-center text-sm text-slate-500">
              قرنطینہ خالی ہے — کوئی مال منتظر نہیں۔
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>نمبر (Q-)</th>
                  <th>دوا</th>
                  <th>بِل</th>
                  <th>بیچ</th>
                  <th className="text-right">مقدار</th>
                  <th className="text-right">رقم واپس</th>
                  <th>وجہ / کس نے</th>
                  {canDecide && <th></th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="font-mono text-xs font-bold text-amber-700">{r.qcode ?? "—"}</td>
                    <td className="font-medium">{r.name}</td>
                    <td className="text-xs text-slate-500">
                      {r.sale_code ?? "—"}
                      {r.return_code ? ` (${r.return_code})` : ""}
                    </td>
                    <td className="text-xs">{r.batch_no ?? "—"}</td>
                    <td className="text-right font-semibold text-amber-700">
                      {r.qty_base} {r.base_unit}
                    </td>
                    <td className="text-right text-xs">{formatPKR(r.refund_paisa)}</td>
                    <td className="text-xs text-slate-500">
                      {r.reason ?? "—"}
                      {r.user_name ? ` · ${r.user_name}` : ""}
                    </td>
                    {canDecide && (
                      <td className="text-right">
                        <div className="inline-flex gap-1">
                          <button
                            className="btn-secondary !py-1 !text-xs"
                            disabled={busy === r.id}
                            onClick={() => decide(r.id, "restocked")}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {busy === r.id ? "…" : "اسٹاک میں"}
                          </button>
                          <button
                            className="btn-ghost !py-1 !text-xs !text-rose-700"
                            disabled={busy === r.id}
                            onClick={() => setAskId(askId === r.id ? null : r.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" /> خراب
                          </button>
                          <button
                            className="btn-ghost !py-1 !text-xs"
                            disabled={busy === r.id}
                            onClick={() => decide(r.id, "sold")}
                          >
                            <ShoppingCart className="h-3.5 w-3.5" /> فروخت
                          </button>
                        </div>
                        {askId === r.id && (
                          <div className="mt-1 w-56 text-left">
                            <input
                              autoFocus
                              className="input-sm w-full"
                              placeholder="نوٹ (اختیاری): کیوں خراب؟"
                              value={note}
                              onChange={(e) => setNote(e.target.value)}
                            />
                            <div className="mt-1 flex gap-1">
                              <button className="btn-secondary !py-0.5 !text-xs" onClick={() => decide(r.id, "expired")}>
                                ایکسپائری/خراب درج کریں
                              </button>
                              <button className="btn-ghost !py-0.5 !text-xs" onClick={() => { setAskId(null); setNote(""); }}>
                                منسوخ
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {msg && <div className="mt-2 rounded bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{msg}</div>}
        </div>
      </div>

      {/* ===== (2) POORI HISTORY: kaun sa saman kidhar gaya ===== */}
      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">قرنطینہ کی پوری تاریخ — کون سا سامان کہاں گیا</div>
            <div className="text-xs font-normal text-slate-500">
              ہر آئٹم کا نمبر (<code>Q-0001</code>) ہمیشہ ایک ہی رہتا ہے؛ صرف انجام بدلتا ہے۔
            </div>
          </div>
          <span className="badge-slate">{hist.length}</span>
        </div>
        <div className="card-body overflow-auto">
          {hist.length === 0 ? (
            <div className="py-3 text-center text-sm text-slate-500">
              ابھی کوئی ریکارڈ نہیں — جب بھی کوئی مال قرنطینہ میں جائے گا، یہاں درج ہو گا۔
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>نمبر</th>
                  <th>دوا</th>
                  <th>مقدار</th>
                  <th>انجام (کہاں گیا)</th>
                  <th>واپسی کا بل</th>
                  <th>کب / نوٹ</th>
                </tr>
              </thead>
              <tbody>
                {hist.map((r) => (
                  <tr key={r.id}>
                    <td className="font-mono text-xs font-bold">{r.qcode ?? "—"}</td>
                    <td className="text-sm">{r.name}</td>
                    <td className="text-xs">
                      {r.qty_base} {r.base_unit}
                    </td>
                    <td>
                      <span className={LABEL[r.disposition]?.cls ?? "badge-slate"}>
                        {LABEL[r.disposition]?.ur ?? r.disposition}
                      </span>
                    </td>
                    <td className="text-xs text-slate-500">
                      {r.return_code ?? r.sale_code ?? "—"}
                    </td>
                    <td className="text-xs text-slate-500">
                      {r.disposed_at ?? r.date}
                      {r.disposed_note ? ` · ${r.disposed_note}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
