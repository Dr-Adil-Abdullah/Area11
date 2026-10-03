import Link from "next/link";
import { requireShopManagerPage } from "@/lib/page-guard";
import { listPurchases } from "@/lib/purchases";
import { peekNextCode } from "@/lib/numbering";
import { formatPKR } from "@/lib/money";
import { Plus, Receipt } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PurchasesPage() {
  await requireShopManagerPage();
  const purchases = listPurchases({ limit: 100 });
  const nextCode = await peekNextCode("purchase");

  const totalSpend = purchases.reduce((s, p) => s + p.total_paisa, 0);
  const totalDue = purchases.reduce((s, p) => s + p.due_paisa, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Purchases (Stock-In)</h1>
          <p className="text-sm text-slate-500">
            Next bill will be <span className="font-medium text-slate-700">{nextCode}</span> • every purchase
            creates batches with expiry for FIFO selling.
          </p>
        </div>
        <Link href="/purchases/new" className="btn-primary">
          <Plus className="h-4 w-4" /> New purchase
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card">
          <div className="card-body">
            <div className="text-xs text-slate-500">Purchases (last 100)</div>
            <div className="text-lg font-semibold text-slate-800">{purchases.length}</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="text-xs text-slate-500">Stock value (these bills)</div>
            <div className="text-lg font-semibold text-slate-800">{formatPKR(totalSpend)}</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="text-xs text-slate-500">Unpaid to suppliers</div>
            <div className="text-lg font-semibold text-rose-600">{formatPKR(totalDue)}</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="text-xs text-slate-500">Items received</div>
            <div className="text-lg font-semibold text-slate-800">
              {purchases.reduce((s, p) => s + (p.items ?? 0), 0)}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div className="card-title">Purchase bills</div>
          <span className="badge-slate">newest first</span>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Bill</th>
              <th>Supplier</th>
              <th>Date</th>
              <th className="text-right">Items</th>
              <th className="text-right">Total</th>
              <th className="text-right">Paid</th>
              <th className="text-right">Due</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {purchases.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="font-medium text-slate-800">{p.code}</td>
                <td className="text-slate-600">{p.supplier_name ?? "—"}</td>
                <td className="text-xs text-slate-500">{(p.date ?? "").slice(0, 16)}</td>
                <td className="text-right text-slate-600">{p.items ?? 0}</td>
                <td className="text-right font-medium text-slate-800">{formatPKR(p.total_paisa)}</td>
                <td className="text-right text-slate-600">{formatPKR(p.paid_paisa)}</td>
                <td className={`text-right ${p.due_paisa > 0 ? "text-rose-600" : "text-slate-500"}`}>
                  {formatPKR(p.due_paisa)}
                </td>
                <td className="text-right">
                  <Link href={`/receipt/${p.id}?type=purchase`} className="btn-ghost !px-2" title="View bill">
                    <Receipt className="h-4 w-4" />
                  </Link>
                </td>
              </tr>
            ))}
            {purchases.length === 0 && (
              <tr>
                <td colSpan={8} className="py-10 text-center text-sm text-slate-500">
                  No purchases yet. Click “New purchase” to record the stock you received.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
