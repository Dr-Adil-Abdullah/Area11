// Area11 - Ginti (stock-take) page (owner + manager)
import { requireShopManagerPage } from "@/lib/page-guard";
import { listStockTakes } from "@/lib/stock-take";
import StockTakeClient from "./StockTakeClient";

export const dynamic = "force-dynamic";

export default async function StockTakePage() {
  await requireShopManagerPage();
  return <StockTakeClient initialTakes={JSON.parse(JSON.stringify(listStockTakes()))} />;
}
