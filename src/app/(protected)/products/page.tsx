/*
PREVIOUS CODE - commented out on purpose (2026-10-12).
Reference only: kept readable so it can be studied later,
but NOTHING inside runs, so it cannot throw errors.
import { listCategories, listCompanies, listProducts } from "@/lib/catalog";
import { requireShopManagerPage } from "@/lib/page-guard";
import ProductsClient from "./ProductsClient";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  await requireShopManagerPage();
  const { rows, total } = listProducts({ limit: 200 });
  const categories = listCategories();
  const companies = listCompanies();

  return (
    <ProductsClient
      initialProducts={JSON.parse(JSON.stringify(rows))}
      total={total}
      categories={JSON.parse(JSON.stringify(categories))}
      companies={JSON.parse(JSON.stringify(companies))}
    />
  );
}

*/

export default function Page() {
  return null;
}
