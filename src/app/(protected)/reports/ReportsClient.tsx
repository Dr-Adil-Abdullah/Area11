"use client";

// Area11 - Reports: roz / hafta / mahina — bikri, munafa, top dawayen, dead stock
import { useMemo, useState } from "react";
import { CalendarRange, Download, MessageCircle } from "lucide-react";
import { formatPKR } from "@/lib/money";

type Totals = {
  bills: number; itemsSold: number; salesPaisa: number; discountPaisa: number;
  costPaisa: number; profitPaisa: number; cashPaisa: number; creditPaisa: number;
  refundPaisa: number; expensesPaisa: number; purchasesPaisa: number;
  avgBillPaisa: number; marginPercent: number;
};

type Data = {
  range: { from: string; to: string };
  totals: Totals;
  top: { product_id: number; name: string; qty: number; value: number; profit: number }[];
  daily: { day: string; sales: number; profit: number; bills: number }[];
  categories: { name: string; value: number; profit: number }[];
  dead: { product_id: number; name: string; stock: number; lastSold: string | null; days: number | null }[];
};

function Card({ title, value, hint, tone }: { title: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="card card-body">
      <div className="text-xs text-slate-500">{title}</div>
      <div className={`text-lg font-semibold ${tone ?? "text-slate-800"}`}>{value}</div>
      {hint && <div className="text-[11px] text-slate-400">{hint}</div>}
    </div>
  );
}

export default function ReportsClient({ initial, whatsappEnabled }: { initial: Data; whatsappEnabled: boolean }) {
  const [preset, setPreset] = useState<"today" | "7" | "30" | "month">("today");
  const [data, setData] = useState<Data>(initial);
  const [loading, setLoading] = useState(false);

  /** Range badlo: server se naya hisab lao (page reload ke baghair) */
  async function pick(p: "today" | "7" | "30" | "month") {
    setPreset(p);
    setLoading(true);
    try {
      const r = await (await fetch(`/api/reports?preset=${p}`, { cache: "no-store" })).json();
      if (r.ok) setData({ range: r.range, totals: r.totals, top: r.top, daily: r.daily, categories: r.categories, dead: r.dead });
    } finally {
      setLoading(false);
    }
  }

  const maxSale = useMemo(() => Math.max(1, ...data.daily.map((d) => d.sales)), [data.daily]);

  function csv() {
    const rows = [
      ["Day", "Bills", "Sales (Rs)", "Profit (Rs)"],
      ...data.daily.map((d) => [d.day, String(d.bills), String(d.sales / 100), String(d.profit / 100)]),
    ];
    const blob = new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `area11-report-${data.range.from}_${data.range.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function sendWhatsApp() {
    const p = new URLSearchParams({ kind: "day", date: data.range.from });
    const r = await (await fetch(`/api/whatsapp?${p}`, { cache: "no-store" })).json();
    if (r.ok && r.link) window.open(r.link, "_blank", "noopener");
  }

  const t = data.totals;

  return (
    <div className="space-y-4 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Reports</h1>
          <p className="text-sm text-slate-500">
            {data.range.from} se {data.range.to} tak{loading ? " …" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["today", "7", "30", "month"] as const).map((p) => (
            <button
              key={p}
              onClick={() => pick(p)}
              className={`rounded px-3 py-1 text-sm ${preset === p ? "bg-slate-800 text-white" : "bg-slate-100"}`}
            >
              {p === "today" ? "Aaj" : p === "7" ? "7 din" : p === "30" ? "30 din" : "Is mahine"}
            </button>
          ))}
          <button className="btn-secondary" onClick={csv}><Download className="h-4 w-4" /> CSV</button>
          {whatsappEnabled && (
            <button className="btn-secondary" onClick={sendWhatsApp}><MessageCircle className="h-4 w-4" /> WhatsApp</button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card title="Bills" value={String(t.bills)} hint={`${t.itemsSold} items`} />
        <Card title="Bikri" value={formatPKR(t.salesPaisa)} hint={`Afsos: ${formatPKR(t.discountPaisa)} discount`} />
        <Card title="Munafa" value={formatPKR(t.profitPaisa)} hint={`${t.marginPercent}% margin`} tone="text-emerald-700" />
        <Card title="Afsat bill" value={formatPKR(t.avgBillPaisa)} hint="average" />
        <Card title="Naqad" value={formatPKR(t.cashPaisa)} />
        <Card title="Udhaar" value={formatPKR(t.creditPaisa)} tone="text-amber-700" />
        <Card title="Wapasi" value={formatPKR(t.refundPaisa)} tone="text-rose-600" />
        <Card title="Kharchay" value={formatPKR(t.expensesPaisa)} hint={`Khareed: ${formatPKR(t.purchasesPaisa)}`} />
      </div>

      {/* Roz ka graph (simple bars) */}
      {data.daily.length > 0 && (
        <div className="card">
          <div className="card-head"><div className="card-title">Roz ki bikri</div><CalendarRange className="h-4 w-4 text-slate-400" /></div>
          <div className="card-body space-y-1">
            {data.daily.map((d) => (
              <div key={d.day} className="flex items-center gap-2 text-xs">
                <span className="w-24 shrink-0 text-slate-500">{d.day.slice(5)}</span>
                <div className="h-3 flex-1 rounded bg-slate-100">
                  <div className="h-3 rounded bg-emerald-500" style={{ width: `${Math.round((d.sales / maxSale) * 100)}%` }} />
                </div>
                <span className="w-24 text-right font-medium">{formatPKR(d.sales)}</span>
                <span className="w-24 text-right text-emerald-700">{formatPKR(d.profit)}</span>
                <span className="w-12 text-right text-slate-400">{d.bills}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <div className="card-head"><div className="card-title">Sab se zyada bikne wali</div></div>
          <div className="card-body overflow-auto">
            <table className="tbl">
              <thead><tr><th>#</th><th>Dawa</th><th className="text-right">Qty</th><th className="text-right">Bikri</th><th className="text-right">Munafa</th></tr></thead>
              <tbody>
                {data.top.map((p, i) => (
                  <tr key={p.product_id}>
                    <td className="text-xs text-slate-400">{i + 1}</td>
                    <td className="font-medium">{p.name}</td>
                    <td className="text-right">{p.qty}</td>
                    <td className="text-right">{formatPKR(p.value)}</td>
                    <td className="text-right text-emerald-700">{formatPKR(p.profit)}</td>
                  </tr>
                ))}
                {data.top.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-sm text-slate-500">Is dauran koi bikri nahi.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><div className="card-title">Category ke hisaab se</div></div>
          <div className="card-body overflow-auto">
            <table className="tbl">
              <thead><tr><th>Category</th><th className="text-right">Bikri</th><th className="text-right">Munafa</th></tr></thead>
              <tbody>
                {data.categories.map((c) => (
                  <tr key={c.name}>
                    <td className="font-medium">{c.name}</td>
                    <td className="text-right">{formatPKR(c.value)}</td>
                    <td className="text-right text-emerald-700">{formatPKR(c.profit)}</td>
                  </tr>
                ))}
                {data.categories.length === 0 && <tr><td colSpan={3} className="py-6 text-center text-sm text-slate-500">Koi data nahi.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div className="card-title">Dead stock (60 din se nahi biki)</div>
          <span className="badge-slate">{data.dead.length}</span>
        </div>
        <div className="card-body overflow-auto">
          <table className="tbl">
            <thead><tr><th>Dawa</th><th className="text-right">Stock</th><th>Aakhri bikri</th><th className="text-right">Din</th></tr></thead>
            <tbody>
              {data.dead.map((d) => (
                <tr key={d.product_id}>
                  <td className="font-medium">{d.name}</td>
                  <td className="text-right">{d.stock}</td>
                  <td className="text-xs">{d.lastSold ?? "kabhi nahi"}</td>
                  <td className="text-right text-xs">{d.days ?? "—"}</td>
                </tr>
              ))}
              {data.dead.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-sm text-slate-500">Sab dawayen chal rahi hain.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
