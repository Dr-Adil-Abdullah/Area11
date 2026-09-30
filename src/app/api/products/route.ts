import { NextResponse } from "next/server";
import { createProduct, listProducts, type ProductInput } from "@/lib/catalog";
import { currentUser } from "@/lib/session";
import { ensureBootstrap } from "@/lib/bootstrap";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await ensureBootstrap();
  const url = new URL(req.url);
  const search = url.searchParams.get("q") ?? "";
  const limit = Number(url.searchParams.get("limit") ?? 50);
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const categoryId = url.searchParams.get("categoryId");

  try {
    const { rows, total } = listProducts({
      search,
      limit,
      offset,
      categoryId: categoryId ? Number(categoryId) : null,
    });
    return NextResponse.json({ ok: true, products: rows, total });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "failed" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  await ensureBootstrap();
  const user = await currentUser();
  try {
    const body = (await req.json()) as ProductInput;
    const id = createProduct(body, user ?? undefined);
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "failed" },
      { status: 400 }
    );
  }
}
