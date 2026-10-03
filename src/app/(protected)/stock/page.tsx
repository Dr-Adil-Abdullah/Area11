// Area11 - Stock adjust / write-off page (owner + manager)
import { listAdjustments, writeOffSummary } from "@/lib/stock";
import { requireShopManagerPage } from "@/lib/page-guard";
import StockClient from "./StockClient";

export const dynamic = "force-dynamic";

export default async function StockPage() {
  await requireShopManagerPage();
  return (
    <StockClient
      initialAdjustments={listAdjustments({ limit: 50 })}
      initialSummary={writeOffSummary()}
    />
  );
}
