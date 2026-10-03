"use client";

// Area11 - Excel import screen (owner + manager)
// Tareeqa: file chunein -> Preview (dry-run) -> theek lines confirm karein

import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, SkipForward, Upload } from "lucide-react";
import type { ImportPreview } from "@/lib/import";

type CommitResult = { products: number; customers: number; suppliers: number; batches: number; stockBase: number };

export default function ImportClient() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CommitResult | null>(null);
  const [show, setShow] = useState<"all" | "error" | "skip">("all");

  async function doPreview(f: File) {
    setBusy(true); setError(""); setResult(null); setPreview(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch("/api/import/preview", { method: "POST", body: fd });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "preview fail");
      setPreview(j.preview as ImportPreview);
    } catch (e) {
      setError(e instanceof Error ? e.message : "preview fail");
    } finally {
      setBusy(false);
    }
  }

  async function doCommit() {
    if (!file || !preview) return;
    setBusy(true); setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/import/commit", { method: "POST", body: fd });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "import fail");
      setResult({ products: j.products, customers: j.customers, suppliers: j.suppliers, batches: j.batches, stockBase: j.stockBase });
      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
      setFile(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "import fail");
    } finally {
      setBusy(false);
    }
  }

  const rows = preview
    ? preview.rows.filter((r) => (show === "all" ? true : r.status === show))
    : [];

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4">
      <div>
        <h1 className="text-xl font-bold">Import old data (Excel)</h1>
        <p className="mt-1 text-sm text-gray-600">
          Purani dawaon ki list, gahak aur supplier — sab Excel se aa jayenge. Pehle <b>Preview</b> dikhega,
          aap ki ijazat ke baghair database me kuch nahi jayega.
        </p>
      </div>

      {/* Step 1: template */}
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="font-semibold">Step 1 — Namoona file (template) lein</h2>
        <p className="mt-1 text-sm text-gray-600">
          Is file me Products · Customers · Suppliers ki sheets aur ek example line hai. Header ki line na badlein.
        </p>
        <a
          href="/api/import/template"
          className="mt-3 inline-flex items-center gap-2 rounded bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800"
        >
          <Download size={16} /> Area11-import-template.xlsx
        </a>
      </section>

      {/* Step 2: upload + preview */}
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="font-semibold">Step 2 — Bhari hui file upload karein (Preview)</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              if (f) void doPreview(f);
              else setPreview(null);
            }}
            className="text-sm"
          />
          {busy && <span className="text-sm text-gray-500">… ruk jayein</span>}
        </div>
        {error && (
          <p className="mt-3 flex items-center gap-2 rounded bg-red-50 p-2 text-sm text-red-700">
            <AlertTriangle size={16} /> {error}
          </p>
        )}
      </section>

      {/* Preview result */}
      {preview && (
        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <FileSpreadsheet size={18} /> Preview — kuch bhi save nahi hua abhi
          </h2>

          {preview.empty ? (
            <p className="mt-3 rounded bg-amber-50 p-3 text-sm text-amber-800">
              File me koi line nahi mili. Yaad rahe: sheets ke naam <b>Products</b>, <b>Customers</b>, <b>Suppliers</b> hone chahiye
              aur header line wahi jo namoona file me hai.
            </p>
          ) : (
            <>
              <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                <div className="rounded bg-emerald-50 p-3">
                  <div className="text-2xl font-bold text-emerald-800">{preview.totals.ok}</div>
                  <div className="text-emerald-700">theek — import hongi</div>
                </div>
                <div className="rounded bg-gray-50 p-3">
                  <div className="text-2xl font-bold text-gray-700">{preview.totals.skip}</div>
                  <div className="text-gray-600">pehle se mojood — chhod di jayengi</div>
                </div>
                <div className="rounded bg-red-50 p-3">
                  <div className="text-2xl font-bold text-red-700">{preview.totals.error}</div>
                  <div className="text-red-600">galat — theek karni hain</div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                <span className="text-gray-500">Sheets:</span>
                {preview.sheets.map((s) => (
                  <span key={s.name} className={`rounded px-2 py-0.5 ${s.found ? "bg-gray-100" : "bg-amber-100 text-amber-800"}`}>
                    {s.name}: {s.found ? `${s.ok} ok · ${s.skip} skip · ${s.error} galat` : "sheet nahi mili"}
                  </span>
                ))}
              </div>

              <div className="mt-3 flex items-center gap-2 text-sm">
                <button
                  onClick={() => setShow("all")}
                  className={`rounded px-2 py-1 ${show === "all" ? "bg-gray-800 text-white" : "bg-gray-100"}`}
                >
                  Sab ({preview.rows.length})
                </button>
                <button
                  onClick={() => setShow("error")}
                  className={`rounded px-2 py-1 ${show === "error" ? "bg-red-700 text-white" : "bg-red-50 text-red-700"}`}
                >
                  Sirf galat ({preview.totals.error})
                </button>
                <button
                  onClick={() => setShow("skip")}
                  className={`rounded px-2 py-1 ${show === "skip" ? "bg-gray-800 text-white" : "bg-gray-100"}`}
                >
                  Skip ({preview.totals.skip})
                </button>
              </div>

              <div className="mt-2 max-h-80 overflow-auto rounded border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50 text-left">
                    <tr>
                      <th className="p-2">Sheet</th>
                      <th className="p-2">Line</th>
                      <th className="p-2">Naam</th>
                      <th className="p-2">Status</th>
                      <th className="p-2">Tafseel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="p-2 text-gray-500">{r.sheet}</td>
                        <td className="p-2 text-gray-500">{r.rowNo}</td>
                        <td className="p-2 font-medium">{r.title}</td>
                        <td className="p-2">
                          {r.status === "ok" && (
                            <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 size={14} /> theek</span>
                          )}
                          {r.status === "skip" && (
                            <span className="inline-flex items-center gap-1 text-gray-500"><SkipForward size={14} /> skip</span>
                          )}
                          {r.status === "error" && (
                            <span className="inline-flex items-center gap-1 text-red-700"><AlertTriangle size={14} /> galat</span>
                          )}
                        </td>
                        <td className="p-2 text-gray-600">{r.messages.join(" · ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  onClick={doCommit}
                  disabled={busy || preview.totals.ok === 0}
                  className="inline-flex items-center gap-2 rounded bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-800 disabled:opacity-40"
                >
                  <Upload size={16} /> {preview.totals.ok} lines import karein
                </button>
                <span className="text-sm text-gray-500">
                  {preview.totals.error > 0 && "Galat lines import nahi hongi — file theek kar ke dobara upload kar sakte hain. "}
                  Baqi lines abhi bhi import ho sakti hain.
                </span>
              </div>
            </>
          )}
        </section>
      )}

      {/* Done */}
      {result && (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <h2 className="flex items-center gap-2 font-semibold text-emerald-900">
            <CheckCircle2 size={18} /> Import mukammal
          </h2>
          <ul className="mt-2 list-inside list-disc text-sm text-emerald-900">
            <li>Nayi dawaiyan: <b>{result.products}</b> (purana stock batches: {result.batches}, total {result.stockBase} base units)</li>
            <li>Naye gahak: <b>{result.customers}</b></li>
            <li>Naye supplier: <b>{result.suppliers}</b></li>
          </ul>
          <p className="mt-2 text-sm text-emerald-800">
            Ab <a className="underline" href="/products">Products</a>, <a className="underline" href="/customers">Customers</a> aur{" "}
            <a className="underline" href="/suppliers">Suppliers</a> ke safhe par ja kar dekh lein.
          </p>
        </section>
      )}

      <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">
        <h2 className="font-semibold text-gray-800">Yaad rakhein</h2>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>Rate <b>rupey</b> me likhein (6.75) — app khud paisa bana legi.</li>
          <li>Jo naam pehle se app me hain woh <b>skip</b> ho jate hain — purana data dobara nahi banta.</li>
          <li>Import ki tafseel audit log me bhi likhi jati hai.</li>
        </ul>
      </section>
    </div>
  );
}
