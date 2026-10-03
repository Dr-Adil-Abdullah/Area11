import { getSettings } from "@/lib/settings";
import { peekNextCode } from "@/lib/numbering";
import { listCustomers } from "@/lib/customers";
import { currentUser } from "@/lib/session";
import PosClient from "./PosClient";

export const dynamic = "force-dynamic";

export default async function PosPage() {
  const settings = await getSettings();
  const nextCode = await peekNextCode("sale");
  const customers = listCustomers();
  const me = await currentUser();

  return (
    <PosClient
      nextCode={nextCode}
      settings={{
        taxEnabled: !!settings["tax.enabled"],
        taxPercent: Number(settings["tax.percent"]) || 0,
        taxLabel: settings["tax.label"],
        roundMode: settings["bill.roundMode"],
        roundTo: Number(settings["bill.roundTo"]) || 10,
        discountEnabled: !!settings["discount.enabled"],
        discountMode: settings["discount.mode"],
        maxCashier: Number(settings["discount.maxPercentCashier"]) || 0,
        maxManager: Number(settings["discount.maxPercentManager"]) || 0,
        paymentMethods: settings["payment.methods"] ?? ["cash", "credit"],
        defaultPayment: settings["payment.default"] ?? "cash",
        loyaltyEnabled: !!settings["loyalty.enabled"],
      }}
      customers={JSON.parse(JSON.stringify(customers))}
      userRole={me?.role ?? "cashier"}
    />
  );
}
