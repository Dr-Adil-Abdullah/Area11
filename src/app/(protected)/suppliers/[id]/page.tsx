// Area11 - supplier ki poori tafseel (ledger + maal wapas)
import { notFound } from "next/navigation";
import { getSupplierLedger } from "@/lib/supplier-returns";
import { listCustomFields, getCustomValues } from "@/lib/custom-fields";
import { query, get } from "@/lib/db";
import SupplierDetailClient from "./SupplierDetailClient";

export const dynamic = "force-dynamic";

export default async function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ledger = getSupplierLedger(Number(id));
  if (!ledger) notFound();

  // Wapas bhejne ke liye: har dawa ke sath us ke batches (qty > 0)
  const rows = query<{ id: number; name: string; batch_id: number | null; batch_no: string | null; qty_base: number | null; expiry_ym: string | null; cost_paisa: number | null }>(
    `SELECT p.id, p.name, b.id AS batch_id, b.batch_no, b.qty_base, b.expiry_ym, b.cost_paisa
       FROM products p
       LEFT JOIN batches b ON b.product_id = p.id AND b.active = 1 AND b.qty_base > 0
      WHERE p.active = 1
      ORDER BY p.name COLLATE NOCASE, b.expiry_ym`
  );
  const map = new Map<number, { id: number; name: string; batches: { id: number; batch_no: string; qty_base: number; expiry_ym: string | null; cost_paisa: number }[] }>();
  for (const r of rows) {
    if (!map.has(r.id)) map.set(r.id, { id: r.id, name: r.name, batches: [] });
    if (r.batch_id) {
      map.get(r.id)!.batches.push({
        id: r.batch_id, batch_no: r.batch_no ?? "", qty_base: Number(r.qty_base ?? 0),
        expiry_ym: r.expiry_ym, cost_paisa: Number(r.cost_paisa ?? 0),
      });
    }
  }
  void get; // (helper import rakha gaya hai taake future queries aasan hon)

  return (
    <SupplierDetailClient
      ledger={JSON.parse(JSON.stringify(ledger))}
      products={JSON.parse(JSON.stringify([...map.values()]))}
      fields={JSON.parse(JSON.stringify(listCustomFields("supplier")))}
      custom={JSON.parse(JSON.stringify(getCustomValues("supplier", Number(id))))}
    />
  );
}
