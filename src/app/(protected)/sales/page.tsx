import { listSales } from "@/lib/sales";
import { get } from "@/lib/db";
import { listProvisional, pendingProvisionalCount } from "@/lib/provisional";
import SalesClient from "./SalesClient";
export const dynamic = "force-dynamic";

export default async function SalesPage({ searchParams }: {
  searchParams: Promise<{ q?: string; from?: string; to?: string; method?: string; status?: string; margin?: string; min?: string; sort?: string; all?: string }>;
}) {
  const sp = await searchParams;
  const today = get<{ d: string }>("SELECT date('now','localtime') AS d")!.d;
  // "all time" chuna ho to koi date hadd nahi
  const allTime = sp.all === "1";
  const from = sp.from ?? (allTime ? "" : today);
  const to = sp.to ?? (allTime ? "" : today);
  const q = sp.q ?? "";
  const sales = listSales({
    search: q,
    from: from || undefined,
    to: to || undefined,
    method: (sp.method ?? "all") as never,
    status: sp.status ?? "all",
    margin: (sp.margin ?? "all") as never,
    minTotalPaisa: Number(sp.min) || undefined,
    sort: (sp.sort ?? "recent") as never,
    limit: 300,
  });
  const provisional = {
    pending: pendingProvisionalCount(),
    returns: listProvisional({ limit: 50 }),
  };
  return (
    <SalesClient
      sales={JSON.parse(JSON.stringify(sales))}
      from={from}
      to={to}
      q={q}
      filters={{ method: sp.method ?? "all", status: sp.status ?? "all", margin: sp.margin ?? "all", min: sp.min ?? "", sort: sp.sort ?? "recent", all: allTime }}
      provisional={JSON.parse(JSON.stringify(provisional))}
    />
  );
}
