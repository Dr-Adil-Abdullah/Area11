import { handle } from "@/lib/api";
import { addDrawing, addExpense, daySummary } from "@/lib/cash";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const day = new URL(req.url).searchParams.get("day") || undefined;
  return handle(() => ({ summary: daySummary(day) }));
}
export async function POST(req: Request) {
  const b = (await req.json()) as { kind: "expense" | "drawing"; category?: string; title?: string; type?: "cash" | "goods"; amountPaisa: number; note?: string };
  return handle((u) => {
    if (b.kind === "expense") return { id: addExpense(b.category ?? "other", b.title ?? "", Number(b.amountPaisa), b.note ?? null, u) };
    if (b.kind === "drawing") return { id: addDrawing(b.type ?? "cash", Number(b.amountPaisa), b.note ?? null, u) };
    throw new Error("Unknown kind");
  });
}
