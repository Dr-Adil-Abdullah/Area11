import { NextResponse } from "next/server";
import { guard } from "@/lib/api";
import { createSale, listSales, todaySummary, type SaleInput } from "@/lib/sales";
import { currentUser } from "@/lib/session";
import { ensureBootstrap } from "@/lib/bootstrap";
import { peekNextCode } from "@/lib/numbering";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  await ensureBootstrap();
  const url = new URL(req.url);
  return NextResponse.json({
    ok: true,
    sales: listSales({
      search: url.searchParams.get("q") ?? "",
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
      method: (url.searchParams.get("method") ?? "all") as never,
      status: url.searchParams.get("status") ?? "all",
      margin: (url.searchParams.get("margin") ?? "all") as never,
      minTotalPaisa: Number(url.searchParams.get("min")) || undefined,
      sort: (url.searchParams.get("sort") ?? "recent") as never,
      limit: Number(url.searchParams.get("limit")) || 100,
    }),
    today: todaySummary(),
    nextCode: await peekNextCode("sale"),
  });
}

export async function POST(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  await ensureBootstrap();
  const user = await currentUser();
  try {
    const body = (await req.json()) as SaleInput;
    const result = createSale(body, user ?? undefined);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "failed" },
      { status: 400 }
    );
  }
}
