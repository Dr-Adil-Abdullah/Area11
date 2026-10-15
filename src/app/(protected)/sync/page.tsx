/*
PREVIOUS CODE - commented out on purpose (2026-10-12).
Reference only: kept readable so it can be studied later,
but NOTHING inside runs, so it cannot throw errors.
// Area11 - Cloud sync ka safha (owner + manager)
import { requireShopManagerPage } from "@/lib/page-guard";
import { syncStatus } from "@/lib/sync";
import SyncClient from "./SyncClient";

export const dynamic = "force-dynamic";

export default async function SyncPage() {
  await requireShopManagerPage();
  return <SyncClient initial={JSON.parse(JSON.stringify(syncStatus()))} />;
}

*/
