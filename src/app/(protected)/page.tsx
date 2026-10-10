import Link from "next/link";
import { get, scalar } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { currentUser } from "@/lib/session";
import { verifySecret } from "@/lib/auth";
import { formatPKR } from "@/lib/money";
import {
  Pill,
  Users,
  Truck,
  Boxes,
  CalendarClock,
  ShoppingCart,
  ShieldAlert,
  PackagePlus,
  BarChart3,
  Settings as SettingsIcon,
} from "lucide-react";

export const dynamic = "force-dynamic";

function StatCard({
  label,
  value,
  icon: Icon,
  tone = "slate",
  hint,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  tone?: "slate" | "green" | "amber" | "red" | "blue";
  hint?: string;
}) {
  const tones: Record<string, string> = {
    slate: "bg-slate-100 text-slate-600",
    green: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-rose-100 text-rose-700",
    blue: "bg-sky-100 text-sky-700",
  };
  return (
    <div className="card">
      <div className="card-body flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-slate-500">{label}</div>
          <div className="text-lg font-semibold text-slate-800">{value}</div>
          {hint && <div className="text-[11px] text-slate-400">{hint}</div>}
        </div>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const settings = await getSettings();
  const user = await currentUser();

  const productCount = scalar<number>("SELECT COUNT(*) AS c FROM products");
  const customerCount = scalar<number>("SELECT COUNT(*) AS c FROM customers");
  const supplierCount = scalar<number>("SELECT COUNT(*) AS c FROM suppliers");
  const batchCount = scalar<number>("SELECT COUNT(*) AS c FROM batches WHERE qty_base > 0");
  const saleCount = scalar<number>("SELECT COUNT(*) AS c FROM sales");

  // Aaj ki sales (local time)
  const todayRow = get<{ total: number; bills: number }>(
    `SELECT COALESCE(SUM(total_paisa), 0) AS total, COUNT(*) AS bills
       FROM sales
      WHERE date(date) = date('now','localtime')
        AND status <> 'void'`
  );

  // Default password check (security notice)
  let usingDefaultPassword = false;
  try {
    const owner = get<{ password_hash: string | null }>(
      "SELECT password_hash FROM users WHERE role = 'owner' LIMIT 1"
    );
    usingDefaultPassword = verifySecret(
      process.env.OWNER_DEFAULT_PASSWORD || "area11",
      owner?.password_hash
    );
  } catch {
    /* ignore */
  }

  const todayTotal = todayRow?.total ?? 0;
  const todayBills = todayRow?.bills ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">
            Welcome, {user?.name ?? "Owner"}
          </h1>
          <p className="text-sm text-slate-500">{settings["store.name"]} — today at a glance</p>
        </div>
        <Link href="/pos" className="btn-primary">
          <ShoppingCart className="h-4 w-4" />
          New sale
        </Link>
      </div>

      {usingDefaultPassword && (
        <div className="card border-l-4 border-amber-400">
          <div className="card-body flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 text-amber-600" />
            <div className="text-sm text-slate-700">
              <div className="font-semibold">Security: the default owner password is still in use</div>
              <div className="text-slate-500">
                The owner password is still <code className="rounded bg-slate-100 px-1">area11</code>.
                Change it in Settings before you start billing.
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Today's sales"
          value={formatPKR(todayTotal)}
          hint={`${todayBills} bills`}
          icon={ShoppingCart}
          tone="green"
        />
        <StatCard label="Products" value={productCount} icon={Pill} tone="blue" />
        <StatCard label="Suppliers" value={supplierCount} icon={Truck} tone="slate" />
        <StatCard label="Batches in stock" value={batchCount} icon={Boxes} tone="amber" />
        <StatCard label="Customers" value={customerCount} icon={Users} hint={`${saleCount} total bills`} />
      </div>

      <div className="card">
        <div className="card-head">
          <div className="card-title">Quick actions</div>
        </div>
        <div className="card-body grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Link href="/pos" className="btn-secondary justify-center">
            <ShoppingCart className="h-4 w-4" />
            Counter / Billing
          </Link>
          <Link href="/purchases/new" className="btn-secondary justify-center">
            <PackagePlus className="h-4 w-4" />
            New purchase
          </Link>
          <Link href="/alerts" className="btn-secondary justify-center">
            <CalendarClock className="h-4 w-4" />
            Stock alerts
          </Link>
          <Link href="/reports" className="btn-secondary justify-center">
            <BarChart3 className="h-4 w-4" />
            Reports
          </Link>
          <Link href="/settings" className="btn-secondary justify-center">
            <SettingsIcon className="h-4 w-4" />
            Settings
          </Link>
        </div>
      </div>
    </div>
  );
}
