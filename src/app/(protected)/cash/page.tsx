import { daySummary, recentDrawings, recentExpenses } from "@/lib/cash";
import { requireShopManagerPage } from "@/lib/page-guard";
import CashClient from "./CashClient";
export const dynamic = "force-dynamic";
export default async function CashPage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  await requireShopManagerPage();
  const { day } = await searchParams;
  return <CashClient summary={daySummary(day)} expenses={recentExpenses()} drawings={recentDrawings()} />;
}
