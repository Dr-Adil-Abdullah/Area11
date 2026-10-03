import { listCategories, listCompanies, listProducts } from "@/lib/catalog";
import ProductsClient from "./ProductsClient";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
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
