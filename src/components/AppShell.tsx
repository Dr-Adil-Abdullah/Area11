"use client";

import AlertBar, { type GlobalAlert } from "@/components/AlertBar";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Receipt, ShoppingCart, PackagePlus, Pill, Boxes, CalendarClock, Users, Truck, PackageMinus, FileSpreadsheet, BarChart3, Settings as SettingsIcon, Menu, X, Store, LogOut, Lock, ShieldCheck, ClipboardCheck, CloudUpload, Wallet, ChevronDown } from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  /** who can see this link (empty = everyone) */
  roles?: string[];
};

type NavGroup = {
  id: string;
  label: string;
  icon: React.ElementType;
  items: NavItem[];
};

const STAFF = ["owner", "manager"];

/** Sidebar = 4 main groups. Click a group to show its pages. */
const NAV_GROUPS: NavGroup[] = [
  {
    id: "sell",
    label: "Sell",
    icon: ShoppingCart,
    items: [
      { href: "/pos", label: "Counter / Billing", icon: ShoppingCart },
      { href: "/sales", label: "Sales & Returns", icon: Receipt },
      { href: "/customers", label: "Customers & Credit", icon: Users },
    ],
  },
  {
    id: "stock",
    label: "Stock & Suppliers",
    icon: Boxes,
    items: [
      { href: "/products", label: "Products", icon: Pill, roles: STAFF },
      { href: "/purchases", label: "Purchases (Stock-in)", icon: PackagePlus, roles: STAFF },
      { href: "/stock", label: "Adjust / Write-off", icon: PackageMinus, roles: STAFF },
      { href: "/stock-take", label: "Stock-take", icon: ClipboardCheck, roles: STAFF },
      { href: "/alerts", label: "Expiry & stock alerts", icon: CalendarClock },
      { href: "/suppliers", label: "Suppliers", icon: Truck, roles: STAFF },
    ],
  },
  {
    id: "money",
    label: "Cash & Reports",
    icon: Wallet,
    items: [
      { href: "/cash", label: "Cash & Day-end", icon: Wallet, roles: STAFF },
      { href: "/reports", label: "Reports", icon: BarChart3 },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    icon: SettingsIcon,
    items: [
      { href: "/import", label: "Excel import / update", icon: FileSpreadsheet, roles: STAFF },
      { href: "/audit", label: "Black box & Backup", icon: ShieldCheck, roles: STAFF },
      { href: "/sync", label: "Cloud sync", icon: CloudUpload, roles: STAFF },
      { href: "/settings", label: "Settings", icon: SettingsIcon, roles: STAFF },
    ],
  },
];

export default function AppShell({
  children,
  appName,
  shortName,
  storeName,
  logoDataUrl,
  userName,
  userRole,
  isAuthed,
  autoLockMinutes,
  negativeStock,
  warnNegative = true,
  alerts = [],
  canDismiss = false,
}: {
  children: React.ReactNode;
  appName: string;
  shortName: string;
  storeName: string;
  logoDataUrl: string;
  userName: string;
  userRole: string;
  isAuthed: boolean;
  autoLockMinutes: number;
  /** Spec 1.2: how many items are at negative stock (alert on every page) */
  negativeStock?: { items: number; worst: number };
  /** Spec 1.2: show the negative-stock alert or not (Settings: stock.warnNegative) */
  warnNegative?: boolean;
  /** U-31: live alerts that only the owner can clear with a written reason */
  alerts?: GlobalAlert[];
  /** U-31: is this user the owner (only the owner can clear alerts) */
  canDismiss?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  /** Which sidebar groups the user has opened/closed (unset = open only if it holds the current page) */
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  // Negative-stock alert: hidden for this session only (after a new login it shows again)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lock = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Even if the network is down, send the user to the login screen
    }
    window.location.href = "/login";
  }, []);

  // ---- Auto lock (security.autoLockMinutes) ----
  useEffect(() => {
    if (!isAuthed || !autoLockMinutes || autoLockMinutes <= 0) return;
    const ms = autoLockMinutes * 60 * 1000;

    const reset = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void lock();
      }, ms);
    };

    const events: (keyof WindowEventMap)[] = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
    ];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      if (timer.current) clearTimeout(timer.current);
    };
  }, [isAuthed, autoLockMinutes, lock]);

  const initials = (shortName || appName || "A11").slice(0, 3).toUpperCase();

  // Login screen: without the sidebar
  if (!isAuthed) {
    return <>{children}</>;
  }

  // Keep only the links this role can see; hide groups that end up empty
  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.roles || item.roles.includes(userRole)),
  })).filter((group) => group.items.length > 0);

  const activeGroupId = groups.find((group) => group.items.some((item) => item.href === pathname))?.id;

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

        <nav className="flex flex-col gap-1 overflow-y-auto p-3" style={{ maxHeight: "calc(100vh - 13rem)" }}>
          {groups.map((group) => {
            const GroupIcon = group.icon;
            const hasActive = group.id === activeGroupId;
            const expanded = openGroups[group.id] ?? hasActive;
            return (
              <div key={group.id}>
                <button
                  type="button"
                  onClick={() => setOpenGroups((prev) => ({ ...prev, [group.id]: !expanded }))}
                  aria-expanded={expanded}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold transition hover:bg-slate-100 ${
                    hasActive ? "text-[var(--brand)]" : "text-slate-700"
                  }`}
                >
                  <GroupIcon className="h-4 w-4" />
                  <span className="flex-1">{group.label}</span>
                  <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
                </button>

                {expanded && (
                  <div className="mt-1 flex flex-col gap-0.5 pl-4">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = pathname === item.href;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setOpen(false)}
                          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                            active ? "bg-[var(--brand)] text-white" : "text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
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
            <button
              onClick={() => void lock()}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200"
              title="Lock now"
              aria-label="Lock now"
            >
              <Lock className="h-4 w-4" />
            </button>
            <button
              onClick={() => void lock()}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200"
              title="Log out"
              aria-label="Log out"
            >
              <LogOut className="h-4 w-4" />
            </button>
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
          <Link href="/" className="min-w-0 hover:opacity-80" title="Go to Dashboard">
            <div className="truncate text-sm font-semibold text-slate-800">{storeName}</div>
            <div className="text-[11px] text-slate-500">
              {new Date().toLocaleDateString("en-PK", {
                weekday: "long",
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </div>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <span className="badge-slate hidden sm:inline-flex capitalize">{userRole}</span>
            <span className="badge-green">Offline ready</span>
          </div>
        </header>

        {/* ===== Spec 1.2 + U-31: alerts at the very top of EVERY page =====
             Owner's rule: negative stock does not block sales, it only raises an alert;
             and the alert stays until the owner clears it with a written reason. */}
        {warnNegative && (negativeStock?.items ?? 0) > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b-2 border-rose-300 bg-rose-100 px-4 py-2 text-rose-900">
            <span className="text-base leading-none">⚠</span>
            <span className="text-sm font-bold">
              Negative stock: {negativeStock!.items} medicine(s)
            </span>
            <span className="text-xs opacity-80">
              (worst: {negativeStock!.worst}) · fix it with Stock-take or a purchase
            </span>
            <Link href="/alerts" className="ml-1 text-xs font-semibold underline">
              View now
            </Link>
          </div>
        )}
        <AlertBar alerts={alerts} canDismiss={canDismiss} />

        <main className="flex-1 p-4 lg:p-6">{children}</main>

        <footer className="border-t border-slate-200 bg-white px-4 py-3 text-[11px] text-slate-500">
          {appName} · Pharmacy &amp; Retail POS
        </footer>
      </div>
    </div>
  );
}
