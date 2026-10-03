"use client";

// Area11 - Settings me "apni fields" (custom fields) banane wala card
// Owner/Manager: customer / product / supplier ke liye nayi fields, options,
// zaroori (required) aur band-khol (active) -- sab yahan se.
import { useEffect, useState } from "react";
import { Plus, Save, Trash2, ToggleLeft, ToggleRight, Wand2 } from "lucide-react";
import type { CustomEntity, CustomField, CustomFieldType } from "@/lib/custom-fields-shared";

const TYPE_LABEL: Record<CustomFieldType, string> = {
  text: "Text (kuch bhi likhein)",
  number: "Number",
  date: "Date",
  select: "List (options me se chunein)",
  check: "Haan/Nahi (tick)",
};

const SUGGEST: Record<CustomEntity, { label: string; type: CustomFieldType; options?: string[] }[]> = {
  customer: [
    { label: "CNIC", type: "text" },
    { label: "Address", type: "text" },
    { label: "Birthday", type: "date" },
    { label: "Discount group", type: "select", options: ["A", "B", "C"] },
    { label: "Referred by", type: "text" },
  ],
  product: [
    { label: "Shelf / Rack", type: "text" },
    { label: "Suitcase no.", type: "text" },
    { label: "Country", type: "select", options: ["Pakistan", "Imported"] },
    { label: "Special order", type: "check" },
  ],
  supplier: [
    { label: "NTN / Tax no.", type: "text" },
    { label: "Delivery days", type: "select", options: ["Same day", "Next day", "Weekly"] },
    { label: "Salesman name", type: "text" },
  ],
};

export default function CustomFieldsCard() {
  const [entity, setEntity] = useState<CustomEntity>("customer");
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<CustomFieldType>("text");
  const [newOptions, setNewOptions] = useState("");
  const [newRequired, setNewRequired] = useState(false);
  const [edit, setEdit] = useState<{ id: number; label: string; options: string } | null>(null);

  async function load(e: CustomEntity = entity) {
    setLoading(true);
    const r = await (await fetch(`/api/custom-fields?entity=${e}&all=1`, { cache: "no-store" })).json();
    if (r.ok) setFields(r.fields);
    setLoading(false);
  }
  useEffect(() => { void load(entity); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [entity]);

  async function post(body: unknown, method = "POST") {
    setMsg("");
    const r = await (await fetch("/api/custom-fields", {
      method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    })).json();
    if (!r.ok) { setMsg(r.error ?? "failed"); return false; }
    return true;
  }

  async function add() {
    if (!newLabel.trim()) return setMsg("Field ka naam likhein.");
    const ok = await post({
      entity, label: newLabel, type: newType,
      options: newType === "select" ? newOptions : undefined,
      required: newRequired,
    });
    if (ok) { setNewLabel(""); setNewOptions(""); setNewRequired(false); await load(); }
  }

  async function suggest(s: { label: string; type: CustomFieldType; options?: string[] }) {
    const ok = await post({ entity, label: s.label, type: s.type, options: s.options });
    if (ok) await load();
  }

  async function toggle(f: CustomField) {
    if (await post({ id: f.id, active: !f.active }, "PATCH")) await load();
  }

  async function saveEdit() {
    if (!edit) return;
    const type = fields.find((f) => f.id === edit.id)?.type;
    const ok = await post({ id: edit.id, label: edit.label, options: type === "select" ? edit.options : undefined }, "PATCH");
    if (ok) { setEdit(null); await load(); }
  }

  async function remove(f: CustomField) {
    if (!confirm(`"${f.label}" hamesha ke liye hata dein? Is ki likhi hui values bhi chali jayengi.\n\n(Behtar: band kar dein taake values bachi rahein.)`)) return;
    const r = await (await fetch(`/api/custom-fields?id=${f.id}`, { method: "DELETE" })).json();
    if (!r.ok) return setMsg(r.error);
    await load();
  }

  return (
    <div className="card">
      <div className="card-head flex-col !items-start gap-0.5">
        <div className="card-title">Your own fields (custom fields)</div>
        <div className="text-xs font-normal text-slate-500">
          Yahan se apni marzi ke khaane bana lein — woh customers / products / suppliers ke form me khud aa jayenge.
        </div>
      </div>
      <div className="card-body space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {(["customer", "product", "supplier"] as CustomEntity[]).map((e) => (
            <button
              key={e}
              onClick={() => setEntity(e)}
              className={`rounded px-3 py-1 text-sm ${entity === e ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-700"}`}
            >
              {e === "customer" ? "Customers" : e === "product" ? "Products" : "Suppliers"}
            </button>
          ))}
          {loading && <span className="text-xs text-slate-400">…</span>}
        </div>

        {msg && <div className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{msg}</div>}

        <div className="grid gap-2 md:grid-cols-5">
          <input className="input-sm md:col-span-2" placeholder="Nayi field ka naam (jaise CNIC)" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
          <select className="select !py-1 !text-xs" value={newType} onChange={(e) => setNewType(e.target.value as CustomFieldType)}>
            {(Object.keys(TYPE_LABEL) as CustomFieldType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </select>
          {newType === "select" && (
            <input className="input-sm" placeholder="Options: A, B, C" value={newOptions} onChange={(e) => setNewOptions(e.target.value)} />
          )}
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={newRequired} onChange={(e) => setNewRequired(e.target.checked)} /> Zaroori
          </label>
          <button className="btn-primary" onClick={add}><Plus className="h-4 w-4" /> Add field</button>
        </div>

        <div className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
          <Wand2 className="h-3.5 w-3.5" /> Jaldi shuru karein:
          {SUGGEST[entity].map((s) => (
            <button key={s.label} className="rounded bg-slate-100 px-2 py-0.5 hover:bg-slate-200" onClick={() => suggest(s)}>
              + {s.label}
            </button>
          ))}
        </div>

        <div className="overflow-auto">
          <table className="tbl">
            <thead>
              <tr><th>Field</th><th>Type</th><th>Options / Zaroori</th><th>Halat</th><th></th></tr>
            </thead>
            <tbody>
              {fields.map((f) => (
                <tr key={f.id} className={f.active ? "" : "opacity-50"}>
                  <td>
                    {edit?.id === f.id ? (
                      <input autoFocus className="input-sm" value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value })} onKeyDown={(e) => e.key === "Enter" && saveEdit()} />
                    ) : (
                      <span className="font-medium">{f.label}</span>
                    )}
                  </td>
                  <td className="text-xs">{TYPE_LABEL[f.type]}</td>
                  <td className="text-xs">
                    {f.type === "select" && (
                      edit?.id === f.id ? (
                        <input className="input-sm" value={edit.options} onChange={(e) => setEdit({ ...edit, options: e.target.value })} />
                      ) : (
                        f.options.join(" · ") || "—"
                      )
                    )}
                    {f.required ? <span className="ml-1 rounded bg-amber-100 px-1 text-amber-800">zaroori</span> : null}
                  </td>
                  <td>
                    <button className="inline-flex items-center gap-1 text-xs" onClick={() => toggle(f)}>
                      {f.active ? <ToggleRight className="h-4 w-4 text-emerald-600" /> : <ToggleLeft className="h-4 w-4 text-slate-400" />}
                      {f.active ? "Chalu" : "Band"}
                    </button>
                  </td>
                  <td className="text-right">
                    {edit?.id === f.id ? (
                      <span className="inline-flex gap-1">
                        <button className="btn-primary !px-2 !py-1" onClick={saveEdit}><Save className="h-3.5 w-3.5" /></button>
                        <button className="btn-ghost !px-1" onClick={() => setEdit(null)}>×</button>
                      </span>
                    ) : (
                      <span className="inline-flex gap-2">
                        <button className="text-slate-400 hover:text-slate-700" onClick={() => setEdit({ id: f.id, label: f.label, options: f.options.join(", ") })}>✎</button>
                        <button className="text-slate-400 hover:text-rose-600" onClick={() => remove(f)}><Trash2 className="h-4 w-4" /></button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {fields.length === 0 && !loading && (
                <tr><td colSpan={5} className="py-4 text-center text-sm text-slate-500">Abhi koi apni field nahi — upar se add karein.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
