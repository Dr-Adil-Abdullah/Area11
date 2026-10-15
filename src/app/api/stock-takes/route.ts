/*
PREVIOUS CODE - commented out on purpose (2026-10-12).
Reference only: kept readable so it can be studied later,
but NOTHING inside runs, so it cannot throw errors.
// Area11 - Stock-take (ginti) API: session kholo / purani ginti dekho
import { handle, handleOwner } from "@/lib/api";
import { openStockTake, listStockTakes } from "@/lib/stock-take";

export const dynamic = "force-dynamic";

/** Purani ginti ki fehrist *//*
export async function GET() {
  return handle(() => ({ takes: listStockTakes() }));
}

/** Nayi ginti shuru karo (owner) *//*
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    room?: string | null;
    categoryId?: number | null;
    note?: string | null;
  };
  return handleOwner((u) =>
    openStockTake(
      { room: body.room ?? null, categoryId: body.categoryId ?? null, note: body.note ?? null },
      u
    )
  );
}

*/

export {};
