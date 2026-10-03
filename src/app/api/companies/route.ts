import { NextResponse } from "next/server";
import { createCompany, deleteCompany, listCompanies, renameCompany } from "@/lib/catalog";
import { audit } from "@/lib/audit";
import { ensureBootstrap } from "@/lib/bootstrap";
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
  return NextResponse.json({ ok: true, companies: listCompanies() });
}

export async function POST(req: Request) {
  try {
    await requireShopManager();
    await ensureBootstrap();
    const body = (await req.json()) as { name?: string };
    const id = createCompany(String(body.name ?? ""));
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
    renameCompany(body.id, body.name);
    void audit({
      action: "update", userId: user?.id, userName: user?.name,
      entity: "Company", entityId: body.id, details: { name: body.name },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "failed" }, { status: 400 });
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
    deleteCompany(id);
    void audit({ action: "delete", userId: user?.id, userName: user?.name, entity: "Company", entityId: id });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "failed" }, { status: 400 });
  }
}
