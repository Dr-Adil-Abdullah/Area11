import { get, run } from "@/lib/db";
import { NextResponse } from "next/server";
import { guard } from "@/lib/api";
import { createCustomer, findCustomers, listCustomers, updateCustomer } from "@/lib/customers";
import { ensureBootstrap } from "@/lib/bootstrap";
import { currentUser } from "@/lib/session";
import { audit } from "@/lib/audit";
import { setCustomValues, validateCustomValues } from "@/lib/custom-fields";
import { savePhoto } from "@/lib/photos";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  await ensureBootstrap();
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const phone = url.searchParams.get("phone") ?? "";
  if (phone) return NextResponse.json({ ok: true, customers: findCustomers(phone) });
  const cat = url.searchParams.get("category") ?? "all";
  const bal = url.searchParams.get("balance") ?? "all";
  const sort = url.searchParams.get("sort") ?? "name";
  const customers = listCustomers({
    search: q,
    category: (["all", "normal", "vip", "doctor"] as const).includes(cat as never) ? (cat as never) : "all",
    balance: (["all", "due", "clear"] as const).includes(bal as never) ? (bal as never) : "all",
    sort: (["name", "due", "recent", "spent", "newest"] as const).includes(sort as never) ? (sort as never) : "name",
  });
  return NextResponse.json({ ok: true, customers });
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
      const file = savePhoto({ entity: "customer", id, dataUrl: body.photo });
      run("UPDATE customers SET photo = ? WHERE id = ?", [file, id]);
    }
    if (body.custom) setCustomValues("customer", id, body.custom, user ?? undefined);
    void audit({
      action: "create",
      userId: user?.id,
      userName: user?.name,
      entity: "Customer",
      entityId: id,
      module: "Customers",
      // Spec 2: kya naya banaya (purana kuch nahi tha)
      before: null,
      after: {
        name: body.name,
        phone: body.phone ?? null,
        category: body.category ?? "normal",
        credit_limit_paisa: body.creditLimitPaisa ?? 0,
      },
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
    // Spec 2: purana record pehle nikal lo -- tab hi farq (purana → naya) mehfooz hoga
    const beforeCust = get<{
      name: string; phone: string | null; category: string | null;
      credit_limit_paisa: number | null; notes: string | null;
    }>("SELECT name, phone, category, credit_limit_paisa, notes, photo FROM customers WHERE id = ?", [b.id]);
    updateCustomer(b.id, b);
    if (typeof b.photo === "string") {
      const file = b.photo ? savePhoto({ entity: "customer", id: b.id, dataUrl: b.photo }) : null;
      run("UPDATE customers SET photo = ? WHERE id = ?", [file, b.id]);
    }
    if (b.custom) setCustomValues("customer", b.id, b.custom, user ?? undefined);
    const afterCust = get<{
      name: string; phone: string | null; category: string | null;
      credit_limit_paisa: number | null; notes: string | null;
    }>("SELECT name, phone, category, credit_limit_paisa, notes, photo FROM customers WHERE id = ?", [b.id]);
    void audit({
      action: "update",
      userId: user?.id,
      userName: user?.name,
      entity: "Customer",
      entityId: b.id,
      module: "Customers",
      before: (beforeCust ?? null) as unknown as Record<string, unknown> | null,
      after: (afterCust ?? null) as unknown as Record<string, unknown> | null,
      details: { name: b.name },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "failed" }, { status: 400 });
  }
}
