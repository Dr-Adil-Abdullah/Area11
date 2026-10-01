import { listCustomers } from "@/lib/customers";
import CustomersClient from "./CustomersClient";
export const dynamic = "force-dynamic";
export default function CustomersPage() {
  return <CustomersClient initial={JSON.parse(JSON.stringify(listCustomers()))} />;
}
