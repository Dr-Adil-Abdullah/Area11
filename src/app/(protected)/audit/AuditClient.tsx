"use client";

// Area11 - Blackbox: "kis ne, kab, kya kiya" -- owner/manager dekh sakte hain
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, HardDriveDownload, RefreshCw, Save, Search, ShieldCheck, Upload } from "lucide-react";

type Row = {
  id: number; at: string; user_name: string | null; action: string;
  entity: string | null; entity_id: string | null; details: string | null; ip: string | null;
  module: string | null; old_value: string | null; new_value: string | null;
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
  negative_sale: "bg-rose-200 text-rose-900",
  denied: "bg-rose-100 text-rose-700",
};

/** Spec 2: "purana → naya" saaf saaf dikhayein */
function diffText(row: Row): { field: string; from: string; to: string }[] {
  const short = (v: unknown) => {
    if (v == null) return "—";
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  };
  try {
    const o = row.old_value ? (JSON.parse(row.old_value) as Record<string, unknown>) : null;
    const n = row.new_value ? (JSON.parse(row.new_value) as Record<string, unknown>) : null;
    if (o && n && typeof o === "object" && typeof n === "object") {
      return Object.keys(n).map((k) => ({ field: k, from: short(o[k]), to: short(n[k]) }));
    }
  } catch {
    /* purana format (seedhi string) -- neeche handle hoga */
  }
  if (row.old_value || row.new_value) {
    return [{ field: "", from: short(row.old_value), to: short(row.new_value) }];
  }
  return [];
}

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

export default function AuditClient({
  isOwner,
  autoBackup,
}: {
  isOwner: boolean;
  autoBackup?: { ran: boolean; file?: string } | null;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [entities, setEntities] = useState<string[]>([]);
  const [users, setUsers] = useState<string[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [module, setModule] = useState("all");
  const [modules, setModules] = useState<string[]>([]);
  const [byAction, setByAction] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [action, setAction] = useState("all");
  const [entity, setEntity] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [backups, setBackups] = useState<{ name: string; bytes: number; at: string }[]>([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    const p = new URLSearchParams({ limit: "300" });
    if (q.trim()) p.set("q", q.trim());
    if (action !== "all") p.set("action", action);
    if (entity !== "all") p.set("entity", entity);
    if (module !== "all") p.set("module", module);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    const r = await (await fetch(`/api/audit?${p}`, { cache: "no-store" })).json();
    if (r.ok) {
      setRows(r.rows); setEntities(r.entities); setUsers(r.users);
      setActions(r.actions); setByAction(r.byAction ?? {}); setTotal(r.total);
      setModules(r.modules ?? []);
    }
    setLoading(false);
  }

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [action, entity, from, to]);
  useEffect(() => {
    if (isOwner) void loadBackups();
    // safha khulte hi jo khud-b-khud backup bana ho, us ki khabar dein
    if (autoBackup?.ran && autoBackup.file) setMsg(`Khud-b-khud backup ban gaya: ${autoBackup.file}`);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [isOwner]);

  async function downloadBackup(what: "zip" | "db" = "zip") {
    setMsg("");
    const r = await fetch(`/api/backup?what=${what}`, { cache: "no-store" });
    if (!r.ok) return setMsg("Backup ban nahi saka — sirf owner kar sakta hai.");
    const blob = await r.blob();
    const name = (r.headers.get("Content-Disposition") ?? "").match(/filename="(.+?)"/)?.[1] ?? (what === "zip" ? "area11-backup.zip" : "area11-backup.db");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
    setMsg(`Backup ban gaya: ${name}`);
  }

  async function runAutoBackup() {
    setBusy(true); setMsg("");
    try {
      const r = await (await fetch("/api/backup/auto", { method: "POST" })).json();
      if (!r.ok) throw new Error(r.error);
      setMsg(
        r.ran
          ? `Backup ban gaya: ${r.file} (${Math.round(r.bytes / 1024)} KB, ${r.photoCount} tasveer)${r.removed?.length ? ` · purane katay: ${r.removed.length}` : ""}`
          : (r.reason ?? "Backup nahi bana.")
      );
      void loadBackups();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "backup failed");
    } finally { setBusy(false); }
  }

  async function loadBackups() {
    const r = await (await fetch("/api/backup/list", { cache: "no-store" })).json();
    if (r.ok) setBackups(r.backups ?? []);
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
              <button className="btn-primary" onClick={() => void downloadBackup("zip")}><Download className="h-4 w-4" /> Backup (DB + photos)</button>
              <button className="btn-secondary" onClick={() => void downloadBackup("db")}><Download className="h-4 w-4" /> Sirf database</button>
              <button className="btn-secondary" onClick={runAutoBackup} disabled={busy}><Save className="h-4 w-4" /> Abhi mehfooz karo</button>
              <label className={`btn-secondary ${busy ? "opacity-50" : ""}`}>
                <Upload className="h-4 w-4" /> Restore
                <input type="file" accept=".db,.zip" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void restore(f); }} />
              </label>
            </>
          )}
        </div>
      </div>

      {msg && <div className="rounded bg-sky-50 px-3 py-2 text-sm text-sky-800">{msg}</div>}

      {isOwner && backups.length > 0 && (
        <div className="card">
          <div className="card-head">
            <div className="card-title">Mehfooz backups (data/backups)</div>
            <span className="badge-slate">{backups.length}</span>
          </div>
          <div className="card-body overflow-auto">
            <table className="tbl">
              <thead><tr><th>File</th><th>Kab</th><th className="text-right">Naap</th><th></th></tr></thead>
              <tbody>
                {backups.map((b) => (
                  <tr key={b.name}>
                    <td className="font-medium">{b.name}</td>
                    <td className="text-xs text-slate-500">{String(b.at).slice(0, 16).replace("T", " ")}</td>
                    <td className="text-right text-xs">{Math.round(b.bytes / 1024)} KB</td>
                    <td className="text-right">
                      <a className="btn-link" href={`/api/backup/file?n=${encodeURIComponent(b.name)}`}>
                        <HardDriveDownload className="h-3 w-3" /> download
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
        <select className="select" value={module} onChange={(e) => setModule(e.target.value)}>
          <option value="all">Sab modules</option>
          {modules.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <div className="md:col-span-5 flex flex-wrap items-center gap-2">
          <a
            className="btn-secondary"
            href={`/api/audit?format=csv${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ""}${
              action !== "all" ? `&action=${action}` : ""}${entity !== "all" ? `&entity=${entity}` : ""}${
              module !== "all" ? `&module=${module}` : ""}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`}
          >
            <Download className="h-4 w-4" /> CSV (purana → naya ke sath)
          </a>
          <span className="text-[11px] text-slate-500">
            Spec 2: har entry me user, waqt, action, purani aur nayi value — sab mehfooz.
          </span>
        </div>
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
                <th>Kab</th><th>Kis ne</th><th>Kya kiya</th><th>Cheezein</th><th>Purana → Naya</th><th>Tafseel</th>
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
                  <td className="max-w-xs text-xs">
                    {diffText(r).length === 0 ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      <div className="space-y-0.5">
                        {diffText(r).slice(0, 4).map((d, i) => (
                          <div key={i} className="truncate">
                            {d.field && <span className="text-slate-400">{d.field}: </span>}
                            <span className="text-rose-700 line-through">{d.from}</span>
                            <span className="mx-1 text-slate-400">→</span>
                            <span className="font-medium text-emerald-700">{d.to}</span>
                          </div>
                        ))}
                        {diffText(r).length > 4 && (
                          <div className="text-[10px] text-slate-400">+{diffText(r).length - 4} aur</div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="max-w-md truncate text-xs text-slate-600" title={prettyDetails(r.details)}>
                    {prettyDetails(r.details) || "—"}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !loading && (
                <tr><td colSpan={6} className="py-8 text-center text-sm text-slate-500">
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
