import { daySummary, recentDrawings, recentExpenses } from "@/lib/cash";
import { currentShift, listShifts, shiftFlow, shiftVarianceToday } from "@/lib/shifts";
import { requireShopManagerPage } from "@/lib/page-guard";
import CashClient from "./CashClient";
export const dynamic = "force-dynamic";
export default async function CashPage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  await requireShopManagerPage();
  const { day } = await searchParams;
  const open = currentShift() ?? null;
  return (
    <CashClient
      summary={daySummary(day)}
      expenses={recentExpenses()}
      drawings={recentDrawings()}
      shift={{
        open,
        flow: open ? shiftFlow(open.id) : null,
        shifts: listShifts(20),
        todayVariancePaisa: shiftVarianceToday(),
      }}
    />
  );
}
