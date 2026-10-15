/*
PREVIOUS CODE - commented out on purpose (2026-10-12).
Reference only: kept readable so it can be studied later,
but NOTHING inside runs, so it cannot throw errors.
// Area11 - supplier ko maal wapas bhejna (expiry / damaged / galat maal)
import { NextResponse } from "next/server";
import { guard, SHOP_ROLES } from "@/lib/api";
import { currentUser } from "@/lib/session";
import {
  createSupplierReturn, getSupplierReturn, listSupplierReturns,
  type SupplierReturnInput,
} from "@/lib/supplier-returns";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  const url = new URL(req.url);
  const supplierId = url.searchParams.get("supplierId");
  const id = url.searchParams.get("id");
  if (id) {
    const r = getSupplierReturn(Number(id));
    return r ? NextResponse.json({ ok: true, ...r }) : NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }
  return NextResponse.json({
    ok: true,
    returns: listSupplierReturns({ supplierId: supplierId ? Number(supplierId) : undefined }),
  });
}

export async function POST(req: Request) {
  // sirf owner / manager -- cashier maal wapas nahi bhej sakta
  const denied = await guard(SHOP_ROLES);
  if (denied) return denied;
  const user = await currentUser();
  try {
    const body = (await req.json()) as SupplierReturnInput;
    const out = createSupplierReturn(body, user ?? undefined);
    return NextResponse.json({ ok: true, ...out });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "failed" },
      { status: 400 }
    );
  }
}

*/
