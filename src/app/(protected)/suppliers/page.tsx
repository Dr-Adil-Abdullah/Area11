import { listSuppliers } from "@/lib/catalog";
import { requireShopManagerPage } from "@/lib/page-guard";
import SuppliersClient from "./SuppliersClient";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  await requireShopManagerPage();
  const suppliers = listSuppliers();
  return <SuppliersClient initialSuppliers={JSON.parse(JSON.stringify(suppliers))} />;
}
