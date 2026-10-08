// Area11 - Ginti likho (ek ya zyada lines)
import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { saveCounts, type CountInput } from "@/lib/stock-take";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { counts?: CountInput[] };
  const counts = Array.isArray(body.counts) ? body.counts : [];
  if (counts.length === 0) {
    return NextResponse.json({ ok: false, error: "Koi ginti nahi bheji gayi." }, { status: 400 });
  }
  return handle((u) => saveCounts(Number(id), counts, u));
}
