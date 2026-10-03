import { run } from "@/lib/db";
import { setCustomValues, validateCustomValues } from "@/lib/custom-fields";
import { NextResponse } from "next/server";
import { guard, SHOP_ROLES } from "@/lib/api";
import { getProduct, softDeleteProduct, updateProduct, type ProductInput } from "@/lib/catalog";
import { getCustomValues } from "@/lib/custom-fields";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await guard();
  if (denied) return denied;
  const { id } = await ctx.params;
  const product = getProduct(Number(id));
  if (!product) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true, product, custom: getCustomValues("product", Number(id)) });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await guard(SHOP_ROLES);
  if (denied) return denied;
  const { id } = await ctx.params;
  const user = await currentUser();
  try {
    const body = (await req.json()) as ProductInput & { custom?: Record<string, unknown>; photo?: string | null };
    if (body.custom) validateCustomValues("product", body.custom); // pehle janch
    updateProduct(Number(id), body, user ?? undefined);
    if (typeof body.photo === "string") {
      if (body.photo.length > 400_000) throw new Error("Photo bohat bari hai — chhoti photo chunein.");
      run("UPDATE products SET photo = ? WHERE id = ?", [body.photo || null, Number(id)]);
    }
    if (body.custom) setCustomValues("product", Number(id), body.custom, user ?? undefined);
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
