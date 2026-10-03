"use client";

// Area11 - Galla / shift card: kholein, zinda hisaab dekhein, ginta hua cash de kar band karein
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, Unlock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatPKR, toPaisa } from "@/lib/money";
import type { ShiftFlow, ShiftRow } from "@/lib/shifts";

type CloseResult = { expectedPaisa: number; actualPaisa: number; differencePaisa: number } | null;

export default function ShiftCard({
  open,
  flow,
  shifts,
  todayVariancePaisa,
}: {
  open: ShiftRow | null;
  flow: ShiftFlow | null;
  shifts: ShiftRow[];
  todayVariancePaisa: number;
}) {
  const router = useRouter();
  const [openingFloat, setOpeningFloat] = useState("");
  const [openingNote, setOpeningNote] = useState("");
  const [counted, setCounted] = useState("");
  const [closeNote, setCloseNote] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [closed, setClosed] = useState<CloseResult>(null);

  const preview =
    counted === "" || !flow ? null : toPaisa(counted) - flow.expectedPaisa;

  async function post(body: unknown) {
    setBusy(true); setMsg("");
    try {
      const r = await (await fetch("/api/shifts", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      })).json();
      if (!r.ok) { setMsg(r.error ?? "failed"); return null; }
      return r;
    } finally {
      setBusy(false);
    }
  }

  async function doOpen() {
    const r = await post({ action: "open", openingFloatPaisa: toPaisa(openingFloat || 0), note: openingNote || null });
    if (r) { setOpeningFloat(""); setOpeningNote(""); router.refresh(); }
  }

  async function doClose() {
    if (!confirm("Shift band kar dein? Uske baad nayi shift kholein gi.")) return;
    const r = await post({ action: "close", actualPaisa: toPaisa(counted || 0), note: closeNote || null });
    if (r) {
      setClosed({ expectedPaisa: r.expectedPaisa, actualPaisa: r.actualPaisa, differencePaisa: r.differencePaisa });
      setCounted(""); setCloseNote("");
      router.refresh();
    }
  }

  const Line = ({ k, v, bold, neg }: { k: string; v: number; bold?: boolean; neg?: boolean }) => (
    <div className={`flex justify-between py-0.5 text-sm ${bold ? "mt-1 border-t border-slate-300 pt-1.5 font-semibold" : "text-slate-600"}`}>
      <span>{k}</span>
      <span>{neg ? "− " : ""}{formatPKR(v)}</span>
    </div>
  );

  const VarBadge = ({ v }: { v: number }) => (
    <span className={`font-semibold ${v === 0 ? "text-emerald-700" : v > 0 ? "text-amber-700" : "text-rose-700"}`}>
      {v === 0 ? "Barabar" : v > 0 ? `Zyada ${formatPKR(v)}` : `Kam ${formatPKR(-v)}`}
    </span>
  );

  return (
    <div className="card card-body space-y-3">
      <div className="flex items-center justify-between">
        <div className="card-title">Cash shift (galla)</div>
        {open ? (
          <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
            <Unlock className="h-3.5 w-3.5" /> Khuli hui
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            <LockKeyhole className="h-3.5 w-3.5" /> Band
          </span>
        )}
      </div>

      {msg && <div className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{msg}</div>}

      {closed && (
        <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4" /> Shift band ho gayi</div>
          <div className="mt-1">Hisab: {formatPKR(closed.expectedPaisa)} · Ginti: {formatPKR(closed.actualPaisa)} · Farq: <VarBadge v={closed.differencePaisa} /></div>
        </div>
      )}

      {!open && (
        <div className="space-y-2">
          <p className="text-sm text-slate-600">
            Nayi shift kholne ke liye galla me jo cash daali woh likhein (opening float). Phir saari cash harkat
            isi shift me ginegi aur band karte waqt farq nikal kar aa jayega.
          </p>
          <div className="flex flex-wrap gap-2">
            <input className="input-sm w-36" placeholder="Opening float Rs" value={openingFloat} onChange={(e) => setOpeningFloat(e.target.value)} />
            <input className="input-sm flex-1" placeholder="Note (optional)" value={openingNote} onChange={(e) => setOpeningNote(e.target.value)} />
            <button className="btn-primary" onClick={doOpen} disabled={busy}><Unlock className="h-4 w-4" /> Open shift</button>
          </div>
        </div>
      )}

      {open && flow && (
        <div className="space-y-1">
          <p className="text-xs text-slate-500">
            Khuli: {open.opened_at} · {open.user_name ?? "—"}{open.note ? ` · ${open.note}` : ""}
          </p>
          <Line k="Opening float" v={flow.openingFloatPaisa} />
          <Line k={`Cash sales (${flow.bills} bills)`} v={flow.cashSales} />
          <Line k="Udhaar wasooli" v={flow.collections} />
          <Line k="Refunds" v={flow.refunds} neg />
          <Line k="Supplier ko diya" v={flow.supplierPaid} neg />
          <Line k="Kharchay" v={flow.expenses} neg />
          <Line k="Owner ne nikala" v={flow.drawings} neg />
          <Line k="Expected cash abhi" v={flow.expectedPaisa} bold />

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input className="input-sm w-36" placeholder="Counted cash Rs" value={counted} onChange={(e) => setCounted(e.target.value)} />
            {preview !== null && (
              <span className="text-sm"><VarBadge v={preview} /></span>
            )}
            <input className="input-sm flex-1" placeholder="Band karne ka note (optional)" value={closeNote} onChange={(e) => setCloseNote(e.target.value)} />
            <button className="btn-secondary" onClick={doClose} disabled={busy || counted === ""}><LockKeyhole className="h-4 w-4" /> Close shift</button>
          </div>
          {counted === "" && (
            <p className="flex items-center gap-1 text-[11px] text-slate-500"><AlertTriangle className="h-3 w-3" /> Ginti likhne ke baad hi shift band hogi.</p>
          )}
        </div>
      )}

      {todayVariancePaisa !== 0 && (
        <p className="text-xs text-slate-500">Aaj ke band shifts ka total farq: <VarBadge v={todayVariancePaisa} /></p>
      )}

      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Pichhli shifts</div>
        <div className="max-h-56 overflow-auto">
          <table className="tbl">
            <thead>
              <tr><th>Khuli</th><th>Band</th><th>Kasam</th><th className="text-right">Expected</th><th className="text-right">Ginti</th><th className="text-right">Farq</th></tr>
            </thead>
            <tbody>
              {shifts.map((s) => (
                <tr key={s.id}>
                  <td className="text-xs">{s.opened_at.slice(5, 16)}<div className="text-[11px] text-slate-400">{s.user_name ?? "—"}</div></td>
                  <td className="text-xs">{s.closed_at ? s.closed_at.slice(5, 16) : <span className="text-emerald-700">khuli</span>}</td>
                  <td className="text-xs">{formatPKR(s.opening_float_paisa)}</td>
                  <td className="text-right text-xs">{s.expected_paisa === null ? "—" : formatPKR(s.expected_paisa)}</td>
                  <td className="text-right text-xs">{s.actual_paisa === null ? "—" : formatPKR(s.actual_paisa)}</td>
                  <td className="text-right text-xs">{s.difference_paisa === null ? "—" : <VarBadge v={s.difference_paisa} />}</td>
                </tr>
              ))}
              {shifts.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-sm text-slate-500">Abhi koi shift darj nahi hui.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
