import { listCustomers } from "@/lib/customers";
import { getCustomValuesBulk } from "@/lib/custom-fields";
import CustomersClient from "./CustomersClient";
export const dynamic = "force-dynamic";
export default function CustomersPage() {
  const rows = listCustomers();
  const custom = getCustomValuesBulk("customer", rows.map((r) => r.id));
  return (
    <CustomersClient
      initial={JSON.parse(JSON.stringify(rows))}
      initialCustom={JSON.parse(JSON.stringify(custom))}
    />
  );
}
