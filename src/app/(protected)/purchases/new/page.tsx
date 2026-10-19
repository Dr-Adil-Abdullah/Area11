/*
PREVIOUS CODE - commented out on purpose (2026-10-12).
Reference only: kept readable so it can be studied later,
but NOTHING inside runs, so it cannot throw errors.
import { listSuppliers } from "@/lib/catalog";
import { requireShopManagerPage } from "@/lib/page-guard";
import { peekNextCode } from "@/lib/numbering";
import PurchaseForm from "./PurchaseForm";

export const dynamic = "force-dynamic";

export default async function NewPurchasePage() {
  await requireShopManagerPage();
  const suppliers = listSuppliers();
  const nextCode = await peekNextCode("purchase");
  return (
    <PurchaseForm
      suppliers={JSON.parse(JSON.stringify(suppliers))}
      nextCode={nextCode}
    />
  );
}

*/

export default function Page() {
  return null;
}
