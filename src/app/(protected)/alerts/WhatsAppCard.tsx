"use client";

// Area11 - reorder list se WhatsApp par order bhejein (free wa.me link)
import { useEffect, useState } from "react";
import { Check, Copy, MessageCircle, RefreshCw, Send } from "lucide-react";

type Line = {
  name: string;
  generic?: string | null;
  company?: string | null;
  stockBase: number;
  reorderLevel: number;
  baseUnit: string;
  suggestQty: number;
};

export default function WhatsAppCard({ initial }: { initial: Line[] }) {
  const [lines, setLines] = useState<Line[]>(initial);
  const [picked, setPicked] = useState<Record<number, boolean>>({});
  const [phone, setPhone] = useState("");
  const [supplier, setSupplier] = useState("");
  const [note, setNote] = useState("");
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { setLines(initial); }, [initial]);

  const chosen = lines.filter((_, i) => picked[i]);

  async function build(kind: "reorder" | "day" = "reorder") {
    setBusy(true); setMsg("");
    try {
      const r = await (await fetch("/api/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind, phone, supplier, note,
          lines: chosen.length ? chosen : undefined,
        }),
      })).json();
      if (!r.ok) throw new Error(r.error);
      setText(r.text);
      if (r.link) window.open(r.link, "_blank", "noopener");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "failed");
    } finally { setBusy(false); }
  }

  async function copy() {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setMsg("Text copy ho gaya — WhatsApp me paste kar dein.");
  }

  return (
    <div className="card">
      <div className="card-head flex-col !items-start gap-0.5">
        <div className="card-title">WhatsApp order (free)</div>
        <div className="text-xs font-normal text-slate-500">
          Neeche se dawayen chunein, supplier ka number likhein — WhatsApp khul jayega aur text taiyar hoga.
        </div>
      </div>
      <div className="card-body space-y-3">
        {lines.length === 0 && (
          <p className="text-sm text-slate-500">Sab dawayon ka stock theek hai — koi order nahi banana.</p>
        )}

        {lines.length > 0 && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <button className="rounded bg-slate-100 px-2 py-1" onClick={() => setPicked(Object.fromEntries(lines.map((_, i) => [i, true])))}>Sab chunein</button>
              <button className="rounded bg-slate-100 px-2 py-1" onClick={() => setPicked({})}>Koi nahi</button>
              <span className="text-slate-500">{chosen.length} chuni gayi</span>
            </div>

            <div className="max-h-52 overflow-auto">
              <table className="tbl">
                <thead><tr><th className="w-8"></th><th>Dawa</th><th className="text-right">Stock</th><th className="text-right">Mangwanein</th></tr></thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i} className={picked[i] ? "bg-emerald-50" : ""}>
                      <td>
                        <input type="checkbox" checked={!!picked[i]} onChange={(e) => setPicked({ ...picked, [i]: e.target.checked })} />
                      </td>
                      <td>
                        <div className="font-medium">{l.name}</div>
                        <div className="text-[11px] text-slate-500">{[l.company, l.generic].filter(Boolean).join(" · ")}</div>
                      </td>
                      <td className="text-right text-xs">{l.stockBase} {l.baseUnit}</td>
                      <td className="text-right">
                        <input
                          className="input-sm w-20 text-right"
                          type="number"
                          value={l.suggestQty}
                          onChange={(e) => {
                            const v = Math.max(1, Number(e.target.value) || 1);
                            setLines((ls) => ls.map((x, j) => (j === i ? { ...x, suggestQty: v } : x)));
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-2 md:grid-cols-4">
              <input className="input" placeholder="Supplier ka naam" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
              <input className="input" placeholder="WhatsApp no (03xx…)" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <input className="input md:col-span-2" placeholder="Koi note (ikhtiyari)" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>

            <div className="flex flex-wrap gap-2">
              <button className="btn-primary" onClick={() => build("reorder")} disabled={busy}>
                <Send className="h-4 w-4" /> WhatsApp par bhejein
              </button>
              <button className="btn-secondary" onClick={copy} disabled={!text}><Copy className="h-4 w-4" /> Copy text</button>
              <button className="btn-ghost" onClick={() => build("day")} disabled={busy}>
                <MessageCircle className="h-4 w-4" /> Aaj ka khulasa
              </button>
            </div>
          </>
        )}

        {text && (
          <pre className="whitespace-pre-wrap rounded bg-slate-50 p-3 text-xs text-slate-700">{text}</pre>
        )}
        {msg && <div className="flex items-center gap-1 rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-800"><Check className="h-4 w-4" /> {msg}</div>}
      </div>
    </div>
  );
}
