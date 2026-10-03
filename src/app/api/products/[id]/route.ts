import { NextResponse } from "next/server";
import { guard, SHOP_ROLES } from "@/lib/api";
import { getProduct, softDeleteProduct, updateProduct, type ProductInput } from "@/lib/catalog";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await guard();
  if (denied) return denied;
  const { id } = await ctx.params;
  const product = getProduct(Number(id));
  if (!product) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true, product });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await guard(SHOP_ROLES);
  if (denied) return denied;
  const { id } = await ctx.params;
  const user = await currentUser();
  try {
    const body = (await req.json()) as ProductInput;
    updateProduct(Number(id), body, user ?? undefined);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "failed" },
      { status: 400 }
    );
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await guard(SHOP_ROLES);
  if (denied) return denied;
  const { id } = await ctx.params;
  const user = await currentUser();
  try {
    softDeleteProduct(Number(id), user ?? undefined);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "failed" },
      { status: 400 }
    );
  }
}
