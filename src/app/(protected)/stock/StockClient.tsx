"use client";

import { useState } from "react";
import { AlertTriangle, PackageMinus, PackagePlus, Search } from "lucide-react";
import { formatAmount, formatPKR } from "@/lib/money";
import type { AdjustmentRow } from "@/lib/stock";

type PosBatch = {
  id: number;
  batch_no: string | null;
  expiry_ym: string | null;
  qty_base: number;
  cost_paisa: number;
  status: string;
};

type PosProduct = {
  id: number;
  name: string;
  base_unit: string;
  box_strips: number;
  strip_tablets: number;
  batch_count?: number;
  batches?: PosBatch[];
};

const REASONS: { value: string; label: string }[] = [
  { value: "expired", label: "Expired (tareekh guzar gayi)" },
  { value: "damaged", label: "Damaged / toota hua" },
  { value: "lost", label: "Lost / gayab" },
  { value: "count_short", label: "Count short (ginti me kam)" },
  { value: "count_extra", label: "Count extra (ginti me zyada)" },
  { value: "other", label: "Other" },
];

export default function StockClient({
  initialAdjustments,
  initialSummary,
}: {
  initialAdjustments: AdjustmentRow[];
  initialSummary: { todayPaisa: number; monthPaisa: number };
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PosProduct[]>([]);
  const [product, setProduct] = useState<PosProduct | null>(null);
  const [batchId, setBatchId] = useState("");
  const [direction, setDirection] = useState<"out" | "in">("out");
  const [unit, setUnit] = useState<"box" | "strip" | "base">("base");
  const [qty, setQty] = useState("1");
  const [reason, setReason] = useState("expired");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [adjustments, setAdjustments] = useState<AdjustmentRow[]>(initialAdjustments);
  const [summary, setSummary] = useState(initialSummary);

  async function search(term: string) {
    setQ("");
    setResults([]);
    setProduct(null);
    setError("");
    setDone("");
    if (!term.trim()) return;
    const res = await fetch(`/api/pos/search?q=${encodeURIComponent(term)}&limit=10`, {
      cache: "no-store",
    });
    const data = await res.json();
    if (data.ok) setResults(data.products as PosProduct[]);
    else setError(data.error ?? "Search failed");
  }

  function pickProduct(p: PosProduct) {
    setProduct(p);
    setResults([]);
    setBatchId(p.batches?.[0] ? String(p.batches[0].id) : "");
    setDone("");
    setError("");
  }

  async function refresh(productId?: number) {
    const url = productId ? `/api/stock/adjust?productId=${productId}` : "/api/stock/adjust";
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    if (data.ok) {
      setAdjustments(data.adjustments as AdjustmentRow[]);
      setSummary(data.summary);
    }
  }

  async function submit() {
    if (!product) {
      setError("Pehle product search kar ke select karein");
      return;
    }
    if (!batchId) {
      setError("Batch select karein");
      return;
    }
    setBusy(true);
    setError("");
    setDone("");
    try {
      const res = await fetch("/api/stock/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          batchId: Number(batchId),
          unit,
          qty: Number(qty),
          direction,
          reason,
          note: note || null,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Save nahi hua");
        setBusy(false);
        return;
      }
      setDone(
        `${data.productName}: ${direction === "out" ? "kami" : "izafa"} ${data.qtyBase} ${
          product.base_unit
        } (value ${formatPKR(data.valuePaisa)}) — batch me ab ${data.newBatchQty}, total ${data.newProductQty}`
      );
      setQty("1");
      setNote("");
      // product ki taaza stock dobara lo
      const refreshed = await fetch(`/api/pos/search?q=${encodeURIComponent(product.name)}&limit=1`, {
        cache: "no-store",
      }).then((r) => r.json());
      if (refreshed.ok && refreshed.products?.[0]) {
        setProduct(refreshed.products[0]);
        const stillThere = (refreshed.products[0].batches ?? []).find(
          (b: PosBatch) => String(b.id) === batchId
        );
        setBatchId(stillThere ? batchId : String(refreshed.products[0].batches?.[0]?.id ?? ""));
      }
      await refresh();
    } catch {
      setError("Network masla — dobara koshish karein");
    }
    setBusy(false);
  }

  const selectedBatch = product?.batches?.find((b) => String(b.id) === batchId);
  const perUnit =
    unit === "box"
      ? (product?.box_strips ?? 1) * (product?.strip_tablets ?? 1)
      : unit === "strip"
        ? (product?.strip_tablets ?? 1)
        : 1;
  const qtyBase = (Number(qty) || 0) * perUnit;
  const estValue = selectedBatch ? Math.round(qtyBase * selectedBatch.cost_paisa) : 0;

  return (
    <div className="space-y-5 pb-10">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Stock adjust &amp; write-off</h1>
        <p className="text-sm text-slate-500">
          Kharab/expired mal ka nuqsan, ya ginti ki durusti. Har tabdeeli ka apna record banta hai
          (stock movement + audit) — kuch bhi chupke se nahi hota. Value hamesha purchase cost par.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="card">
          <div className="card-body">
            <div className="text-xs font-medium text-slate-500">Aaj ka nuqsan (cost par)</div>
            <div className="text-xl font-semibold text-slate-800">{formatPKR(summary.todayPaisa)}</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="text-xs font-medium text-slate-500">Is mahine ka nuqsan (cost par)</div>
            <div className="text-xl font-semibold text-slate-800">{formatPKR(summary.monthPaisa)}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div className="card-title">1) Product chunein</div>
        </div>
        <div className="card-body space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                className="input pl-9"
                placeholder="Naam / salt / barcode / rack likhein aur Enter dabayein"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void search(q);
                }}
                autoFocus
              />
            </div>
            <button className="btn-secondary" onClick={() => void search(q)}>
              Search
            </button>
          </div>

          {results.length > 0 && (
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {results.map((p) => (
                <button
                  key={p.id}
                  onClick={() => pickProduct(p)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
                >
                  <span className="font-medium text-slate-700">{p.name}</span>
                  <span className="badge-slate">{p.batch_count ?? 0} batches</span>
                </button>
              ))}
            </div>
          )}

          {product && (
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <span className="font-medium text-slate-700">{product.name}</span>{" "}
              <span className="text-slate-500">
                — {product.base_unit} base unit · {product.box_strips} strip/box ·{" "}
                {product.strip_tablets} {product.base_unit}/strip
              </span>
            </div>
          )}
        </div>
      </div>

      {product && (
        <div className="card">
          <div className="card-head">
            <div className="card-title">2) Nuqsan ya izafa darj karein</div>
          </div>
          <div className="card-body grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Batch</label>
              <select className="select" value={batchId} onChange={(e) => setBatchId(e.target.value)}>
                <option value="">Select batch…</option>
                {(product.batches ?? []).map((b) => (
                  <option key={b.id} value={b.id}>
                    {(b.batch_no || "no batch") +
                      (b.expiry_ym ? ` · exp ${b.expiry_ym}` : "") +
                      ` · stock ${b.qty_base} · cost ${formatAmount(b.cost_paisa, 2)}`}
                  </option>
                ))}
              </select>
              {(product.batches ?? []).length === 0 && (
                <p className="mt-1 text-[11px] text-amber-700">
                  Is product ka koi batch nahi mila (stock 0) — pehle purchase (stock-in) karein.
                </p>
              )}
            </div>

            <div>
              <label className="label">Kya hua?</label>
              <div className="flex gap-2">
                <button
                  className={direction === "out" ? "btn-primary !py-1.5 !text-xs" : "btn-secondary !py-1.5 !text-xs"}
                  onClick={() => setDirection("out")}
                >
                  <PackageMinus className="h-4 w-4" /> Nuqsan / kami
                </button>
                <button
                  className={direction === "in" ? "btn-primary !py-1.5 !text-xs" : "btn-secondary !py-1.5 !text-xs"}
                  onClick={() => setDirection("in")}
                >
                  <PackagePlus className="h-4 w-4" /> Izafa / mila
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Kitna?</label>
                <input className="input" value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" />
              </div>
              <div>
                <label className="label">Unit</label>
                <select className="select" value={unit} onChange={(e) => setUnit(e.target.value as "box" | "strip" | "base")}>
                  <option value="box">Box</option>
                  <option value="strip">Strip</option>
                  <option value="base">{product.base_unit}</option>
                </select>
              </div>
            </div>

            <div>
              <label className="label">Wajah (reason)</label>
              <select className="select" value={reason} onChange={(e) => setReason(e.target.value)}>
                {REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="label">Note (optional)</label>
              <input
                className="input"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="misal: Ghar se laaye hue 2 strips toot gaye"
              />
            </div>

            <div className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                <span>
                  Base units: <b>{qtyBase || 0}</b> {product.base_unit}
                </span>
                <span>
                  Cost par value: <b>{formatPKR(estValue)}</b>
                </span>
                {selectedBatch && (
                  <span className="text-slate-500">
                    Batch me abhi: {selectedBatch.qty_base} {product.base_unit}
                  </span>
                )}
              </div>
            </div>

            {error && (
              <div className="md:col-span-2 flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {error}
              </div>
            )}
            {done && (
              <div className="md:col-span-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                {done}
              </div>
            )}

            <div className="md:col-span-2">
              <button className="btn-primary" onClick={() => void submit()} disabled={busy || !batchId}>
                {busy ? "Saving…" : "Save karein"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <div className="card-title">Aakhri adjustments</div>
          <span className="text-xs text-slate-500">{adjustments.length} records</span>
        </div>
        <div className="card-body overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Date</th>
                <th>Product</th>
                <th>Batch</th>
                <th>Kya</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Value</th>
                <th>Reason</th>
                <th>Kisne</th>
              </tr>
            </thead>
            <tbody>
              {adjustments.map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap text-xs text-slate-500">{a.date}</td>
                  <td className="font-medium text-slate-700">{a.product_name}</td>
                  <td className="text-xs text-slate-500">{a.batch_no ?? "—"}</td>
                  <td>
                    {a.direction === "out" ? (
                      <span className="badge-red">kami</span>
                    ) : (
                      <span className="badge-green">izafa</span>
                    )}
                  </td>
                  <td className="text-right">
                    {a.qty_base} {a.base_unit}
                    {a.unit_entered && a.unit_entered !== "base" && a.qty_entered != null
                      ? ` (${a.qty_entered} ${a.unit_entered})`
                      : ""}
                  </td>
                  <td className="text-right">{formatPKR(a.value_paisa)}</td>
                  <td className="text-xs text-slate-500">{REASONS.find((r) => r.value === a.reason)?.label ?? a.reason}</td>
                  <td className="text-xs text-slate-500">{a.user_name ?? "—"}</td>
                </tr>
              ))}
              {adjustments.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-sm text-slate-400">
                    Abhi koi adjustment nahi hui.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
