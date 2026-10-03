import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { ensureBootstrap } from "@/lib/bootstrap";
import { getSettings } from "@/lib/settings";
import { currentUser } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const s = await getSettings();
    return {
      title: `${s["brand.appName"]} — Pharmacy POS`,
      description: "Smart Pharmacy & Retail POS + Inventory System",
      applicationName: s["brand.appName"],
    };
  } catch {
    return { title: "Area11 — Pharmacy POS" };
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await ensureBootstrap();
  const settings = await getSettings();
  const user = await currentUser();

  return (
    <html lang="en">
      <head>
        {/* Brand colour runtime par setting se aati hai (RULE E-02) */}
        <style
          dangerouslySetInnerHTML={{
            __html: `:root{--brand:${
              settings["brand.primaryColor"] || "#0e7490"
            };--brand-fg:#ffffff;}`,
          }}
        />
      </head>
      <body>
        <AppShell
          appName={settings["brand.appName"]}
          shortName={settings["brand.shortName"]}
          storeName={settings["store.name"]}
          logoDataUrl={settings["brand.logoDataUrl"]}
          userName={user?.name ?? ""}
          userRole={user?.role ?? "cashier"}
          isAuthed={!!user}
          autoLockMinutes={Number(settings["security.autoLockMinutes"]) || 0}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
