/*
PREVIOUS CODE - commented out on purpose (2026-10-12).
Reference only: kept readable so it can be studied later,
but NOTHING inside runs, so it cannot throw errors.
// Area11 - Ginti (stock-take) page (owner + manager)
import { requireShopManagerPage } from "@/lib/page-guard";
import { listStockTakes } from "@/lib/stock-take";
import StockTakeClient from "./StockTakeClient";

export const dynamic = "force-dynamic";

export default async function StockTakePage() {
  await requireShopManagerPage();
  return <StockTakeClient initialTakes={JSON.parse(JSON.stringify(listStockTakes()))} />;
}

*/

export default function Page() {
  return null;
}
