import { listSuppliers } from "@/lib/catalog";
import SuppliersClient from "./SuppliersClient";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const suppliers = listSuppliers();
  return <SuppliersClient initialSuppliers={JSON.parse(JSON.stringify(suppliers))} />;
}
