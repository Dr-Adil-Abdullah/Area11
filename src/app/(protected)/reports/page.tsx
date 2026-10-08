// Area11 - Reports page (Phase 5, spec §11.1)
import { requireShopManagerPage } from "@/lib/page-guard";
import { getSettings } from "@/lib/settings";
import { report, todayRange, daysRange, monthRange } from "@/lib/reports";
import ReportsClient from "./ReportsClient";

export const dynamic = "force-dynamic";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ preset?: string }> }) {
  await requireShopManagerPage();
  const sp = await searchParams;
  const preset = sp.preset ?? "today";
  const range =
    preset === "7" ? daysRange(7)
    : preset === "30" ? daysRange(30)
    : preset === "month" ? monthRange()
    : todayRange();

  const settings = await getSettings();
  const data = report(range);

  return (
    <ReportsClient
      initial={JSON.parse(JSON.stringify(data))}
      whatsappEnabled={true}
    />
  );
}
