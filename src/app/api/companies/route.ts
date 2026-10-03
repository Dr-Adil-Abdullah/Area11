import { NextResponse } from "next/server";
import { createCompany, listCompanies } from "@/lib/catalog";
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
