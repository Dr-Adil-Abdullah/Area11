"use client";

// Area11 - Ginti (stock-take): ginno, farq dekho, lagu karo
import { useMemo, useState } from "react";
import { CheckCircle2, ClipboardCheck, PlayCircle, RefreshCw, XCircle } from "lucide-react";
import { formatPKR } from "@/lib/money";

type Item = {
  id: number;
  product_id: number;
  batch_id: number | null;
  system_qty_base: number;
  counted_qty_base: number | null;
  unit_entered: string | null;
  qty_entered: number | null;
  diff_qty_base: number | null;
  value_paisa: number | null;
  product_name?: string;
  batch_no?: string | null;
  expiry_ym?: string | null;
  base_unit?: string;
  box_strips?: number;
  strip_tablets?: number;
  room?: string | null;
  category?: string | null;
  cost_paisa?: number;
};

type Take = {
  id: number;
  code: string;
  status: "open" | "applied" | "cancelled";
  room: string | null;
  category_id: number | null;
  note: string | null;
  items_count: number;
  diff_count: number;
  short_paisa: number;
  extra_paisa: number;
  applied_at: string | null;
};

export default function StockTakeClient({
  initialTakes,
}: {
  initialTakes: (Take & { user_name?: string | null })[];
}) {
  const [takes, setTakes] = useState(initialTakes);
  const [active, setActive] = useState<Take | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [room, setRoom] = useState("");
  const [onlyDiff, setOnlyDiff] = useState(false);

  const key = (it: Item) => `${it.product_id}:${it.batch_id ?? "-"}`;

  const rooms = useMemo(
    () => Array.from(new Set(items.map((i) => i.room).filter((r): r is string => !!r))).sort(),
    [items]
  );

  const shown = useMemo(
    () =>
      items.filter((i) => {
        if (room && (i.room ?? "") !== room) return false;
        if (onlyDiff && !(i.diff_qty_base != null && i.diff_qty_base !== 0)) return false;
        return true;
      }),
    [items, room, onlyDiff]
  );

  const counted = items.filter((i) => i.counted_qty_base != null).length;
  const diffLines = items.filter((i) => i.diff_qty_base != null && i.diff_qty_base !== 0);

  async function openTake() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await (
        await fetch("/api/stock-takes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ room: room || null }),
        })
      ).json();
      if (!r.ok) throw new Error(r.error);
      await load(r.id);
      const list = await (await fetch("/api/stock-takes", { cache: "no-store" })).json();
      if (list.ok) setTakes(list.takes);
      setMsg(`${r.code} khul gayi — ${r.items} line.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function load(id: number) {
    const r = await (await fetch(`/api/stock-takes/${id}`, { cache: "no-store" })).json();
    if (r.ok) {
      setActive(r.take);
      setItems(r.items);
      const c: Record<string, string> = {};
      for (const it of r.items as Item[]) {
        if (it.qty_entered != null) c[`${it.product_id}:${it.batch_id ?? "-"}`] = String(it.qty_entered);
      }
      setCounts(c);
    }
  }

  async function save() {
    if (!active) return;
    setBusy(true);
    setMsg(null);
    try {
      const payload = Object.entries(counts)
        .filter(([, v]) => v.trim() !== "")
        .map(([k, v]) => {
          const [pid, bid] = k.split(":");
          return { productId: Number(pid), batchId: bid === "-" ? null : Number(bid), qty: Number(v), unit: "base" };
        })
        .filter((c) => isFinite(c.qty));
      const r = await (
        await fetch(`/api/stock-takes/${active.id}/counts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ counts: payload }),
        })
      ).json();
      if (!r.ok) throw new Error(r.error);
      await load(active.id);
      setMsg(`${r.saved} line mehfooz. Ab farq neeche nazar aayega.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!active) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await (
        await fetch(`/api/stock-takes/${active.id}/apply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        })
      ).json();
      if (!r.ok) throw new Error(r.error);
      await load(active.id);
      setMsg(`Lagu ho gaya: ${r.changed} farq · kami ${formatPKR(r.shortPaisa)} · ziyada ${formatPKR(r.extraPaisa)}`);
      const list = await (await fetch("/api/stock-takes", { cache: "no-store" })).json();
      if (list.ok) setTakes(list.takes);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Ginti (Stock-take)</h1>
          <p className="text-sm text-slate-500">
            Dukan band kar ke ginno — kitab ka stock, ginti ka stock, farq, phir ek click se durust.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {rooms.length > 0 && (
            <select className="select" value={room} onChange={(e) => setRoom(e.target.value)}>
              <option value="">Sara store</option>
              {rooms.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          )}
          <button className="btn-primary" onClick={openTake} disabled={busy}>
            <PlayCircle className="h-4 w-4" /> Nayi ginti shuru
          </button>
        </div>
      </div>

      {msg && (
        <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{msg}</div>
      )}

      {/* Purani ginti */}
      {takes.length > 0 && (
        <div className="card">
          <div className="card-head"><div className="card-title">Ginti ki tarikh</div></div>
          <div className="card-body overflow-auto">
            <table className="tbl">
              <thead><tr><th>Code</th><th>Tareekh</th><th>Haalat</th><th className="text-right">Lines</th><th className="text-right">Farq</th><th className="text-right">Kami</th><th className="text-right">Ziyada</th><th></th></tr></thead>
              <tbody>
                {takes.map((t) => (
                  <tr key={t.id}>
                    <td className="font-medium">{t.code}</td>
                    <td className="text-xs">{String(t.applied_at ?? "").slice(0, 16) || "—"}</td>
                    <td>
                      <span className={`badge-${t.status === "applied" ? "green" : t.status === "open" ? "amber" : "slate"}`}>
                        {t.status === "open" ? "khuli" : t.status === "applied" ? "lagu" : "cancel"}
                      </span>
                    </td>
                    <td className="text-right">{t.items_count}</td>
                    <td className="text-right">{t.diff_count}</td>
                    <td className="text-right text-rose-600">{formatPKR(t.short_paisa)}</td>
                    <td className="text-right text-emerald-700">{formatPKR(t.extra_paisa)}</td>
                    <td>
                      <button className="btn-link" onClick={() => load(t.id)}>kholo</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {active && (
        <>
          <div className="card">
            <div className="card-head">
              <div className="card-title">
                {active.code} · <span className="text-slate-500">{counted}/{items.length} ginti hui</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-rose-600">Kami {formatPKR(active.short_paisa)}</span>
                <span className="text-emerald-700">Ziyada {formatPKR(active.extra_paisa)}</span>
              </div>
            </div>
            <div className="card-body space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} />
                Sirf woh dikhain jin me farq hai ({diffLines.length})
              </label>

              <div className="overflow-auto">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Dawa</th><th>Batch</th>
                      <th className="text-right">Kitab</th>
                      <th className="text-right">Ginti</th>
                      <th className="text-right">Farq</th>
                      <th className="text-right">Qeemat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((it) => {
                      const d = it.diff_qty_base;
                      return (
                        <tr key={it.id} className={d != null && d !== 0 ? "bg-amber-50/60" : undefined}>
                          <td className="font-medium">
                            {it.product_name}
                            <div className="text-[11px] text-slate-400">{it.room ?? "—"}</div>
                          </td>
                          <td className="text-xs">{it.batch_no ?? "—"}{it.expiry_ym ? ` · ${it.expiry_ym}` : ""}</td>
                          <td className="text-right">{it.system_qty_base} {it.base_unit}</td>
                          <td className="text-right">
                            <input
                              className="input w-24 text-right"
                              inputMode="decimal"
                              placeholder="—"
                              disabled={active.status !== "open"}
                              value={counts[key(it)] ?? ""}
                              onChange={(e) => setCounts((c) => ({ ...c, [key(it)]: e.target.value }))}
                            />
                          </td>
                          <td className={`text-right font-medium ${d == null ? "" : d < 0 ? "text-rose-600" : d > 0 ? "text-emerald-700" : "text-slate-400"}`}>
                            {d == null ? "—" : d > 0 ? `+${d}` : d}
                          </td>
                          <td className="text-right text-xs">{d != null && d !== 0 ? formatPKR(it.value_paisa ?? 0) : "—"}</td>
                        </tr>
                      );
                    })}
                    {shown.length === 0 && (
                      <tr><td colSpan={6} className="py-6 text-center text-sm text-slate-500">Koi line nahi.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {active.status === "open" ? (
                <div className="flex flex-wrap gap-2">
                  <button className="btn-primary" onClick={save} disabled={busy}><ClipboardCheck className="h-4 w-4" /> Ginti mehfooz karo</button>
                  <button className="btn-secondary" onClick={apply} disabled={busy}><CheckCircle2 className="h-4 w-4" /> Farq lagu karo</button>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  {active.status === "applied" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-slate-400" />}
                  Ye ginti {active.status === "applied" ? "lagu ho chuki hai" : "cancel ho chuki hai"} — ab badli nahi ja sakti.
                  <button className="btn-link" onClick={() => load(active.id)}><RefreshCw className="h-3 w-3" /> taza karo</button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
