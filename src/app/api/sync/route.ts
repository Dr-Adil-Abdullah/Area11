// Area11 - Cloud sync (Supabase): haal dekho, bhejo (push), lao (pull)
import { NextResponse } from "next/server";
import { guard, SHOP_ROLES } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { pushSync, pullSync, syncStatus, buildPacket } from "@/lib/sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

/** Haal-e-haal + (chaho to) sirf packet dekho */
export async function GET(req: Request) {
  const denied = await guard(SHOP_ROLES);
  if (denied) return denied;
  const peek = new URL(req.url).searchParams.get("peek") === "1";
  const packet = peek ? buildPacket() : null;
  return NextResponse.json({ ok: true, status: syncStatus(), packet });
}

export async function POST(req: Request) {
  const denied = await guard(SHOP_ROLES);
  if (denied) return denied;
  try {
    const b = (await req.json().catch(() => ({}))) as { action?: "push" | "pull"; apply?: boolean };
    const user = await requireUser();
    if (b.action === "push") {
      const r = await pushSync(user);
      return NextResponse.json({ ...r });
    }
    if (b.action === "pull") {
      const r = await pullSync({ apply: Boolean(b.apply) }, user);
      return NextResponse.json({ ...r });
    }
    return NextResponse.json({ ok: false, error: "action 'push' ya 'pull' likhein" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "sync failed" },
      { status: 400 }
    );
  }
}
