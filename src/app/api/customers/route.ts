import { NextResponse } from "next/server";
import { createCustomer, findCustomers, listCustomers, updateCustomer } from "@/lib/customers";
import { ensureBootstrap } from "@/lib/bootstrap";
import { currentUser } from "@/lib/session";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await ensureBootstrap();
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const phone = url.searchParams.get("phone") ?? "";
  if (phone) return NextResponse.json({ ok: true, customers: findCustomers(phone) });
  return NextResponse.json({ ok: true, customers: listCustomers(q) });
}

export async function POST(req: Request) {
  const user = await currentUser();
  try {
    const body = (await req.json()) as {
      name?: string;
      phone?: string | null;
      category?: string;
      creditLimitPaisa?: number;
    };
    const id = createCustomer({
      name: String(body.name ?? ""),
      phone: body.phone ?? null,
      category: body.category ?? "normal",
      creditLimitPaisa: body.creditLimitPaisa ?? 0,
    });
    void audit({
      action: "create",
      userId: user?.id,
      userName: user?.name,
      entity: "Customer",
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
    const b = (await req.json()) as { id?: number; name?: string; phone?: string | null; category?: string; creditLimitPaisa?: number; notes?: string | null };
    if (!b.id) throw new Error("id required");
    updateCustomer(b.id, b);
    void audit({ action: "update", userId: user?.id, userName: user?.name, entity: "Customer", entityId: b.id, details: { name: b.name } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "failed" }, { status: 400 });
  }
}
