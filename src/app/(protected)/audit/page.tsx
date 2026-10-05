// Area11 - Blackbox (audit) + backup/restore ka page
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { requireShopManagerPage } from "@/lib/page-guard";
import AuditClient from "./AuditClient";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  await requireShopManagerPage();
  const user = await currentUser();
  if (!user) redirect("/login");
  return <AuditClient isOwner={user.role === "owner"} />;
}
