import { run } from "@/lib/db";
import { NextResponse } from "next/server";
import { guard } from "@/lib/api";
import { createCustomer, findCustomers, listCustomers, updateCustomer } from "@/lib/customers";
import { ensureBootstrap } from "@/lib/bootstrap";
import { currentUser } from "@/lib/session";
import { audit } from "@/lib/audit";
import { setCustomValues, validateCustomValues } from "@/lib/custom-fields";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  await ensureBootstrap();
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const phone = url.searchParams.get("phone") ?? "";
  if (phone) return NextResponse.json({ ok: true, customers: findCustomers(phone) });
  return NextResponse.json({ ok: true, customers: listCustomers(q) });
}

export async function POST(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  const user = await currentUser();
  try {
    const body = (await req.json()) as {
      name?: string;
      phone?: string | null;
      category?: string;
      creditLimitPaisa?: number;
      photo?: string | null;
      custom?: Record<string, unknown>;
    };
    if (body.custom) validateCustomValues("customer", body.custom);
    const id = createCustomer({
      name: String(body.name ?? ""),
      phone: body.phone ?? null,
      category: body.category ?? "normal",
      creditLimitPaisa: body.creditLimitPaisa ?? 0,
    });
    if (typeof body.photo === "string" && body.photo) {
      // data-URL ya URL -- 400KB se bara ho to mana kar do
      if (body.photo.length > 400_000) throw new Error("Photo bohat bari hai — chhoti photo chunein.");
      run("UPDATE customers SET photo = ? WHERE id = ?", [body.photo, id]);
    }
    if (body.custom) setCustomValues("customer", id, body.custom, user ?? undefined);
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
  const denied = await guard();
  if (denied) return denied;
  const user = await currentUser();
  try {
    const b = (await req.json()) as { id?: number; name?: string; phone?: string | null; category?: string; creditLimitPaisa?: number; notes?: string | null; photo?: string | null; custom?: Record<string, unknown> };
    if (!b.id) throw new Error("id required");
    if (b.custom) validateCustomValues("customer", b.custom);
    updateCustomer(b.id, b);
    if (typeof b.photo === "string") {
      if (b.photo.length > 400_000) throw new Error("Photo bohat bari hai — chhoti photo chunein.");
      run("UPDATE customers SET photo = ? WHERE id = ?", [b.photo || null, b.id]);
    }
    if (b.custom) setCustomValues("customer", b.id, b.custom, user ?? undefined);
    void audit({ action: "update", userId: user?.id, userName: user?.name, entity: "Customer", entityId: b.id, details: { name: b.name } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "failed" }, { status: 400 });
  }
}
