import { NextResponse } from "next/server";
import {
  createCategory,
  deleteCategory,
  listCategories,
  listCategoriesTree,
  renameCategory,
} from "@/lib/catalog";
import { ensureBootstrap } from "@/lib/bootstrap";
import { audit } from "@/lib/audit";
import { get } from "@/lib/db";
import { requireUser, requireShopManager } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureBootstrap();
  try {
    await requireUser();
  } catch (e) {
    const err = e as { status?: number; message?: string };
    return NextResponse.json({ ok: false, error: err.message ?? "failed" }, { status: err.status ?? 400 });
  }
  return NextResponse.json({ ok: true, categories: listCategories(), tree: listCategoriesTree() });
}

export async function POST(req: Request) {
  let user;
  try {
    user = await requireShopManager();
  } catch (e) {
    const err = e as { status?: number; message?: string };
    return NextResponse.json({ ok: false, error: err.message ?? "failed" }, { status: err.status ?? 400 });
  }
  try {
    const body = (await req.json()) as { name?: string; parentId?: number | null };
    const id = createCategory(String(body.name ?? ""), body.parentId ?? null);
    const created = get<{ id: number; name: string; parent_id: number | null }>(
      "SELECT id, name, parent_id FROM categories WHERE id = ?", [id]);
    void audit({
      action: "create",
      userId: user?.id,
      userName: user?.name,
      entity: "Category",
      entityId: id,
      module: "Inventory",
      before: null,
      after: created ? { id: created.id, name: created.name, parent_id: created.parent_id } : { name: body.name },
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
  let user;
  try {
    user = await requireShopManager();
  } catch (e) {
    const err = e as { status?: number; message?: string };
    return NextResponse.json({ ok: false, error: err.message ?? "failed" }, { status: err.status ?? 400 });
  }
  try {
    const body = (await req.json()) as { id?: number; name?: string };
    if (!body.id || !body.name) throw new Error("id and name required");
    // Spec 2: purana naam → naya naam
    const beforeCat = get<{ id: number; name: string; parent_id: number | null }>(
      "SELECT id, name, parent_id FROM categories WHERE id = ?", [body.id]);
    renameCategory(body.id, body.name);
    const afterCat = get<{ id: number; name: string; parent_id: number | null }>(
      "SELECT id, name, parent_id FROM categories WHERE id = ?", [body.id]);
    void audit({
      action: "update",
      userId: user?.id,
      userName: user?.name,
      entity: "Category",
      entityId: body.id,
      module: "Inventory",
      before: beforeCat ?? null,
      after: afterCat ?? null,
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
  let user;
  try {
    user = await requireShopManager();
  } catch (e) {
    const err = e as { status?: number; message?: string };
    return NextResponse.json({ ok: false, error: err.message ?? "failed" }, { status: err.status ?? 400 });
  }
  try {
    const url = new URL(req.url);
    const id = Number(url.searchParams.get("id"));
    if (!id) throw new Error("id required");
    const beforeDel = get<{ id: number; name: string }>(
      "SELECT id, name FROM categories WHERE id = ?", [id]);
    deleteCategory(id);
    void audit({
      action: "delete",
      userId: user?.id,
      userName: user?.name,
      entity: "Category",
      entityId: id,
      module: "Inventory",
      before: beforeDel ? { id: beforeDel.id, name: beforeDel.name } : null,
      after: null,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "failed" },
      { status: 400 }
    );
  }
}
