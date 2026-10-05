"use client";

// Area11 - Blackbox: "kis ne, kab, kya kiya" -- owner/manager dekh sakte hain
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, RefreshCw, Search, ShieldCheck, Upload } from "lucide-react";

type Row = {
  id: number; at: string; user_name: string | null; action: string;
  entity: string | null; entity_id: string | null; details: string | null; ip: string | null;
};

const ACTION_TONE: Record<string, string> = {
  login: "bg-slate-100 text-slate-700",
  login_failed: "bg-rose-100 text-rose-700",
  logout: "bg-slate-100 text-slate-700",
  create: "bg-emerald-100 text-emerald-700",
  update: "bg-sky-100 text-sky-700",
  delete: "bg-rose-100 text-rose-700",
  price_change: "bg-amber-100 text-amber-800",
  void: "bg-rose-100 text-rose-700",
  return: "bg-purple-100 text-purple-700",
  settings_change: "bg-indigo-100 text-indigo-700",
  backup: "bg-teal-100 text-teal-700",
  restore: "bg-orange-100 text-orange-800",
  sync: "bg-teal-100 text-teal-700",
};

function prettyDetails(raw: string | null): string {
  if (!raw) return "";
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    return Object.entries(v)
      .map(([k, val]) => `${k}: ${typeof val === "object" ? JSON.stringify(val) : String(val)}`)
      .join(" · ");
  } catch {
    return raw;
  }
}

export default function AuditClient({ isOwner }: { isOwner: boolean }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [entities, setEntities] = useState<string[]>([]);
  const [users, setUsers] = useState<string[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [byAction, setByAction] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [action, setAction] = useState("all");
  const [entity, setEntity] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    const p = new URLSearchParams({ limit: "300" });
    if (q.trim()) p.set("q", q.trim());
    if (action !== "all") p.set("action", action);
    if (entity !== "all") p.set("entity", entity);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    const r = await (await fetch(`/api/audit?${p}`, { cache: "no-store" })).json();
    if (r.ok) {
      setRows(r.rows); setEntities(r.entities); setUsers(r.users);
      setActions(r.actions); setByAction(r.byAction ?? {}); setTotal(r.total);
    }
    setLoading(false);
  }

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [action, entity, from, to]);

  async function downloadBackup() {
    setMsg("");
    const r = await fetch("/api/backup", { cache: "no-store" });
    if (!r.ok) return setMsg("Backup ban nahi saka — sirf owner kar sakta hai.");
    const blob = await r.blob();
    const name = (r.headers.get("Content-Disposition") ?? "").match(/filename="(.+?)"/)?.[1] ?? "area11-backup.db";
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
    setMsg(`Backup ban gaya: ${name}`);
  }

  async function restore(file: File) {
    if (!confirm(`Poora data "${file.name}" se badal diya jayega?\n\n(Purani database ki hifazati copy apne aap ban jayegi.)`)) return;
    setBusy(true); setMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await (await fetch("/api/backup", { method: "POST", body: fd })).json();
      if (!r.ok) throw new Error(r.error);
      setMsg(`${r.message}${r.safetyCopy ? ` Purani copy: ${r.safetyCopy}` : ""}`);
      setTimeout(() => window.location.reload(), 1200);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "restore failed");
    } finally { setBusy(false); }
  }

  const summary = useMemo(
    () => Object.entries(byAction).sort((a, b) => b[1] - a[1]).slice(0, 8),
    [byAction]
  );

  return (
    <div className="space-y-4 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Black box (audit)</h1>
          <p className="text-sm text-slate-500">
            Har kaam ka record — kis ne, kab, kya kiya. Yeh kabhi delete nahi hota.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={load}><RefreshCw className="h-4 w-4" /> Refresh</button>
          {isOwner && (
            <>
              <button className="btn-primary" onClick={downloadBackup}><Download className="h-4 w-4" /> Backup download</button>
              <label className={`btn-secondary ${busy ? "opacity-50" : ""}`}>
                <Upload className="h-4 w-4" /> Restore
                <input type="file" accept=".db" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void restore(f); }} />
              </label>
            </>
          )}
        </div>
      </div>

      {msg && <div className="rounded bg-sky-50 px-3 py-2 text-sm text-sky-800">{msg}</div>}

      {summary.length > 0 && (
        <div className="card card-body flex flex-wrap gap-2">
          {summary.map(([a, n]) => (
            <button key={a} onClick={() => setAction(a === action ? "all" : a)}
              className={`rounded px-2 py-1 text-xs ${a === action ? "ring-2 ring-slate-800" : ""} ${ACTION_TONE[a] ?? "bg-slate-100 text-slate-700"}`}>
              {a} · {n}
            </button>
          ))}
        </div>
      )}

      <div className="card card-body grid gap-3 md:grid-cols-5">
        <div className="md:col-span-2 flex gap-2">
          <input className="input" placeholder="Dhoondhein (bill no, naam, dawa, koi bhi lafz)" value={q}
            onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
          <button className="btn-primary" onClick={load}><Search className="h-4 w-4" /></button>
        </div>
        <select className="select" value={entity} onChange={(e) => setEntity(e.target.value)}>
          <option value="all">Sab cheezein</option>
          {entities.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      <div className="card">
        <div className="card-head">
          <div className="card-title">{loading ? "…" : `${total} entries`}</div>
          <Link href="/settings" className="text-xs text-slate-500 hover:underline">← Settings</Link>
        </div>
        <div className="card-body overflow-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Kab</th><th>Kis ne</th><th>Kya kiya</th><th>Cheezein</th><th>Tafseel</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap text-xs">{r.at}</td>
                  <td className="text-xs">{r.user_name ?? "—"}</td>
                  <td>
                    <span className={`rounded px-2 py-0.5 text-xs ${ACTION_TONE[r.action] ?? "bg-slate-100"}`}>{r.action}</span>
                  </td>
                  <td className="text-xs">
                    {r.entity ?? "—"}{r.entity_id ? ` #${r.entity_id}` : ""}
                    {r.entity === "Sale" && r.entity_id ? (
                      <> <Link className="text-sky-700 hover:underline" href={`/receipt/${r.entity_id}`}>rasid</Link></>
                    ) : null}
                  </td>
                  <td className="max-w-md truncate text-xs text-slate-600" title={prettyDetails(r.details)}>
                    {prettyDetails(r.details) || "—"}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !loading && (
                <tr><td colSpan={5} className="py-8 text-center text-sm text-slate-500">
                  <ShieldCheck className="mx-auto mb-2 h-6 w-6 text-slate-300" />
                  Koi entry nahi mili.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-400">
        Users: {users.join(", ") || "—"} · Backup = poori database ki file; usay USB/Google Drive par rakhein.
        Restore karne se pehle purani DB ki copy <code>area11-before-restore-*.db</code> ban jati hai.
      </p>
    </div>
  );
}
