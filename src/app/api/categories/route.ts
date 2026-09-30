import { NextResponse } from "next/server";
import {
  createCategory,
  deleteCategory,
  listCategories,
  renameCategory,
} from "@/lib/catalog";
import { ensureBootstrap } from "@/lib/bootstrap";
import { audit } from "@/lib/audit";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureBootstrap();
  return NextResponse.json({ ok: true, categories: listCategories() });
}

export async function POST(req: Request) {
  const user = await currentUser();
  try {
    const body = (await req.json()) as { name?: string; parentId?: number | null };
    const id = createCategory(String(body.name ?? ""), body.parentId ?? null);
    void audit({
      action: "create",
      userId: user?.id,
      userName: user?.name,
      entity: "Category",
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
  const user = await currentUser();
  try {
    const body = (await req.json()) as { id?: number; name?: string };
    if (!body.id || !body.name) throw new Error("id and name required");
    renameCategory(body.id, body.name);
    void audit({
      action: "update",
      userId: user?.id,
      userName: user?.name,
      entity: "Category",
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
  const user = await currentUser();
  try {
    const url = new URL(req.url);
    const id = Number(url.searchParams.get("id"));
    if (!id) throw new Error("id required");
    deleteCategory(id);
    void audit({
      action: "delete",
      userId: user?.id,
      userName: user?.name,
      entity: "Category",
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
