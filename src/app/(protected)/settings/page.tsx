import { getSettings } from "@/lib/settings";
import { currentUser } from "@/lib/session";
import { listUsers } from "@/lib/users";
import StaffCard from "./StaffCard";
import { Save } from "lucide-react";
import { saveSettingsAction } from "./actions";

export const dynamic = "force-dynamic";

function Section({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card">
      <div className="card-head flex-col !items-start gap-0.5">
        <div className="card-title">{title}</div>
        {desc && <div className="text-xs font-normal text-slate-500">{desc}</div>}
      </div>
      <div className="card-body grid gap-4 md:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

function Check({
  name,
  label,
  hint,
  defaultChecked,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="checkbox mt-0.5" />
      <span>
        <span className="block text-sm text-slate-700">{label}</span>
        {hint && <span className="block text-[11px] text-slate-400">{hint}</span>}
      </span>
    </label>
  );
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; staffSaved?: string; staffError?: string }>;
}) {
  const s = await getSettings();
  const me = await currentUser();
  const isOwner = me?.role === "owner";
  const sp = (await searchParams) ?? {};
  const staffUsers = isOwner ? listUsers() : [];
  const levels = s["expiry.levels"] ?? [];
  const lvl = (i: number) => levels.find((l) => l.level === i) ?? { days: 0, color: "blue", label: "" };
  const methods = s["payment.methods"] ?? [];

  return (
    <div className="space-y-5 pb-24">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Settings</h1>
        <p className="text-sm text-slate-500">
          Everything here is editable and saved in the database — the whole app follows
          these values (no code changes needed).
        </p>
      </div>

      {sp?.saved && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Settings saved.
        </div>
      )}

      <form action={saveSettingsAction} className="space-y-5">
        {/* ---------------- Store & branding ---------------- */}
        <Section
          title="Store &amp; Branding"
          desc="Appears on the app header and on printed receipts."
        >
          <Field label="Shop name (on receipts)">
            <input name="store.name" defaultValue={s["store.name"]} className="input" />
          </Field>
          <Field label="Phone">
            <input name="store.phone" defaultValue={s["store.phone"]} className="input" placeholder="0300-0000000" />
          </Field>
          <Field label="Address">
            <input name="store.address" defaultValue={s["store.address"]} className="input" />
          </Field>
          <Field label="Receipt footer line">
            <input name="store.footerNote" defaultValue={s["store.footerNote"]} className="input" />
          </Field>
          <Field label="Terms / return policy (small print)">
            <input name="store.terms" defaultValue={s["store.terms"]} className="input" />
          </Field>
          <Field label="App name (shown in the app)">
            <input name="brand.appName" defaultValue={s["brand.appName"]} className="input" />
          </Field>
          <Field label="Short name / initials" hint="Used for the logo square when no logo is set.">
            <input name="brand.shortName" defaultValue={s["brand.shortName"]} className="input" />
          </Field>
          <Field label="Logo image URL" hint="Paste an image URL, or leave empty to use initials.">
            <input name="brand.logoDataUrl" defaultValue={s["brand.logoDataUrl"]} className="input" placeholder="https://..." />
          </Field>
          <Field label="Primary colour" hint="Buttons and highlights follow this colour.">
            <input type="color" name="brand.primaryColor" defaultValue={s["brand.primaryColor"]} className="h-10 w-24 rounded border border-slate-300" />
          </Field>
        </Section>

        {/* ---------------- Billing ---------------- */}
        <Section title="Bills &amp; Numbering" desc="Invoice numbers and round-off rules.">
          <Field label="Purchase bill prefix">
            <input name="bill.purchasePrefix" defaultValue={s["bill.purchasePrefix"]} className="input" />
          </Field>
          <Field label="Sales bill prefix">
            <input name="bill.salePrefix" defaultValue={s["bill.salePrefix"]} className="input" />
          </Field>
          <Field label="Number padding" hint="4 = INV-0001">
            <input type="number" name="bill.numberPadding" defaultValue={s["bill.numberPadding"]} className="input" min={1} max={8} />
          </Field>
          <Field label="Next sales bill number">
            <input type="number" name="bill.nextSaleNo" defaultValue={s["bill.nextSaleNo"]} className="input" min={1} />
          </Field>
          <Field label="Next purchase bill number">
            <input type="number" name="bill.nextPurchaseNo" defaultValue={s["bill.nextPurchaseNo"]} className="input" min={1} />
          </Field>
          <Field label="Round-off rule" hint="Down-only means the customer always benefits (545 → 540).">
            <select name="bill.roundMode" defaultValue={s["bill.roundMode"]} className="select">
              <option value="down10">Round DOWN to nearest 10 (customer benefits)</option>
              <option value="none">No round-off</option>
            </select>
          </Field>
          <Field label="Round to (rupees)">
            <input type="number" name="bill.roundTo" defaultValue={s["bill.roundTo"]} className="input" min={0} max={100} />
          </Field>
        </Section>

        {/* ---------------- Tax ---------------- */}
        <Section title="Tax" desc="You chose tax OFF by default — switch it on any time.">
          <Check name="tax.enabled" label="Apply sales tax on bills" defaultChecked={s["tax.enabled"]} />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Tax rate (%)">
              <input type="number" step="0.01" name="tax.percent" defaultValue={s["tax.percent"]} className="input" />
            </Field>
            <Field label="Tax label on receipt">
              <input name="tax.label" defaultValue={s["tax.label"]} className="input" />
            </Field>
          </div>
        </Section>

        {/* ---------------- Discount ---------------- */}
        <Section
          title="Discount"
          desc="You can switch the method later; both are already built."
        >
          <Check name="discount.enabled" label="Discounts allowed" defaultChecked={s["discount.enabled"]} />
          <Field
            label="Discount method"
            hint="Margin: on profit only (cost 200, sell 300, 10% = Rs 10 off → 290)."
          >
            <select name="discount.mode" defaultValue={s["discount.mode"]} className="select">
              <option value="margin">On profit margin (recommended)</option>
              <option value="retail">On total retail price (traditional)</option>
            </select>
          </Field>
          <Field label="Cashier max discount (%)">
            <input type="number" name="discount.maxPercentCashier" defaultValue={s["discount.maxPercentCashier"]} className="input" min={0} max={100} />
          </Field>
          <Field label="Manager max discount (%)">
            <input type="number" name="discount.maxPercentManager" defaultValue={s["discount.maxPercentManager"]} className="input" min={0} max={100} />
          </Field>
        </Section>

        {/* ---------------- Expiry ---------------- */}
        <Section
          title="Expiry Alerts"
          desc="Three levels with your own days and colours — change them whenever you like."
        >
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border border-slate-200 p-3 md:col-span-2">
              <div className="mb-2 text-xs font-semibold text-slate-600">Level {i}</div>
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <label className="label">Days before expiry</label>
                  <input type="number" name={`expiry${i}.days`} defaultValue={lvl(i).days} className="input" min={0} />
                </div>
                <div>
                  <label className="label">Colour</label>
                  <select name={`expiry${i}.color`} defaultValue={lvl(i).color} className="select">
                    <option value="blue">Blue</option>
                    <option value="green">Green</option>
                    <option value="yellow">Yellow</option>
                    <option value="orange">Orange</option>
                    <option value="red">Red</option>
                  </select>
                </div>
                <div>
                  <label className="label">Label</label>
                  <input name={`expiry${i}.label`} defaultValue={lvl(i).label} className="input" />
                </div>
              </div>
            </div>
          ))}
          <div className="md:col-span-2">
            <Check
              name="reorder.enabled"
              label="Also show low-stock (reorder) alerts"
              defaultChecked={s["reorder.enabled"]}
            />
          </div>
        </Section>

        {/* ---------------- Loyalty ---------------- */}
        <Section
          title="Loyalty (Stars)"
          desc="You asked to keep this off for now — the structure is ready and can be switched on later."
        >
          <Check name="loyalty.enabled" label="Enable loyalty points" defaultChecked={s["loyalty.enabled"]} />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Rupees per point">
              <input type="number" name="loyalty.rupeesPerPoint" defaultValue={s["loyalty.rupeesPerPoint"]} className="input" />
            </Field>
            <Field label="Points needed for VIP">
              <input type="number" name="loyalty.vipThreshold" defaultValue={s["loyalty.vipThreshold"]} className="input" />
            </Field>
          </div>
        </Section>

        {/* ---------------- Printer ---------------- */}
        <Section
          title="Printer &amp; Receipt"
          desc="You were unsure of the printer model — both sizes are supported, pick one later."
        >
          <Field label="Thermal roll size">
            <select name="printer.width" defaultValue={s["printer.width"]} className="select">
              <option value="both">Both (58 mm and 80 mm)</option>
              <option value="58">58 mm</option>
              <option value="80">80 mm</option>
            </select>
          </Field>
          <Field label="Copies per bill">
            <input type="number" name="printer.copies" defaultValue={s["printer.copies"]} className="input" min={1} max={5} />
          </Field>
          <Check name="printer.autoCut" label="Auto-cut paper after printing" defaultChecked={s["printer.autoCut"]} />
          <Field label="Date &amp; time position on receipt">
            <select name="receipt.datePosition" defaultValue={s["receipt.datePosition"]} className="select">
              <option value="top">Top</option>
              <option value="bottom">Bottom</option>
            </select>
          </Field>
          <Check name="receipt.showOriginalPrice" label="Show original price before discount" defaultChecked={s["receipt.showOriginalPrice"]} />
          <Check name="receipt.showDiscount" label="Show discount column" defaultChecked={s["receipt.showDiscount"]} />
          <Check name="receipt.showSavings" label="Show &quot;you saved&quot; line" defaultChecked={s["receipt.showSavings"]} />
          <Check name="receipt.showCostColumns" label="Show cost/profit columns (owner copy only)" defaultChecked={s["receipt.showCostColumns"]} />
        </Section>

        {/* ---------------- Payments ---------------- */}
        <Section title="Payment Methods" desc="You chose cash + credit for now; others can be switched on later.">
          <Check name="pay.cash" label="Cash" defaultChecked={methods.includes("cash")} />
          <Check name="pay.credit" label="Credit / Udhaar (customer account)" defaultChecked={methods.includes("credit")} />
          <Check name="pay.online" label="Online (Easypaisa / JazzCash / bank)" defaultChecked={methods.includes("online")} />
          <Check name="pay.card" label="Card machine" defaultChecked={methods.includes("card")} />
          <Field label="Default payment method">
            <select name="payment.default" defaultValue={s["payment.default"]} className="select">
              <option value="cash">Cash</option>
              <option value="credit">Credit</option>
              <option value="online">Online</option>
              <option value="card">Card</option>
            </select>
          </Field>
        </Section>

        {/* ---------------- Security ---------------- */}
        <Section title="Security" desc="You chose: PIN for staff, password for the owner.">
          <Field label="PIN length (digits)">
            <input type="number" name="security.pinLength" defaultValue={s["security.pinLength"]} className="input" min={4} max={8} />
          </Field>
          <Field label="Auto-lock after (minutes of no use)">
            <input type="number" name="security.autoLockMinutes" defaultValue={s["security.autoLockMinutes"]} className="input" min={0} max={240} />
          </Field>
          <Field label="Login stays valid for (hours)" hint="After this time the app asks for the password/PIN again (security.sessionHours).">
            <input type="number" name="security.sessionHours" defaultValue={s["security.sessionHours"]} className="input" min={1} max={72} />
          </Field>
          <div className="md:col-span-2">
            <Check name="security.requireLogin" label="Require login before billing" defaultChecked={s["security.requireLogin"]} />
            <p className="mt-2 text-[11px] text-slate-500">
              Login is now active: owner logs in with the password, staff with name + PIN. Default
              owner password is <code className="rounded bg-slate-100 px-1">area11</code> — change
              it right away from the Staff card below. Switching this off lets the app run as the
              owner without a login (not recommended).
            </p>
          </div>
        </Section>

        {/* ---------------- Cloud sync ---------------- */}
        <Section
          title="Cloud Backup (Supabase)"
          desc="You chose Supabase. The sync engine is Phase 5 of the master spec — this section will hold the connection when we reach it."
        >
          <div className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            <div className="font-medium text-slate-700">Status: not connected yet</div>
            <p className="mt-1 text-xs">
              Local data already works fully offline (one SQLite file). When we reach Phase 5 I
              will ask you to create a free Supabase project, then paste its project URL and
              public anon key here — nothing else. Your data stays on your machine first, the
              cloud is only a copy.
            </p>
          </div>
        </Section>

        {/* Save bar */}
        <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-xl bg-white p-3 shadow-lg ring-1 ring-slate-200">
          <div className="text-xs text-slate-500">
            Changes apply to the app and receipts immediately (no code edits).
          </div>
          <button type="submit" className="btn-primary">
            <Save className="h-4 w-4" />
            Save settings
          </button>
        </div>
      </form>

      {isOwner && (
        <StaffCard
          users={staffUsers}
          pinLength={Number(s["security.pinLength"]) || 4}
          message={sp.staffSaved}
          error={sp.staffError}
        />
      )}
    </div>
  );
}
