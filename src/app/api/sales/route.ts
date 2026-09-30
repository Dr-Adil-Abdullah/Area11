import { NextResponse } from "next/server";
import { createSale, listSales, todaySummary, type SaleInput } from "@/lib/sales";
import { currentUser } from "@/lib/session";
import { ensureBootstrap } from "@/lib/bootstrap";
import { peekNextCode } from "@/lib/numbering";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await ensureBootstrap();
  const url = new URL(req.url);
  return NextResponse.json({
    ok: true,
    sales: listSales({
      search: url.searchParams.get("q") ?? "",
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
    }),
    today: todaySummary(),
    nextCode: await peekNextCode("sale"),
  });
}

export async function POST(req: Request) {
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
