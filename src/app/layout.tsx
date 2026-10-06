import type { Metadata, Viewport } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { ensureBootstrap } from "@/lib/bootstrap";
import { getSettings } from "@/lib/settings";
import { currentUser } from "@/lib/session";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";
import { negativeStockSummary } from "@/lib/alerts";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const s = await getSettings();
    return {
      title: `${s["brand.appName"]} — Pharmacy POS`,
      description: "Smart Pharmacy & Retail POS + Inventory System",
      applicationName: s["brand.appName"],
      manifest: "/manifest.webmanifest",
      appleWebApp: { capable: true, title: s["brand.shortName"] || "Area11", statusBarStyle: "default" },
      icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
    };
  } catch {
    return { title: "Area11 — Pharmacy POS" };
  }
}

export const viewport: Viewport = {
  themeColor: "#047857",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await ensureBootstrap();
  const settings = await getSettings();
  const user = await currentUser();
  // Spec 1.2: har safhe ke ooper alert ke liye (sirf login ke baad)
  const negative = user ? negativeStockSummary() : { items: 0, worst: 0 };

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
        <ServiceWorkerRegistrar />
        <AppShell
          appName={settings["brand.appName"]}
          shortName={settings["brand.shortName"]}
          storeName={settings["store.name"]}
          logoDataUrl={settings["brand.logoDataUrl"]}
          userName={user?.name ?? ""}
          userRole={user?.role ?? "cashier"}
          isAuthed={!!user}
          autoLockMinutes={Number(settings["security.autoLockMinutes"]) || 0}
          negativeStock={negative}
          warnNegative={settings["stock.warnNegative"] !== false}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
