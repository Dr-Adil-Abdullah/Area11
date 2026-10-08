// Area11 - gahak ki poori tafseel (click on a customer)
import { notFound } from "next/navigation";
import { getCustomerDetail } from "@/lib/details";
import { listCustomFields } from "@/lib/custom-fields";
import CustomerDetailClient from "./CustomerDetailClient";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = getCustomerDetail(Number(id));
  if (!detail) notFound();
  const fields = listCustomFields("customer");
  return (
    <CustomerDetailClient
      detail={JSON.parse(JSON.stringify(detail))}
      fields={JSON.parse(JSON.stringify(fields))}
    />
  );
}
