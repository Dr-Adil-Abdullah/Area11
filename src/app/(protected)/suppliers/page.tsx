/*
PREVIOUS CODE - commented out on purpose (2026-10-12).
Reference only: kept readable so it can be studied later,
but NOTHING inside runs, so it cannot throw errors.
import { listSuppliers } from "@/lib/catalog";
import { requireShopManagerPage } from "@/lib/page-guard";
import SuppliersClient from "./SuppliersClient";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  await requireShopManagerPage();
  const suppliers = listSuppliers();
  return <SuppliersClient initialSuppliers={JSON.parse(JSON.stringify(suppliers))} />;
}

*/
