// Area11 - Logout (cookie hata do)
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, getSessionUser } from "@/lib/session";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getSessionUser();
  const store = await cookies();
  store.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  if (user) {
    void audit({
      action: "logout",
      entity: "User",
      entityId: user.id,
      module: "Auth",
      before: { name: user.name, logged_in: true },
      after: { name: user.name, logged_in: false },
      details: { name: user.name },
    });
  }
  return NextResponse.json({ ok: true });
}
