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
