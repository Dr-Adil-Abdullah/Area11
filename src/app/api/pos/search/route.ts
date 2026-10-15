/*
PREVIOUS CODE - commented out on purpose (2026-10-12).
Reference only: kept readable so it can be studied later,
but NOTHING inside runs, so it cannot throw errors.
import { NextResponse } from "next/server";
import { searchForPos, type ExpiryLevels } from "@/lib/pos";
import { getSettings } from "@/lib/settings";
import { ensureBootstrap } from "@/lib/bootstrap";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await ensureBootstrap();
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const limit = Number(url.searchParams.get("limit") ?? 12);

  if (!q.trim()) return NextResponse.json({ ok: true, products: [] });

  try {
    await requireUser();
    const s = await getSettings();
    const products = searchForPos(q, (s["expiry.levels"] ?? []) as ExpiryLevels, limit);
    return NextResponse.json({ ok: true, products });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "search failed" },
      { status: 500 }
    );
  }
}

*/
