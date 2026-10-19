/*
PREVIOUS CODE - commented out on purpose (2026-10-12).
Reference only: kept readable so it can be studied later,
but NOTHING inside runs, so it cannot throw errors.
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

*/

export default function Page() {
  return null;
}
