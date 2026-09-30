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
  CheckCircle2,
  Circle,
  ShieldAlert,
  Sparkles,
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

function Step({ done, title, phase, href }: { done: boolean; title: string; phase?: string; href?: string }) {
  return (
    <li className="flex items-start gap-3 py-2">
      {done ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
      ) : (
        <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
      )}
      <div className="min-w-0 flex-1">
        <div className={`text-sm ${done ? "text-slate-700" : "text-slate-500"}`}>
          {href ? (
            <Link href={href} className="hover:underline">
              {title}
            </Link>
          ) : (
            title
          )}
        </div>
      </div>
      {phase && !done && <span className="badge-slate shrink-0">{phase}</span>}
    </li>
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
          <p className="text-sm text-slate-500">
            {settings["store.name"]} — counter is being set up step by step.
          </p>
        </div>
        <Link href="/settings" className="btn-primary">
          <Sparkles className="h-4 w-4" />
          Setup &amp; Settings
        </Link>
      </div>

      {usingDefaultPassword && (
        <div className="card border-l-4 border-amber-400">
          <div className="card-body flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 text-amber-600" />
            <div className="text-sm text-slate-700">
              <div className="font-semibold">Security: default password is still in use</div>
              <div className="text-slate-500">
                The owner password is still <code className="rounded bg-slate-100 px-1">area11</code>.
                Change it from Settings ▸ Security before you start billing.
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

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <div className="card-head">
            <div className="card-title">Build progress (the numbered plan)</div>
            <span className="badge-green">Live</span>
          </div>
          <div className="card-body">
            <ul className="divide-y divide-slate-100">
              <Step done title="Repository + go-back (checkpoint) system" />
              <Step done title="Master spec received and copied verbatim (Part 1)" />
              <Step done title="Numbered rule book written (104 rules: U/R/E/S/P/B/Z/T/M/Q)" />
              <Step done title="Foundation: Next.js + TypeScript + database + live preview ready" />
              <Step done title="Settings system — everything editable from the screen" href="/settings" />
              <Step title="Auto invoice numbering, round-off & receipt layout (test in Settings)" phase="0.5" href="/settings" />
              <Step title="Products & categories (with Box = Strip = Tablet formula)" phase="Phase 1" />
              <Step title="Purchases / stock-in with PINV codes + batch & expiry" phase="Phase 1" />
              <Step title="Counter billing (barcode, FIFO batch, hold cart, thermal print)" phase="Phase 1" />
              <Step title="Returns, cash closing & owner drawing" phase="Phase 2" />
              <Step title="Suppliers, expiry alerts, reorder + WhatsApp order" phase="Phase 3" />
              <Step title="Customers, loyalty, multi-tier rates, split payments" phase="Phase 4" />
              <Step title="Blackbox audit, analytics, offline/cloud sync (Supabase)" phase="Phase 5" />
            </ul>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card">
            <div className="card-head">
              <div className="card-title">Your confirmed choices</div>
            </div>
            <div className="card-body space-y-2 text-sm text-slate-600">
              <div className="flex justify-between gap-2">
                <span>Technology</span>
                <span className="font-medium text-slate-800">Next.js + TypeScript</span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Language</span>
                <span className="font-medium text-slate-800">English</span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Offline</span>
                <span className="font-medium text-slate-800">100% required</span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Cloud backup</span>
                <span className="font-medium text-slate-800">Supabase (Phase 5)</span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Login</span>
                <span className="font-medium text-slate-800">PIN + owner password</span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Devices</span>
                <span className="font-medium text-slate-800">2 counters + mobile</span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Payments</span>
                <span className="font-medium text-slate-800">Cash + credit</span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Printer</span>
                <span className="font-medium text-slate-800">
                  {settings["printer.width"] === "both" ? "58 + 80 mm" : `${settings["printer.width"]} mm`}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Old data</span>
                <span className="font-medium text-slate-800">Excel import</span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Rounding</span>
                <span className="font-medium text-slate-800">
                  {settings["bill.roundMode"] === "down10" ? "Down to 10s" : "None"}
                </span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <div className="card-title">Everything is editable</div>
            </div>
            <div className="card-body text-sm text-slate-600">
              <p>
                No screen is final. Rename the app, change the logo and colour, add or
                remove categories, tweak expiry alerts and receipt layout — all from
                Settings, and the data follows automatically.
              </p>
              <Link href="/settings" className="btn-secondary mt-3 w-full">
                Open Settings
              </Link>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <div className="card-title">Go back (checkpoints)</div>
            </div>
            <div className="card-body space-y-1 text-xs text-slate-600">
              <div>
                Save: <code className="rounded bg-slate-100 px-1">bash scripts/ckpt.sh save &quot;name&quot;</code>
              </div>
              <div>
                List: <code className="rounded bg-slate-100 px-1">bash scripts/ckpt.sh list</code>
              </div>
              <div>
                Go back: <code className="rounded bg-slate-100 px-1">bash scripts/ckpt.sh go 3</code>
              </div>
              <div>
                Undo: <code className="rounded bg-slate-100 px-1">bash scripts/ckpt.sh undo</code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
