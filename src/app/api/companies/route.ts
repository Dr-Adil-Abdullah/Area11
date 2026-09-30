import { NextResponse } from "next/server";
import { createCompany, listCompanies } from "@/lib/catalog";
import { ensureBootstrap } from "@/lib/bootstrap";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureBootstrap();
  return NextResponse.json({ ok: true, companies: listCompanies() });
}

export async function POST(req: Request) {
  try {
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
