"use client";

// Area11 - Sare records ek file se UPDATE karna (photos ke baghair)
// Tareeqa: file download karein -> badlein -> upload -> Preview -> Update

import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, PencilLine, SkipForward, Upload } from "lucide-react";
import type { BulkPreview, BulkResult } from "@/lib/bulk";

export default function BulkUpdateCard() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [includeSettings, setIncludeSettings] = useState(false);
  const [preview, setPreview] = useState<BulkPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<BulkResult | null>(null);
  const [show, setShow] = useState<"ok" | "all" | "skip">("ok");

  async function doPreview(f: File, withSettings: boolean) {
    setBusy(true);
    setError("");
    setResult(null);
    setPreview(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      if (withSettings) fd.append("includeSettings", "1");
      const r = await fetch("/api/bulk/preview", { method: "POST", body: fd });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "preview fail");
      setPreview(j.preview as BulkPreview);
    } catch (e) {
      setError(e instanceof Error ? e.message : "preview fail");
    } finally {
      setBusy(false);
    }
  }

  async function doCommit() {
    if (!file || !preview) return;
    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (includeSettings) fd.append("includeSettings", "1");
      const r = await fetch("/api/bulk/commit", { method: "POST", body: fd });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "update fail");
      setResult({
        products: j.products, customers: j.customers, suppliers: j.suppliers,
        categories: j.categories, companies: j.companies, batches: j.batches,
        settings: j.settings, skipped: j.skipped,
      });
      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
      setFile(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "update fail");
    } finally {
      setBusy(false);
    }
  }

  const rows = preview
    ? preview.rows.filter((r) => (show === "all" ? true : r.status === show))
    : [];

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="flex items-center gap-2 font-semibold">
        <PencilLine size={18} /> Sare records file se UPDATE karein
      </h2>
      <p className="mt-1 text-sm text-gray-600">
        Neeche diye button se <b>apna poora data</b> (dawayen, gahak, supplier, categories, companies, batches, settings —{" "}
        <b>photos ke baghair</b>) Excel me lein, jo bhi badalna hai wahi cell badlein, phir wapas upload karein.{" "}
        <b>Khaali cell = koi tabdeeli nahi.</b> Aap ki ijazat ke baghair database me kuch nahi jayega.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <a
          href="/api/export"
          className="inline-flex items-center gap-2 rounded bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-900"
        >
          <Download size={16} /> Apna data download karein (.xlsx)
        </a>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setFile(f);
            if (f) void doPreview(f, includeSettings);
            else setPreview(null);
          }}
          className="text-sm"
        />
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={includeSettings}
            onChange={(e) => {
              setIncludeSettings(e.target.checked);
              if (file) void doPreview(file, e.target.checked);
            }}
          />
          Settings bhi badalni hain
        </label>
        {busy && <span className="text-sm text-gray-500">… ruk jayein</span>}
      </div>

      {error && (
        <p className="mt-3 flex items-center gap-2 rounded bg-red-50 p-2 text-sm text-red-700">
          <AlertTriangle size={16} /> {error}
        </p>
      )}

      {preview && (
        <div className="mt-4">
          <h3 className="flex items-center gap-2 font-semibold">
            Preview — kya kya badal raha hai (abhi kuch save nahi hua)
          </h3>

          {preview.rows.length === 0 ? (
            <p className="mt-3 rounded bg-amber-50 p-3 text-sm text-amber-800">
              File me koi bhari hui line nahi mili. Sheets ke naam wahi hone chahiye jo download ki file me hain
              (Products · Customers · Suppliers · Categories · Companies · Stock · Settings).
            </p>
          ) : (
            <>
              <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                <div className="rounded bg-emerald-50 p-3">
                  <div className="text-2xl font-bold text-emerald-800">{preview.counts.ok}</div>
                  <div className="text-emerald-700">badlenge</div>
                </div>
                <div className="rounded bg-gray-50 p-3">
                  <div className="text-2xl font-bold text-gray-700">{preview.counts.skip}</div>
                  <div className="text-gray-600">chhod denge</div>
                </div>
                <div className="rounded bg-red-50 p-3">
                  <div className="text-2xl font-bold text-red-700">{preview.counts.error}</div>
                  <div className="text-red-600">masla</div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-gray-500">Sheets:</span>
                {Object.entries(preview.totals).map(([sheet, t]) => (
                  <span key={sheet} className="rounded bg-gray-100 px-2 py-0.5">
                    {sheet}: {t.ok} badlenge · {t.skip} chhod
                  </span>
                ))}
              </div>

              <div className="mt-3 flex items-center gap-2 text-sm">
                <button onClick={() => setShow("ok")} className={`rounded px-2 py-1 ${show === "ok" ? "bg-gray-800 text-white" : "bg-gray-100"}`}>
                  Sirf badalne wali ({preview.counts.ok})
                </button>
                <button onClick={() => setShow("skip")} className={`rounded px-2 py-1 ${show === "skip" ? "bg-gray-800 text-white" : "bg-gray-100"}`}>
                  Chhodi jane wali ({preview.counts.skip})
                </button>
                <button onClick={() => setShow("all")} className={`rounded px-2 py-1 ${show === "all" ? "bg-gray-800 text-white" : "bg-gray-100"}`}>
                  Sab ({preview.rows.length})
                </button>
              </div>

              <div className="mt-2 max-h-80 overflow-auto rounded border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50 text-left">
                    <tr>
                      <th className="p-2">Sheet</th>
                      <th className="p-2">Line</th>
                      <th className="p-2">Record</th>
                      <th className="p-2">Tabdeeli</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="p-2 text-gray-500">{r.sheet}</td>
                        <td className="p-2 text-gray-500">{r.rowNo}</td>
                        <td className="p-2 font-medium">{r.title}</td>
                        <td className="p-2 text-gray-700">
                          {r.changes.length > 0 ? r.changes.join(" · ") : r.messages.join(" · ")}
                        </td>
                        <td className="p-2">
                          {r.status === "ok" && (
                            <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 size={14} /> badlega</span>
                          )}
                          {r.status === "skip" && (
                            <span className="inline-flex items-center gap-1 text-gray-500"><SkipForward size={14} /> chhoda</span>
                          )}
                          {r.status === "error" && (
                            <span className="inline-flex items-center gap-1 text-red-700"><AlertTriangle size={14} /> masla</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr><td colSpan={5} className="p-4 text-center text-gray-500">Is filter me koi line nahi.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  onClick={doCommit}
                  disabled={busy || preview.counts.ok === 0}
                  className="inline-flex items-center gap-2 rounded bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-800 disabled:opacity-40"
                >
                  <Upload size={16} /> {preview.counts.ok} tabdeeliyan lagu karein
                </button>
                <span className="text-sm text-gray-500">
                  Jo record nahi mila wo chhoR diya jayega — naya record banane ke liye upar wala import istemal karein.
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {result && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <h3 className="flex items-center gap-2 font-semibold text-emerald-900">
            <CheckCircle2 size={18} /> Update mukammal
          </h3>
          <ul className="mt-2 list-inside list-disc text-sm text-emerald-900">
            <li>Dawayen: <b>{result.products}</b></li>
            <li>Gahak: <b>{result.customers}</b></li>
            <li>Supplier: <b>{result.suppliers}</b></li>
            <li>Categories: <b>{result.categories}</b> · Companies: <b>{result.companies}</b></li>
            <li>Batches (batch no / expiry / rate): <b>{result.batches}</b></li>
            {result.settings > 0 && <li>Settings: <b>{result.settings}</b></li>}
            <li>ChhoR diye gaye (koi tabdeeli nahi ya record na mila): <b>{result.skipped}</b></li>
          </ul>
          <p className="mt-2 text-sm text-emerald-800">
            Ab <a className="underline" href="/products">Products</a> · <a className="underline" href="/customers">Customers</a> ·{" "}
            <a className="underline" href="/suppliers">Suppliers</a> ke safhon par ja kar farq dekh lein.
          </p>
        </div>
      )}
    </section>
  );
}
