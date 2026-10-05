"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { formatPKR, toPaisa } from "@/lib/money";
import ShiftCard from "./ShiftCard";
import type { ShiftFlow, ShiftRow } from "@/lib/shifts";

type S = { day: string; bills: number; voided: number; salesTotal: number; creditGiven: number; returnsTotal: number; profit: number; cashIn: number; cashRefunds: number; supplierPaid: number; expenses: number; drawings: number; expectedCash: number };

type ShiftData = {
  open: ShiftRow | null; flow: ShiftFlow | null; shifts: ShiftRow[];
  users?: { id: number; name: string; role: string }[];
  todayVariancePaisa: number;
};

export default function CashClient({ summary: s, expenses, drawings, shift }: { summary: S; expenses: { id: number; date: string; category: string; title: string; amount_paisa: number }[]; drawings: { id: number; date: string; type: string; amount_paisa: number; note: string | null }[]; shift: ShiftData }) {
  const router = useRouter();
  const [ex, setEx] = useState({ title: "", amount: "", category: "other" });
  const [dr, setDr] = useState({ amount: "", note: "", type: "cash" });
  const [counted, setCounted] = useState("");
  const [msg, setMsg] = useState("");
  const diff = counted === "" ? null : toPaisa(counted) - s.expectedCash;

  async function post(body: unknown) {
    setMsg("");
    const r = await (await fetch("/api/cash", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
    if (!r.ok) return setMsg(r.error);
    router.refresh();
  }
  const Row = ({ k, v, bold, neg }: { k: string; v: number; bold?: boolean; neg?: boolean }) => (
    <div className={`flex justify-between py-1 text-sm ${bold ? "border-t border-slate-300 pt-2 font-semibold" : "text-slate-600"}`}><span>{k}</span><span>{neg ? "− " : ""}{formatPKR(v)}</span></div>);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-xl font-semibold text-slate-800">Cash &amp; day-end</h1><p className="text-sm text-slate-500">Day: {s.day} (add <code>?day=YYYY-MM-DD</code> for another day)</p></div>
        <a href="/api/backup" className="btn-secondary"><Download className="h-4 w-4" /> Download database backup</a>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card card-body">
          <div className="card-title mb-2">Day summary</div>
          <Row k={`Sales (${s.bills} bills${s.voided ? `, ${s.voided} void` : ""})`} v={s.salesTotal} />
          <Row k="of which given on credit" v={s.creditGiven} />
          <Row k="Returns refunded" v={s.returnsTotal} />
          <Row k="Profit (after returns)" v={s.profit} />
          <div className="my-2 border-t" />
          <Row k="Cash received (sales + udhaar wasooli)" v={s.cashIn} />
          <Row k="Customer refunds" v={s.cashRefunds} neg />
          <Row k="Paid to suppliers" v={s.supplierPaid} neg />
          <Row k="Expenses" v={s.expenses} neg />
          <Row k="Owner cash drawings" v={s.drawings} neg />
          <Row k="Expected cash from today's activity" v={s.expectedCash} bold />
          <p className="mt-1 text-[11px] text-slate-500">Note: this is only today&apos;s movement. Opening float + farq (variance) ke liye upar wala <b>Cash shift (galla)</b> card dekhein.</p>
          <div className="mt-3 flex items-center gap-2"><input className="input-sm w-40" placeholder="Counted cash Rs" value={counted} onChange={(e) => setCounted(e.target.value)} />
            {diff !== null && <span className={`text-sm font-medium ${diff === 0 ? "text-emerald-700" : "text-rose-600"}`}>{diff === 0 ? "Matches" : diff > 0 ? `Excess ${formatPKR(diff)}` : `Short ${formatPKR(-diff)}`}</span>}</div>
        </div>
        <div className="space-y-4">
          <ShiftCard
            open={shift.open}
            flow={shift.flow}
            shifts={shift.shifts}
            users={shift.users ?? []}
            todayVariancePaisa={shift.todayVariancePaisa}
          />
          <div className="card card-body space-y-2"><div className="card-title">Add expense</div>
            <div className="flex flex-wrap gap-2"><input className="input-sm flex-1" placeholder="What for? (rent, tea, electricity…)" value={ex.title} onChange={(e) => setEx({ ...ex, title: e.target.value })} />
              <input className="input-sm w-28" placeholder="Rs" value={ex.amount} onChange={(e) => setEx({ ...ex, amount: e.target.value })} />
              <button className="btn-primary" onClick={() => { post({ kind: "expense", title: ex.title, category: ex.category, amountPaisa: toPaisa(ex.amount || 0) }); setEx({ title: "", amount: "", category: "other" }); }}>Save</button></div>
            <ul className="text-xs text-slate-600">{expenses.map((e) => <li key={e.id} className="flex justify-between border-b py-1"><span>{e.date.slice(0, 10)} • {e.title}</span><span>{formatPKR(e.amount_paisa)}</span></li>)}</ul></div>
          <div className="card card-body space-y-2"><div className="card-title">Owner drawing (personal cash taken)</div>
            <div className="flex flex-wrap gap-2"><input className="input-sm flex-1" placeholder="Note" value={dr.note} onChange={(e) => setDr({ ...dr, note: e.target.value })} />
              <select className="select !py-1 !text-xs w-24" value={dr.type} onChange={(e) => setDr({ ...dr, type: e.target.value })}><option value="cash">Cash</option><option value="goods">Goods</option></select>
              <input className="input-sm w-28" placeholder="Rs" value={dr.amount} onChange={(e) => setDr({ ...dr, amount: e.target.value })} />
              <button className="btn-primary" onClick={() => { post({ kind: "drawing", type: dr.type, note: dr.note, amountPaisa: toPaisa(dr.amount || 0) }); setDr({ amount: "", note: "", type: "cash" }); }}>Save</button></div>
            <ul className="text-xs text-slate-600">{drawings.map((d) => <li key={d.id} className="flex justify-between border-b py-1"><span>{d.date.slice(0, 10)} • {d.type} {d.note ?? ""}</span><span>{formatPKR(d.amount_paisa)}</span></li>)}</ul></div>
          {msg && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{msg}</div>}
        </div>
      </div>
    </div>
  );
}
