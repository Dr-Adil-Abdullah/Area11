/*
PREVIOUS CODE - commented out on purpose (2026-10-12).
Reference only: kept readable so it can be studied later,
but NOTHING inside runs, so it cannot throw errors.
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

*/
