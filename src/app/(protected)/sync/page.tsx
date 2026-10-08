// Area11 - Cloud sync ka safha (owner + manager)
import { requireShopManagerPage } from "@/lib/page-guard";
import { syncStatus } from "@/lib/sync";
import SyncClient from "./SyncClient";

export const dynamic = "force-dynamic";

export default async function SyncPage() {
  await requireShopManagerPage();
  return <SyncClient initial={JSON.parse(JSON.stringify(syncStatus()))} />;
}
