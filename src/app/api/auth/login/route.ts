// Area11 - Login (owner = password, staff = naam + PIN)
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ensureBootstrap } from "@/lib/bootstrap";
import { checkLogin, listUsers } from "@/lib/users";
import { createSessionToken, loginStamp, SESSION_COOKIE } from "@/lib/session";
import { audit } from "@/lib/audit";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

// Chhota throttle: ek hi jagah se bohat se ghalat try na hon (memory me, simple)
const attempts = new Map<string, { count: number; until: number }>();
const MAX_ATTEMPTS = 5;
const LOCK_MS = 5 * 60 * 1000;

function tooMany(key: string): boolean {
  const a = attempts.get(key);
  if (!a) return false;
  if (Date.now() > a.until) {
    attempts.delete(key);
    return false;
  }
  return a.count >= MAX_ATTEMPTS;
}

function noteFailure(key: string): void {
  const a = attempts.get(key);
  if (!a || Date.now() > a.until) {
    attempts.set(key, { count: 1, until: Date.now() + LOCK_MS });
    return;
  }
  a.count += 1;
  a.until = Date.now() + LOCK_MS;
}

export async function POST(req: Request) {
  try {
    await ensureBootstrap();
    const body = (await req.json()) as {
      mode?: "owner" | "staff";
      name?: string;
      password?: string;
      pin?: string;
    };
    const mode = body.mode === "staff" ? "staff" : "owner";
    const key = mode === "owner" ? "owner" : `staff:${(body.name ?? "").trim().toLowerCase()}`;

    if (tooMany(key)) {
      return NextResponse.json(
        { ok: false, error: "Too many wrong attempts. Please wait 5 minutes." },
        { status: 429 }
      );
    }

    const result = checkLogin({
      mode,
      name: body.name,
      password: body.password,
      pin: body.pin,
    });

    if (!result.ok) {
      noteFailure(key);
      void audit({
        action: "login_failed",
        entity: "User",
        details: { mode, name: body.name ?? null },
      });
      return NextResponse.json({ ok: false, error: result.error }, { status: 401 });
    }

    attempts.delete(key);
    const token = await createSessionToken(result.user.id, result.user.role);
    const store = await cookies();
    store.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production" && process.env.AREA11_INSECURE_COOKIE !== "1",
      maxAge: 60 * 60 * 24, // cookie 1 din -- session khud security.sessionHours se expire hota hai
    });
    await loginStamp(result.user.id);
    void audit({
      action: "login",
      entity: "User",
      entityId: result.user.id,
      details: { name: result.user.name, role: result.user.role },
    });

    return NextResponse.json({ ok: true, user: result.user });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "login failed" },
      { status: 400 }
    );
  }
}

/** Login screen ke liye: kaun kaun staff hai (naam + role, koi secret nahi) */
export async function GET() {
  try {
    await ensureBootstrap();
    const settings = await getSettings();
    return NextResponse.json({
      ok: true,
      requireLogin: settings["security.requireLogin"] !== false,
      pinLength: Number(settings["security.pinLength"]) || 4,
      staff: listUsers()
        .filter((u) => u.active && u.role !== "owner")
        .map((u) => ({ id: u.id, name: u.name, role: u.role })),
    });
  } catch {
    return NextResponse.json({ ok: true, requireLogin: true, staff: [] });
  }
}
