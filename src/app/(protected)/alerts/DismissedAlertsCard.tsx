"use client";

// ---------------------------------------------------------------------------
// U-31: alerts jo MALIK ne wajah likh kar khatam kiye -- wajah yahan mehfooz
// ---------------------------------------------------------------------------
// Malik chahe to kisi bhi purani alert ko wapas (zinda) bhi la sakta hai --
// ye bhi black box me darj hota hai.
// ---------------------------------------------------------------------------

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RotateCcw } from "lucide-react";

type Row = {
  id: number;
  alert_key: string;
  alert_type: string;
  entity_id: number | null;
  reason: string;
  user_name: string | null;
  created_at: string;
};

export default function DismissedAlertsCard({
  initial,
  canRestore,
}: {
  initial: Row[];
  /** sirf malik hi wapas la sakta hai */
  canRestore: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  if (rows.length === 0) {
    return (
      <div className="card">
        <div className="card-head">
          <div className="card-title">الرٹس — جو مالک نے وجہ لکھ کر ختم کیے</div>
        </div>
        <div className="card-body text-sm text-slate-500">
          ابھی کوئی الرٹ ختم نہیں کیا گیا۔ جب بھی مالک کسی الرٹ پر وجہ لکھ کر &quot;ختم&quot; کریں گے،
          وہ وجہ یہاں (اور بلیک باکس میں) ہمیشہ کے لیے محفوظ ہو جائے گی۔
        </div>
      </div>
    );
  }

  async function restore(key: string) {
    setBusy(key);
    setMsg("");
    try {
      const r = (await (
        await fetch("/api/alerts/dismiss", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key }),
        })
      ).json()) as { ok?: boolean; error?: string };
      if (r.ok === false) throw new Error(r.error || "wapas nahi la sakte");
      setRows((rs) => rs.filter((x) => x.alert_key !== key));
      setMsg("Alert wapas zinda ho gaya (har safhe par nazar aaye ga).");
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "fail");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">الرٹس — جو مالک نے وجہ لکھ کر ختم کیے</div>
          <div className="text-xs font-normal text-slate-500">
            ہر الرٹ صرف مالک ختم کر سکتا ہے، اور وجہ لکھنا لازمی ہے۔ یہ وجہ یہاں اور بلیک باکس
            (Audit) میں ہمیشہ کے لیے محفوظ رہتی ہے۔
          </div>
        </div>
        <span className="badge-slate">{rows.length}</span>
      </div>
      <div className="card-body overflow-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th>الرٹ</th>
              <th>وجہ (مالک کی لکھی ہوئی)</th>
              <th>کب / کس نے</th>
              {canRestore && <th></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="text-xs">
                  <span className="badge-slate">{r.alert_type}</span>{" "}
                  <code className="text-[11px]">{r.alert_key}</code>
                </td>
                <td className="max-w-md text-sm">{r.reason}</td>
                <td className="text-xs text-slate-500">
                  {r.created_at}
                  {r.user_name ? ` · ${r.user_name}` : ""}
                </td>
                {canRestore && (
                  <td className="text-right">
                    <button
                      className="btn-secondary !py-1 !text-xs"
                      disabled={busy === r.alert_key}
                      onClick={() => restore(r.alert_key)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      {busy === r.alert_key ? "…" : "واپس لائیں"}
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
