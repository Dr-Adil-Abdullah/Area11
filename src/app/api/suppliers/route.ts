import { NextResponse } from "next/server";
import { guard, SHOP_ROLES } from "@/lib/api";
import {
  createSupplier,
  listSuppliers,
  softDeleteSupplier,
  updateSupplier,
} from "@/lib/catalog";
import { ensureBootstrap } from "@/lib/bootstrap";
import { audit } from "@/lib/audit";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  await ensureBootstrap();
  const url = new URL(req.url);
  return NextResponse.json({ ok: true, suppliers: listSuppliers(url.searchParams.get("q") ?? "") });
}

export async function POST(req: Request) {
  const denied = await guard(SHOP_ROLES);
  if (denied) return denied;
  const user = await currentUser();
  try {
    const body = (await req.json()) as { name?: string };
    const id = createSupplier({ name: String(body.name ?? "") , ...body });
    void audit({
      action: "create",
      userId: user?.id,
      userName: user?.name,
      entity: "Supplier",
      entityId: id,
      details: { name: body.name },
    });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "failed" },
      { status: 400 }
    );
  }
}

export async function PATCH(req: Request) {
  const denied = await guard(SHOP_ROLES);
  if (denied) return denied;
  const user = await currentUser();
  try {
    const body = (await req.json()) as { id?: number; name?: string };
    if (!body.id || !body.name) throw new Error("id and name required");
    updateSupplier(body.id, { ...body, name: body.name });
    void audit({
      action: "update",
      userId: user?.id,
      userName: user?.name,
      entity: "Supplier",
      entityId: body.id,
      details: { name: body.name },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "failed" },
      { status: 400 }
    );
  }
}

export async function DELETE(req: Request) {
  const denied = await guard(SHOP_ROLES);
  if (denied) return denied;
  const user = await currentUser();
  try {
    const url = new URL(req.url);
    const id = Number(url.searchParams.get("id"));
    if (!id) throw new Error("id required");
    softDeleteSupplier(id);
    void audit({
      action: "delete",
      userId: user?.id,
      userName: user?.name,
      entity: "Supplier",
      entityId: id,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "failed" },
      { status: 400 }
    );
  }
}
