// Area11 - Blackbox (audit) + backup/restore ka page
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { requireShopManagerPage } from "@/lib/page-guard";
import AuditClient from "./AuditClient";
import { getSettings } from "@/lib/settings";
import { autoBackupIfDue } from "@/lib/backup";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  await requireShopManagerPage();
  const user = await currentUser();
  if (!user) redirect("/login");

  // Rozana (ya jitni der Settings me tay ho) khud-b-khud backup — sirf owner
  // ke liye, aur sirf tab jab waqt poor ho chuka ho. Chhoti si jagah leti hai.
  let autoBackup: { ran: boolean; file?: string } | null = null;
  if (user.role === "owner") {
    const s = await getSettings();
    const r = autoBackupIfDue({
      enabled: Boolean(s["backup.autoEnabled"]),
      everyHours: Number(s["backup.everyHours"]) || 24,
      keep: Number(s["backup.keep"]) || 7,
    });
    autoBackup = r.ran ? { ran: true, file: r.file } : { ran: false };
  }

  return <AuditClient isOwner={user.role === "owner"} autoBackup={autoBackup} />;
}
