import { listSuppliers } from "@/lib/catalog";
import { peekNextCode } from "@/lib/numbering";
import PurchaseForm from "./PurchaseForm";

export const dynamic = "force-dynamic";

export default async function NewPurchasePage() {
  const suppliers = listSuppliers();
  const nextCode = await peekNextCode("purchase");
  return (
    <PurchaseForm
      suppliers={JSON.parse(JSON.stringify(suppliers))}
      nextCode={nextCode}
    />
  );
}
