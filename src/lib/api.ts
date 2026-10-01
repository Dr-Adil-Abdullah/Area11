// Area11 - chhota API helper: har route me try/catch dobara na likhna pade (RULE U-08)
import { NextResponse } from "next/server";
import { ensureBootstrap } from "./bootstrap";
import { currentUser } from "./session";

export async function handle<T>(fn: (user: { id: number; name: string; role: string } | null) => T | Promise<T>) {
  try {
    await ensureBootstrap();
    const user = await currentUser();
    const out = await fn(user);
    return NextResponse.json({ ok: true, ...(out as object) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "failed" }, { status: 400 });
  }
}
