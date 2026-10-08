// Area11 - WhatsApp text banane ka API (free: sirf text + wa.me link)
import { NextResponse } from "next/server";
import { guard } from "@/lib/api";
import { daySummaryText, orderText, reorderList, waLink, type OrderLine } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

/** GET /api/whatsapp?kind=reorder|day  → text + wa.me link */
export async function GET(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  const u = new URL(req.url);
  const kind = u.searchParams.get("kind") ?? "reorder";
  const phone = u.searchParams.get("phone") ?? "";
  const supplier = u.searchParams.get("supplier") ?? "";
  const note = u.searchParams.get("note") ?? "";
  const ids = u.searchParams.get("ids");           // "1,2,3" (product ids)
  const date = u.searchParams.get("date") ?? "today";

  if (kind === "day") {
    const text = daySummaryText(date);
    return NextResponse.json({ ok: true, text, link: waLink(phone, text) });
  }

  const all = reorderList();
  const wanted = ids ? new Set(ids.split(",").map((x) => x.trim())) : null;
  const lines: OrderLine[] = wanted
    ? all.filter((_, i) => wanted.has(String(i + 1)) || wanted.has(String(all.indexOf(_))))
    : all;
  const text = orderText({ supplierName: supplier || undefined, phone, note: note || undefined, lines: lines.length ? lines : undefined });
  return NextResponse.json({
    ok: true,
    text,
    link: waLink(phone, text),
    lines: lines.length ? lines : all,
  });
}

/** POST: chuni hui lines ke sath text banao (UI se direct) */
export async function POST(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  const b = (await req.json()) as {
    phone?: string; supplier?: string; note?: string;
    lines?: OrderLine[]; date?: string; kind?: "reorder" | "day";
  };
  const text =
    b.kind === "day"
      ? daySummaryText(b.date ?? "today")
      : orderText({ supplierName: b.supplier, note: b.note, lines: b.lines ?? reorderList() });
  return NextResponse.json({ ok: true, text, link: waLink(b.phone ?? "", text) });
}
