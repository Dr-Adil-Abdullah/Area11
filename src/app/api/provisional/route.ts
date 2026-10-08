// Area11 - Rush-time provisional returns API (spec 9.2)
import { NextResponse } from "next/server";
import { guard } from "@/lib/api";
import { requireUser } from "@/lib/session";
import {
  cancelProvisional, findBillsForPhone, linkProvisional, listProvisional,
  pendingProvisionalCount, recordProvisional, type ProvInput,
} from "@/lib/provisional";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  const url = new URL(req.url);
  const phone = url.searchParams.get("phone");
  const status = url.searchParams.get("status") ?? undefined;
  return NextResponse.json({
    ok: true,
    pending: pendingProvisionalCount(),
    returns: listProvisional({ status, limit: 50 }),
    bills: phone ? findBillsForPhone(phone) : undefined,
  });
}

export async function POST(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  try {
    const body = (await req.json()) as ProvInput;
    const user = await requireUser();
    const r = recordProvisional(body, user);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "failed" }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  try {
    const b = (await req.json()) as {
      id?: number; action?: "link" | "cancel"; saleId?: number; restock?: boolean; reason?: string | null;
    };
    const user = await requireUser();
    if (!b.id) throw new Error("id required");
    if (b.action === "link") {
      if (!b.saleId) throw new Error("saleId required");
      return NextResponse.json({ ok: true, ...linkProvisional(b.id, b.saleId, { restock: b.restock }, user) });
    }
    if (b.action === "cancel") {
      cancelProvisional(b.id, b.reason ?? null, user);
      return NextResponse.json({ ok: true });
    }
    throw new Error("action 'link' ya 'cancel' likhein");
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "failed" }, { status: 400 });
  }
}
