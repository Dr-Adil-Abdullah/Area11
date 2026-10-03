// Area11 - Excel import page (owner + manager)
import { requireShopManagerPage } from "@/lib/page-guard";
import ImportClient from "./ImportClient";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  await requireShopManagerPage();
  return <ImportClient />;
}
