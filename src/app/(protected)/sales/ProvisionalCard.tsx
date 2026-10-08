"use client";

// Area11 - Rush-time return (bill ke baghair) + pending bill alert (spec 9.2)
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Link2, Plus, Receipt, Search, Trash2 } from "lucide-react";
import { formatPKR, toPaisa } from "@/lib/money";
import { PROV_REASONS, type ProvRow } from "@/lib/provisional-shared";

type P = { id: number; name: string; base_unit: string; stock_base: number };
type Pick = { productId: number; name: string; base_unit: string; qty: string };
type BillHit = { id: number; code: string; date: string; total_paisa: number; customer_name: string | null };

export default function ProvisionalCard({ initial }: { initial: { pending: number; returns: ProvRow[] } }) {
  const router = useRouter();
  const [rows, setRows] = useState<ProvRow[]>(initial.returns);
  const [pending, setPending] = useState(initial.pending);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<P[]>([]);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [phone, setPhone] = useState("");
  const [refund, setRefund] = useState("");
  const [reason, setReason] = useState("customer_changed");
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  // link dialog state
  const [linking, setLinking] = useState<number | null>(null);
  const [billQ, setBillQ] = useState("");
  const [billHits, setBillHits] = useState<BillHit[]>([]);
  // U-33: bina-bill wapsi par maal pehle hi foran stock me add ho chuka hota hai
  const [restock, setRestock] = useState(true);

  async function reload() {
    const r = await (await fetch("/api/provisional", { cache: "no-store" })).json();
    if (r.ok) { setRows(r.returns); setPending(r.pending); }
  }

  async function search(term: string) {
    setQ(term);
    if (!term.trim()) return setHits([]);
    const r = await (await fetch(`/api/pos/search?q=${encodeURIComponent(term)}&limit=8`, { cache: "no-store" })).json();
    if (r.ok) setHits(r.products);
  }

  function addPick(p: P) {
    if (picks.some((x) => x.productId === p.id)) return;
    setPicks([...picks, { productId: p.id, name: p.name, base_unit: p.base_unit, qty: "1" }]);
    setQ(""); setHits([]);
  }

  async function save() {
    setBusy(true); setMsg("");
    try {
      const r = await (await fetch("/api/provisional", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone || null,
          reason,
          notes: notes || null,
          refundPaisa: toPaisa(refund || 0),
          items: picks.map((p) => ({ productId: p.productId, qtyBase: Number(p.qty) || 0 })),
        }),
      })).json();
      if (!r.ok) throw new Error(r.error || "save failed");
      setMsg(`✅ ${r.code} darj ho gaya — Rs ${(r.refundPaisa / 100).toFixed(2)} wapas, maal QUARANTINE me.`);
      setPicks([]); setPhone(""); setRefund(""); setNotes("");
      await reload(); router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "save failed");
    } finally { setBusy(false); }
  }

  async function searchBills(term: string) {
    setBillQ(term);
    if (!term.trim()) return setBillHits([]);
    const r = await (await fetch(`/api/sales?q=${encodeURIComponent(term)}&from=2000-01-01`, { cache: "no-store" })).json();
    if (r.ok) setBillHits(r.sales.slice(0, 8));
  }

  async function link(id: number, saleId: number) {
    setMsg("");
    const r = await (await fetch("/api/provisional", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "link", saleId, restock }),
    })).json();
    if (!r.ok) return setMsg(r.error);
    setMsg(
      `✅ Bill se jur gaya. Maal wapsi ke waqt hi stock me add ho chuka tha (${r.restocked ?? 0} item).` +
        "\nYaad rahe: bill jur jane ke baad bhi ALERT tab tak rahe ga jab tak malik wajah likh kar khatam na kare."
    );
    setLinking(null); setBillQ(""); setBillHits([]); setRestock(false);
    await reload(); router.refresh();
  }

  async function cancel(id: number) {
    const why = prompt("Pending note band karne ki wajah?") ?? "";
    const r = await (await fetch("/api/provisional", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "cancel", reason: why }),
    })).json();
    if (!r.ok) return setMsg(r.error);
    setMsg("✅ Note band kar diya."); await reload(); router.refresh();
  }

  return (
    <div className="card card-body space-y-3">
      <div className="flex items-center justify-between">
        <div className="card-title">Rush return — bill nahi mila (provisional)</div>
        {pending > 0 && (
          <span className="inline-flex animate-pulse items-center gap-1 rounded bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
            <AlertTriangle className="h-3.5 w-3.5" /> {pending} bill ka intezar
          </span>
        )}
      </div>
      <p className="text-xs text-slate-500">
        Jab gahak bill ke baghair maal wapas laye: cash foran wapas karein, maal <b>quarantine</b> me rahega
        (stock me nahi judega). Asal bill milne par us se jor dein — pending ka surkh note khud hat jayega.
      </p>

      {msg && <div className="rounded bg-slate-50 px-3 py-2 text-sm text-slate-700">{msg}</div>}

      <div className="grid gap-2 md:grid-cols-2">
        <div className="relative">
          <div className="flex items-center gap-1">
            <Search className="h-4 w-4 text-slate-400" />
            <input className="input-sm flex-1" placeholder="Dawa ka naam / barcode…" value={q} onChange={(e) => search(e.target.value)} />
          </div>
          {hits.length > 0 && (
            <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded border bg-white shadow-lg">
              {hits.map((p) => (
                <li key={p.id}>
                  <button className="flex w-full justify-between px-3 py-1.5 text-left text-sm hover:bg-slate-50" onClick={() => addPick(p)}>
                    <span>{p.name}</span>
                    <span className="text-xs text-slate-400">{p.stock_base} {p.base_unit}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <input className="input-sm" placeholder="Gahak ka phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <input className="input-sm" placeholder="Wapas ki gayi raqam Rs *" value={refund} onChange={(e) => setRefund(e.target.value)} />
        <select className="select !py-1 !text-xs" value={reason} onChange={(e) => setReason(e.target.value)}>
          {PROV_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <input className="input-sm md:col-span-2" placeholder="Note (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {picks.length > 0 && (
        <ul className="space-y-1">
          {picks.map((p) => (
            <li key={p.productId} className="flex items-center gap-2 rounded bg-slate-50 px-3 py-1.5 text-sm">
              <span className="flex-1">{p.name}</span>
              <input className="input-sm w-20" value={p.qty} onChange={(e) => setPicks(picks.map((x) => x.productId === p.productId ? { ...x, qty: e.target.value } : x))} />
              <span className="text-xs text-slate-500">{p.base_unit}</span>
              <button className="text-rose-600" onClick={() => setPicks(picks.filter((x) => x.productId !== p.productId))}><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}

      <button className="btn-primary self-start" onClick={save} disabled={busy || !picks.length || !refund}>
        <Plus className="h-4 w-4" /> Record rush return
      </button>

      <div className="border-t pt-2">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Pending / hal shuda</div>
        <div className="max-h-72 overflow-auto">
          <table className="tbl">
            <thead><tr><th>Code</th><th>Kab</th><th>Items</th><th className="text-right">Refund</th><th>Halat</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={r.status === "pending" ? "bg-rose-50/60" : ""}>
                  <td className="text-xs font-medium">{r.code}</td>
                  <td className="text-xs">{r.date.slice(5, 16)}<div className="text-[11px] text-slate-400">{r.user_name ?? "—"}</div></td>
                  <td className="text-xs">{(r.items ?? []).map((i) => `${i.name} ×${i.qty_base}`).join(", ")}</td>
                  <td className="text-right text-xs">{formatPKR(r.refund_paisa)}</td>
                  <td className="text-xs">
                    {r.status === "pending" && <span className="font-semibold text-rose-700">pending</span>}
                    {r.status === "linked" && <span className="text-emerald-700">linked {r.linked_code ?? ""}</span>}
                    {r.status === "cancelled" && <span className="text-slate-500">cancelled</span>}
                  </td>
                  <td className="text-right">
                    {r.status !== "pending" && (
                      <Link className="btn-secondary !py-1" href={`/receipt/${r.id}?type=provisional&auto=1`} title="Raseed chhapein">
                        <Receipt className="h-4 w-4" /> Raseed
                      </Link>
                    )}
                    {r.status === "pending" && (
                      linking === r.id ? (
                        <div className="flex flex-col items-end gap-1">
                          <input autoFocus className="input-sm w-48" placeholder="Bill code / dawa ka naam…" value={billQ} onChange={(e) => searchBills(e.target.value)} />
                          <ul className="max-h-32 w-56 overflow-auto rounded border bg-white text-left">
                            {billHits.map((b) => (
                              <li key={b.id}>
                                <button className="block w-full px-2 py-1 text-left text-xs hover:bg-slate-50" onClick={() => link(r.id, b.id)}>
                                  {b.code} · {formatPKR(b.total_paisa)} · {b.date.slice(0, 10)}
                                </button>
                              </li>
                            ))}
                          </ul>
                          <label className="flex items-center gap-1 text-[11px] text-slate-600">
                            <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} /> Maal stock me wapas (pehle hi ho chuka hota hai — foran)
                          </label>
                          <button className="btn-ghost !py-0.5 text-xs" onClick={() => { setLinking(null); setBillQ(""); setBillHits([]); }}>cancel</button>
                        </div>
                      ) : (
                        <span className="inline-flex gap-1">
                          {/* U-35: bina-bill wapsi ki bhi raseed chhapein */}
                          <Link
                            className="btn-secondary !py-1"
                            href={`/receipt/${r.id}?type=provisional&auto=1`}
                            title="Raseed chhapein"
                          >
                            <Receipt className="h-4 w-4" /> Raseed
                          </Link>
                          <button className="btn-secondary !py-1" onClick={() => setLinking(r.id)}><Link2 className="h-4 w-4" /> Bill se jodein</button>
                          <button className="btn-ghost !py-1 text-slate-500" onClick={() => cancel(r.id)}><Trash2 className="h-4 w-4" /></button>
                        </span>
                      )
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-sm text-slate-500">Koi provisional return nahi.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
