"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Receipt,
  LayoutDashboard,
  ShoppingCart,
  PackagePlus,
  Pill,
  Boxes,
  CalendarClock,
  Users,
  Truck,
  BarChart3,
  Settings as SettingsIcon,
  Menu,
  X,
  Store,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  ready: boolean;
  phase?: string;
};

const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, ready: true },
  { href: "/pos", label: "Counter / Billing", icon: ShoppingCart, ready: true },
  { href: "/purchases", label: "Purchases (Stock-In)", icon: PackagePlus, ready: true },
  { href: "/products", label: "Products", icon: Pill, ready: true },
  { href: "/inventory", label: "Inventory", icon: Boxes, ready: false, phase: "Phase 3" },
  { href: "/expiry", label: "Expiry Alerts", icon: CalendarClock, ready: false, phase: "Phase 3" },
  { href: "/customers", label: "Customers", icon: Users, ready: false, phase: "Phase 4" },
  { href: "/sales", label: "Sales history", icon: Receipt, ready: false, phase: "Phase 2" },
  { href: "/suppliers", label: "Suppliers", icon: Truck, ready: true },
  { href: "/reports", label: "Reports", icon: BarChart3, ready: false, phase: "Phase 5" },
  { href: "/settings", label: "Settings", icon: SettingsIcon, ready: true },
];

export default function AppShell({
  children,
  appName,
  shortName,
  storeName,
  logoDataUrl,
  userName,
  userRole,
}: {
  children: React.ReactNode;
  appName: string;
  shortName: string;
  storeName: string;
  logoDataUrl: string;
  userName: string;
  userRole: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const initials = (shortName || appName || "A11").slice(0, 3).toUpperCase();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform bg-white ring-1 ring-slate-200 transition-transform
        lg:static lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-4">
          {logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoDataUrl} alt="logo" className="h-9 w-9 rounded-lg object-cover" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--brand)] text-sm font-bold text-white">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-800">{appName}</div>
            <div className="truncate text-[11px] text-slate-500">Pharmacy POS</div>
          </div>
          <button
            className="ml-auto rounded-lg p-1 text-slate-500 hover:bg-slate-100 lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex flex-col gap-1 p-3">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            if (!item.ready) {
              return (
                <div
                  key={item.href}
                  className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-400"
                  title={`${item.label} — ${item.phase} me aayega`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1">{item.label}</span>
                  <span className="badge-slate">{item.phase}</span>
                </div>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-[var(--brand)] text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 border-t border-slate-200 p-3">
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
            <Store className="h-4 w-4 text-slate-500" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-slate-700">{userName}</div>
              <div className="text-[11px] capitalize text-slate-500">{userRole}</div>
            </div>
          </div>
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/30 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur">
          <button
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-800">{storeName}</div>
            <div className="text-[11px] text-slate-500">
              {new Date().toLocaleDateString("en-PK", {
                weekday: "long",
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </div>
          </div>
          <span className="ml-auto badge-green">Offline ready</span>
        </header>

        <main className="flex-1 p-4 lg:p-6">{children}</main>

        <footer className="border-t border-slate-200 bg-white px-4 py-3 text-[11px] text-slate-500">
          {appName} • Save point:{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5">bash scripts/ckpt.sh save &quot;...&quot;</code>{" "}
          • Go back: <code className="rounded bg-slate-100 px-1 py-0.5">bash scripts/ckpt.sh go &lt;n&gt;</code>
        </footer>
      </div>
    </div>
  );
}
