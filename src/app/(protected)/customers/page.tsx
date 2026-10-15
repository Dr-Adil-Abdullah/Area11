/*
PREVIOUS CODE - commented out on purpose (2026-10-12).
Reference only: kept readable so it can be studied later,
but NOTHING inside runs, so it cannot throw errors.
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

*/
