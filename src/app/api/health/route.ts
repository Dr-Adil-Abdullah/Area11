import { NextResponse } from "next/server";
import { dbPath, scalar } from "@/lib/db";
import pkg from "../../../../package.json"; // version hamesha package.json se (stale na ho)

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const products = scalar<number>("SELECT COUNT(*) AS c FROM products");
    const sales = scalar<number>("SELECT COUNT(*) AS c FROM sales");
    return NextResponse.json({
      ok: true,
      app: "Area11",
      version: pkg.version,
      database: "connected",
      databaseFile: dbPath(),
      products,
      sales,
      time: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "unknown" },
      { status: 500 }
    );
  }
}
