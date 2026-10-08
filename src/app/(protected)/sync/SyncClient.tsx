"use client";

// Area11 - Cloud sync: haal, bhejo (push), lao (pull)
import { useState } from "react";
import { CloudUpload, CloudDownload, RefreshCw, CloudOff } from "lucide-react";

type Status = {
  status: string;
  lastSyncAt: string;
  enabled: boolean;
  configured: boolean;
  counts: Record<string, number>;
};

const LABEL: Record<string, string> = {
  not_configured: "Abhi set nahi hua",
  pushed: "Bhej diya gaya",
  pulled: "La kar lagaya gaya",
  error: "Koi masla aaya",
};

export default function SyncClient({ initial }: { initial: Status }) {
  const [status, setStatus] = useState(initial);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function act(action: "push" | "pull", apply = false) {
    setBusy(action + (apply ? "-apply" : ""));
    setMsg("");
    try {
      const r = await (
        await fetch("/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, apply }),
        })
      ).json();
      setMsg(r.message ?? (r.ok ? "Ho gaya." : r.error ?? "Masla aaya."));
      await reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Masla aaya.");
    } finally {
      setBusy(null);
    }
  }

  async function reload() {
    const r = await (await fetch("/api/sync", { cache: "no-store" })).json();
    if (r.ok) setStatus(r.status as Status);
  }

  return (
    <div className="space-y-4 pb-10">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Cloud sync (Supabase)</h1>
        <p className="text-sm text-slate-500">
          Dukan ka data cloud par bhejein — ghar se dekhne ke liye. Local database hamesha <b>asal</b> rahega.
        </p>
      </div>

      <div className="card card-body space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`badge-${status.configured ? "green" : "amber"}`}>
            {status.configured ? "Set hai" : "Abhi set nahi"}
          </span>
          <span className="badge-slate">{LABEL[status.status] ?? status.status}</span>
          {status.lastSyncAt && (
            <span className="text-xs text-slate-500">
              Aakhri baar: {String(status.lastSyncAt).slice(0, 19).replace("T", " ")}
            </span>
          )}
          <button className="btn-secondary ml-auto" onClick={reload}><RefreshCw className="h-4 w-4" /> Haal taza karein</button>
        </div>

        {!status.configured && (
          <p className="flex items-start gap-2 rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <CloudOff className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Supabase ka URL aur key abhi nahi dala gaya. <a className="underline" href="/settings">Settings</a> me
              &ldquo;Cloud sync&rdquo; wala hissa bharein; table banane ka tareeqa <code>docs/SUPABASE.md</code> me hai.
            </span>
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
          {Object.entries(status.counts).map(([k, v]) => (
            <div key={k} className="rounded bg-slate-50 px-3 py-2">
              <div className="text-lg font-semibold">{v}</div>
              <div className="text-xs text-slate-500">{k}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={() => void act("push")} disabled={!status.configured || busy !== null}>
            <CloudUpload className="h-4 w-4" /> {busy === "push" ? "… bhej raha hai" : "Abhi bhejein (push)"}
          </button>
          <button className="btn-secondary" onClick={() => void act("pull")} disabled={!status.configured || busy !== null}>
            <CloudDownload className="h-4 w-4" /> {busy === "pull" ? "… la raha hai" : "Cloud se dekhein"}
          </button>
          <button
            className="btn-secondary"
            onClick={() => {
              if (confirm("Cloud ka data yahan laga diya jayega (pehle backup ban jayega). Aage barhein?")) void act("pull", true);
            }}
            disabled={!status.configured || busy !== null}
          >
            <CloudDownload className="h-4 w-4" /> {busy === "pull-apply" ? "… laga raha hai" : "La kar yahan lagayein"}
          </button>
        </div>

        {msg && <div className="rounded bg-slate-50 px-3 py-2 text-sm text-slate-700">{msg}</div>}

        <p className="text-xs text-slate-500">
          Bheja jata hai: dawayen, gahak, supplier, categories, companies, batches, aur pichhle 90 din ki bikri /
          khareed / payments / kharchay. Tasveerein cloud par nahi jateen (wo backup ke sath mehfooz rehti hain).
        </p>
      </div>
    </div>
  );
}
