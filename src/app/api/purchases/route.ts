import { NextResponse } from "next/server";
import { guard, SHOP_ROLES } from "@/lib/api";
import { createPurchase, listPurchases, type PurchaseInput } from "@/lib/purchases";
import { currentUser } from "@/lib/session";
import { ensureBootstrap } from "@/lib/bootstrap";
import { peekNextCode } from "@/lib/numbering";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  await ensureBootstrap();
  const url = new URL(req.url);
  const nextCode = await peekNextCode("purchase");
  return NextResponse.json({
    ok: true,
    purchases: listPurchases({ search: url.searchParams.get("q") ?? "" }),
    nextCode,
  });
}

export async function POST(req: Request) {
  const denied = await guard(SHOP_ROLES);
  if (denied) return denied;
  await ensureBootstrap();
  const user = await currentUser();
  try {
    const body = (await req.json()) as PurchaseInput;
    const result = createPurchase(body, user ?? undefined);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "failed" },
      { status: 400 }
    );
  }
}
