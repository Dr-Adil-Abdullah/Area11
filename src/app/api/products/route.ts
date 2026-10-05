import { setCustomValues, validateCustomValues } from "@/lib/custom-fields";
import { NextResponse } from "next/server";
import { guard, SHOP_ROLES } from "@/lib/api";
import { createProduct, listProducts, listRooms, type ProductFilter, type ProductInput } from "@/lib/catalog";
import { currentUser } from "@/lib/session";
import { ensureBootstrap } from "@/lib/bootstrap";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  await ensureBootstrap();
  const url = new URL(req.url);
  const search = url.searchParams.get("q") ?? "";
  const limit = Number(url.searchParams.get("limit") ?? 50);
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const categoryId = url.searchParams.get("categoryId");
  const companyId = url.searchParams.get("companyId");
  const room = url.searchParams.get("room");
  const stockRaw = url.searchParams.get("stock") ?? "all";
  const sortRaw = url.searchParams.get("sort") ?? "name";
  const stock = (["all", "low", "out", "expiring"] as const).includes(stockRaw as never)
    ? (stockRaw as ProductFilter["stock"])
    : "all";
  const sort = (["name", "stock", "expiry", "margin", "sold", "newest"] as const).includes(sortRaw as never)
    ? (sortRaw as ProductFilter["sort"])
    : "name";

  try {
    const { rows, total } = listProducts({
      search, limit, offset,
      categoryId: categoryId ? Number(categoryId) : null,
      companyId: companyId ? Number(companyId) : null,
      room: room || null,
      stock, sort,
    });
    return NextResponse.json({ ok: true, products: rows, total, rooms: listRooms() });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "failed" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const denied = await guard(SHOP_ROLES);
  if (denied) return denied;
  await ensureBootstrap();
  const user = await currentUser();
  try {
    const body = (await req.json()) as ProductInput & { custom?: Record<string, unknown> };
    if (body.custom) validateCustomValues("product", body.custom); // pehle janch, phir likhna
    const id = createProduct(body, user ?? undefined);
    if (body.custom) setCustomValues("product", id, body.custom, user ?? undefined);
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "failed" },
      { status: 400 }
    );
  }
}
