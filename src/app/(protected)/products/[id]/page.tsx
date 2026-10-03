// Area11 - dawa ki poori tafseel (click on a product)
import { notFound } from "next/navigation";
import { getProductDetail } from "@/lib/details";
import { listCustomFields } from "@/lib/custom-fields";
import ProductDetailClient from "./ProductDetailClient";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = getProductDetail(Number(id));
  if (!detail) notFound();
  const fields = listCustomFields("product");
  return (
    <ProductDetailClient
      detail={JSON.parse(JSON.stringify(detail))}
      fields={JSON.parse(JSON.stringify(fields))}
    />
  );
}
