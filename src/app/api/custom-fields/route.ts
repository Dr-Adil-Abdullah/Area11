// Area11 - apni fields (custom fields) manage karne ka API -- owner + manager
import { NextResponse } from "next/server";
import { guard, SHOP_ROLES } from "@/lib/api";
import { requireUser } from "@/lib/session";
import {
  createCustomField, deleteCustomField, listCustomFields, updateCustomField,
  type CustomEntity, type CustomFieldType,
} from "@/lib/custom-fields";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  const url = new URL(req.url);
  const entity = (url.searchParams.get("entity") as CustomEntity) || undefined;
  const all = url.searchParams.get("all") === "1";
  return NextResponse.json({ ok: true, fields: listCustomFields(entity, all) });
}

export async function POST(req: Request) {
  const denied = await guard(SHOP_ROLES);
  if (denied) return denied;
  try {
    const b = (await req.json()) as { entity: CustomEntity; label: string; type?: CustomFieldType; options?: string[] | string; required?: boolean };
    const user = await requireUser();
    const id = createCustomField(b, user);
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "failed" }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  const denied = await guard(SHOP_ROLES);
  if (denied) return denied;
  try {
    const b = (await req.json()) as { id?: number; label?: string; options?: string[] | string; required?: boolean; active?: boolean; sort?: number };
    if (!b.id) throw new Error("id required");
    const user = await requireUser();
    updateCustomField(b.id, b, user);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "failed" }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const denied = await guard(SHOP_ROLES);
  if (denied) return denied;
  try {
    const id = Number(new URL(req.url).searchParams.get("id"));
    if (!id) throw new Error("id required");
    const user = await requireUser();
    deleteCustomField(id, user);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "failed" }, { status: 400 });
  }
}
