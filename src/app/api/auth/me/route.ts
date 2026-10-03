// Area11 - "Main kaun hoon?" (client ko session ki jaankari)
import { NextResponse } from "next/server";
import { ensureBootstrap } from "@/lib/bootstrap";
import { getSettings } from "@/lib/settings";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureBootstrap();
  const settings = await getSettings();
  const user = await getSessionUser();
  return NextResponse.json({
    ok: true,
    user,
    settings: {
      requireLogin: settings["security.requireLogin"] !== false,
      autoLockMinutes: Number(settings["security.autoLockMinutes"]) || 0,
      pinLength: Number(settings["security.pinLength"]) || 4,
      appName: settings["brand.appName"],
    },
  });
}
