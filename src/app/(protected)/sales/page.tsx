import { listSales } from "@/lib/sales";
import { get } from "@/lib/db";
import SalesClient from "./SalesClient";
export const dynamic = "force-dynamic";

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ q?: string; from?: string; to?: string }> }) {
  const sp = await searchParams;
  const today = get<{ d: string }>("SELECT date('now','localtime') AS d")!.d;
  const from = sp.from ?? today, to = sp.to ?? today, q = sp.q ?? "";
  const sales = listSales({ search: q, from, to, limit: 300 });
  return <SalesClient sales={JSON.parse(JSON.stringify(sales))} from={from} to={to} q={q} />;
}
