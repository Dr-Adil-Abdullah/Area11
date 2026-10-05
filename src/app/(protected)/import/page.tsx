// Area11 - Excel import page (owner + manager)
import { requireShopManagerPage } from "@/lib/page-guard";
import ImportClient from "./ImportClient";
import BulkUpdateCard from "./BulkUpdateCard";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  await requireShopManagerPage();
  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4">
      <div>
        <h1 className="text-xl font-bold">Data (Excel)</h1>
        <p className="mt-1 text-sm text-gray-600">
          Do kaam isi safhe par: <b>naya data</b> Excel se laana, aur <b>mojuda records</b> ko file se update karna.
        </p>
      </div>
      <BulkUpdateCard />
      <ImportClient />
    </div>
  );
}
