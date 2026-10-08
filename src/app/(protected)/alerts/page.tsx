import { expiryAlerts, stockAlerts, sampleStock } from "@/lib/alerts";
import { getSettings } from "@/lib/settings";
import type { ExpiryLevels } from "@/lib/pos";
import { formatPKR } from "@/lib/money";
import { reorderList } from "@/lib/whatsapp";
import { listSuppliers } from "@/lib/catalog";
import { query } from "@/lib/db";
import WhatsAppCard from "./WhatsAppCard";
import QuickReturnCard from "./QuickReturnCard";
import QuarantineCard from "./QuarantineCard";
import DismissedAlertsCard from "./DismissedAlertsCard";
import { quarantineRows, quarantineHistory } from "@/lib/returns";
import { dismissals } from "@/lib/alert-dismiss";
import { currentUser } from "@/lib/session";
export const dynamic = "force-dynamic";

const badge: Record<string, string> = { expired: "badge-red", very_near: "badge-red", near: "badge-amber", ok: "badge-green" };
const text: Record<string, string> = { expired: "EXPIRED", very_near: "Level 3 – very near", near: "Level 2 – near", ok: "Level 1 – watch" };

export default async function AlertsPage() {
  const s = await getSettings();
  const levels = (s["expiry.levels"] ?? []) as ExpiryLevels;
  const exp = expiryAlerts(levels);
  const low = stockAlerts();
  const loss = exp.filter((e) => e.status === "expired").reduce((a, e) => a + e.lossPaisa, 0);
  const reorder = reorderList();
  const suppliers = listSuppliers();
  // Expiry ho chuki batches (supplier ke sath, taake seedha wapas bheja ja sake)
  const expired = query<{
    batch_id: number; product_id: number; name: string; batch_no: string;
    expiry_ym: string | null; qty_base: number; cost_paisa: number;
    supplier_id: number | null; supplier_name: string | null;
  }>(
    `SELECT b.id AS batch_id, b.product_id, p.name, b.batch_no, b.expiry_ym, b.qty_base,
            b.cost_paisa, b.supplier_id, s.name AS supplier_name
       FROM batches b
       JOIN products p ON p.id = b.product_id
       LEFT JOIN suppliers s ON s.id = b.supplier_id
      WHERE b.active = 1 AND b.qty_base > 0
        AND b.expiry_ym IS NOT NULL AND b.expiry_ym < strftime('%Y-%m', 'now')
      ORDER BY b.expiry_ym, p.name`
  );
  const samples = sampleStock();
  // Spec 3.3: wapsi hua maal jo abhi shelf par nahi (quarantine)
  const quarantine = quarantineRows();
  // U-34: poori history (kaun sa saman kidhar gaya)
  const quarantineHist = quarantineHistory();
  // U-31: malik ki likhi hui wazahen (khatam kiye gaye alerts)
  const dismissedAlerts = dismissals();
  const me = await currentUser();
  const canRelease = me?.role === "owner" || me?.role === "manager";
  // Spec 1.2: stock MINUS me gai cheezein -- ginti ke waqt sab se pehle ye dekhein
  const negative = query<{
    product_id: number; name: string; base_unit: string; rack_no: string | null;
    minus_batches: number; qty_base: number;
  }>(
    `SELECT p.id AS product_id, p.name, p.base_unit, p.rack_no,
            COUNT(*) AS minus_batches,
            SUM(b.qty_base) AS qty_base
       FROM batches b JOIN products p ON p.id = b.product_id
      WHERE b.active = 1 AND b.qty_base < 0
      GROUP BY p.id
      ORDER BY qty_base ASC`
  );
  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-semibold text-slate-800">Expiry &amp; stock alerts</h1>
        <p className="text-sm text-slate-500">Expiry windows come from Settings (now {levels.map((l) => l.days).join(" / ")} days). Reorder level is set per product.</p></div>

      {/* ===== Spec 1.2: sab se ooper wala surkh alert ===== */}
      {negative.length > 0 && (
        <div className="rounded-lg border-2 border-rose-300 bg-rose-100 p-3 text-rose-900">
          <div className="flex items-center gap-2 text-sm font-bold">
            <span>⚠</span> Stock MINUS me hai — {negative.length} dawa (en)
          </div>
          <div className="mt-1 text-xs">
            Ginti (Stock take) ya purchases se theek karein. Har manfi bikri blackbox me
            <b> negative_sale</b> ke naam se mehfooz hai — kis ne aur kab becha, sab record hai.
          </div>
          <table className="tbl mt-2 bg-white/60">
            <thead><tr><th>Dawa</th><th>Rack</th><th className="text-right">Kitna minus</th></tr></thead>
            <tbody>
              {negative.map((n) => (
                <tr key={n.product_id}>
                  <td className="font-medium">{n.name}</td>
                  <td className="text-xs text-slate-500">{n.rack_no ?? "—"}</td>
                  <td className="text-right font-semibold text-rose-700">
                    {Math.round(n.qty_base * 1000) / 1000} {n.base_unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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

      <QuarantineCard
        initial={JSON.parse(JSON.stringify(quarantine))}
        history={JSON.parse(JSON.stringify(quarantineHist))}
        canDecide={canRelease}
      />

      <DismissedAlertsCard
        initial={JSON.parse(JSON.stringify(dismissedAlerts))}
        canRestore={me?.role === "owner"}
      />

      <QuickReturnCard
        expired={JSON.parse(JSON.stringify(expired))}
        samples={JSON.parse(JSON.stringify(samples))}
        suppliers={JSON.parse(JSON.stringify(suppliers))}
      />

      <WhatsAppCard initial={JSON.parse(JSON.stringify(reorder))} />
    </div>
  );
}
