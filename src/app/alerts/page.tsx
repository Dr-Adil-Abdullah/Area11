import { expiryAlerts, stockAlerts } from "@/lib/alerts";
import { getSettings } from "@/lib/settings";
import type { ExpiryLevels } from "@/lib/pos";
import { formatPKR } from "@/lib/money";
export const dynamic = "force-dynamic";

const badge: Record<string, string> = { expired: "badge-red", very_near: "badge-red", near: "badge-amber", ok: "badge-green" };
const text: Record<string, string> = { expired: "EXPIRED", very_near: "Level 3 – very near", near: "Level 2 – near", ok: "Level 1 – watch" };

export default async function AlertsPage() {
  const s = await getSettings();
  const levels = (s["expiry.levels"] ?? []) as ExpiryLevels;
  const exp = expiryAlerts(levels);
  const low = stockAlerts();
  const loss = exp.filter((e) => e.status === "expired").reduce((a, e) => a + e.lossPaisa, 0);
  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-semibold text-slate-800">Expiry &amp; stock alerts</h1>
        <p className="text-sm text-slate-500">Expiry windows come from Settings (now {levels.map((l) => l.days).join(" / ")} days). Reorder level is set per product.</p></div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card"><div className="card-head"><div className="card-title">Expiring / expired batches</div><span className="badge-slate">{exp.length}</span></div>
          <div className="max-h-[65vh] overflow-auto"><table className="tbl"><thead><tr><th>Medicine</th><th>Batch</th><th>Expiry</th><th className="text-right">Qty</th><th>Status</th></tr></thead><tbody>
            {exp.map((e) => <tr key={e.batch_id}><td>{e.name}<div className="text-[11px] text-slate-500">{e.rack_no ?? ""}</div></td><td>{e.batch_no}</td><td>{e.expiry_ym}</td><td className="text-right">{e.qty_base} {e.base_unit}</td><td><span className={badge[e.status]}>{text[e.status]}</span></td></tr>)}
            {exp.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-sm text-slate-500">Nothing is close to expiry.</td></tr>}
          </tbody></table></div>
          {loss > 0 && <div className="border-t p-3 text-sm text-rose-700">Stock already expired (at cost): {formatPKR(loss)}</div>}</div>
        <div className="card"><div className="card-head"><div className="card-title">Low / out of stock (reorder list)</div><span className="badge-slate">{low.length}</span></div>
          <div className="max-h-[65vh] overflow-auto"><table className="tbl"><thead><tr><th>Medicine</th><th className="text-right">In stock</th><th className="text-right">Reorder at</th></tr></thead><tbody>
            {low.map((p) => <tr key={p.id}><td>{p.name}<div className="text-[11px] text-slate-500">{p.rack_no ?? ""}</div></td><td className="text-right">{p.stock_base <= 0 ? <span className="badge-red">Out</span> : `${p.stock_base} ${p.base_unit}`}</td><td className="text-right">{p.reorder_level}</td></tr>)}
            {low.length === 0 && <tr><td colSpan={3} className="py-8 text-center text-sm text-slate-500">All products are above their reorder level. (Set “Reorder level” on a product to track it.)</td></tr>}
          </tbody></table></div></div>
      </div>
    </div>
  );
}
