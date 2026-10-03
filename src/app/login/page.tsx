// Area11 - Login page (owner = password, staff = naam + PIN)
import { redirect } from "next/navigation";
import { ensureBootstrap } from "@/lib/bootstrap";
import { getSettings } from "@/lib/settings";
import { getSessionUser } from "@/lib/session";
import LoginClient from "./LoginClient";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  await ensureBootstrap();
  const settings = await getSettings();

  // Pehle se login hai to seedha andar
  if (settings["security.requireLogin"] !== false) {
    const user = await getSessionUser();
    if (user) redirect("/");
  } else {
    redirect("/");
  }

  return (
    <LoginClient
      appName={String(settings["brand.appName"] ?? "Area11")}
      storeName={String(settings["store.name"] ?? "")}
      pinLength={Number(settings["security.pinLength"]) || 4}
    />
  );
}
