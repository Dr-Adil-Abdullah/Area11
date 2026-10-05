"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSettings, setSettings } from "@/lib/settings";
import { audit } from "@/lib/audit";
import { currentUser } from "@/lib/session";
import { createUser, updateUser } from "@/lib/users";

function str(fd: FormData, key: string, fallback = ""): string {
  const v = fd.get(key);
  return v == null ? fallback : String(v).trim();
}
function num(fd: FormData, key: string, fallback = 0): number {
  const v = Number(String(fd.get(key) ?? "").trim());
  return isFinite(v) ? v : fallback;
}
function bool(fd: FormData, key: string): boolean {
  const v = fd.get(key);
  return v === "on" || v === "true" || v === "1";
}

async function saveAll(fd: FormData) {
  const patch: Record<string, unknown> = {
    // Store & branding
    "store.name": str(fd, "store.name"),
    "store.address": str(fd, "store.address"),
    "store.phone": str(fd, "store.phone"),
    "store.footerNote": str(fd, "store.footerNote"),
    "store.terms": str(fd, "store.terms"),
    "brand.appName": str(fd, "brand.appName"),
    "brand.shortName": str(fd, "brand.shortName"),
    "brand.logoDataUrl": str(fd, "brand.logoDataUrl"),
    "brand.primaryColor": str(fd, "brand.primaryColor", "#0e7490"),

    // Billing
    "bill.purchasePrefix": str(fd, "bill.purchasePrefix", "PINV-"),
    "bill.salePrefix": str(fd, "bill.salePrefix", "INV-"),
    "bill.numberPadding": num(fd, "bill.numberPadding", 4),
    "bill.nextPurchaseNo": num(fd, "bill.nextPurchaseNo", 1),
    "bill.nextSaleNo": num(fd, "bill.nextSaleNo", 1),
    "bill.roundMode": str(fd, "bill.roundMode", "down10"),
    "bill.roundTo": num(fd, "bill.roundTo", 10),

    // Tax
    "tax.enabled": bool(fd, "tax.enabled"),
    "tax.percent": num(fd, "tax.percent", 0),
    "tax.label": str(fd, "tax.label", "Sales Tax"),

    // Discount
    "discount.enabled": bool(fd, "discount.enabled"),
    "discount.mode": str(fd, "discount.mode", "margin"),
    "discount.maxPercentCashier": num(fd, "discount.maxPercentCashier", 5),
    "discount.maxPercentManager": num(fd, "discount.maxPercentManager", 20),
    "discount.blockBelowCost": bool(fd, "discount.blockBelowCost"),

    // Expiry levels
    "expiry.levels": [1, 2, 3].map((lvl) => ({
      level: lvl,
      days: num(fd, `expiry${lvl}.days`, [365, 180, 90][lvl - 1]),
      color: str(fd, `expiry${lvl}.color`, ["blue", "yellow", "red"][lvl - 1]),
      label: str(fd, `expiry${lvl}.label`, ""),
    })),

    // Reorder
    "reorder.enabled": bool(fd, "reorder.enabled"),

    // Loyalty
    "loyalty.enabled": bool(fd, "loyalty.enabled"),
    "loyalty.rupeesPerPoint": num(fd, "loyalty.rupeesPerPoint", 100),
    "loyalty.vipThreshold": num(fd, "loyalty.vipThreshold", 500),

    // Printer & receipt
    "printer.width": str(fd, "printer.width", "both"),
    "printer.autoCut": bool(fd, "printer.autoCut"),
    "printer.copies": num(fd, "printer.copies", 1),
    "receipt.datePosition": str(fd, "receipt.datePosition", "top"),
    "receipt.showOriginalPrice": bool(fd, "receipt.showOriginalPrice"),
    "receipt.showDiscount": bool(fd, "receipt.showDiscount"),
    "receipt.showSavings": bool(fd, "receipt.showSavings"),
    "receipt.showCostColumns": bool(fd, "receipt.showCostColumns"),

    // Payments
    "payment.methods": ["cash", "credit", "online", "card"].filter(
      (m) => fd.get(`pay.${m}`) === "on"
    ),
    "payment.default": str(fd, "payment.default", "cash"),

    // Backup (khud-b-khud, photos ke sath)
    "backup.autoEnabled": bool(fd, "backup.autoEnabled"),
    "backup.everyHours": num(fd, "backup.everyHours", 24),
    "backup.keep": num(fd, "backup.keep", 7),

    // Udhaar (credit) ki hadd
    "credit.blockOverLimit": bool(fd, "credit.blockOverLimit"),
    "credit.managerCanOverride": bool(fd, "credit.managerCanOverride"),

    // Security
    "security.pinLength": num(fd, "security.pinLength", 4),
    "security.autoLockMinutes": num(fd, "security.autoLockMinutes", 15),
    "security.sessionHours": num(fd, "security.sessionHours", 12),
    "security.requireLogin": bool(fd, "security.requireLogin"),
  };

  await setSettings(patch);

  const user = await currentUser();
  await audit({
    action: "settings_change",
    userId: user?.id,
    userName: user?.name,
    entity: "Setting",
    details: { keys: Object.keys(patch), store: patch["store.name"] },
  });

  revalidatePath("/settings");
  revalidatePath("/");
}

export async function saveSettingsAction(fd: FormData): Promise<void> {
  await saveAll(fd);
  redirect("/settings?saved=1");
}

// ---------------------------------------------------------------------------
// Staff accounts (sirf owner) -- Settings page ke Staff card se aate hain
// ---------------------------------------------------------------------------

export async function addUserAction(fd: FormData): Promise<void> {
  const actor = await currentUser();
  if (actor?.role !== "owner") {
    redirect("/settings?staffError=" + encodeURIComponent("Only the owner can manage staff"));
  }
  const settings = await getSettings();
  const pinLength = Number(settings["security.pinLength"]) || 4;
  let error = "";
  try {
    const id = createUser(
      {
        name: str(fd, "name"),
        role: str(fd, "role", "cashier"),
        pin: str(fd, "pin"),
        password: str(fd, "password"),
        active: true,
      },
      pinLength
    );
    await audit({
      action: "create",
      userId: actor?.id,
      userName: actor?.name,
      entity: "User",
      entityId: id,
      details: { name: str(fd, "name"), role: str(fd, "role", "cashier") },
    });
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not add account";
  }
  revalidatePath("/settings");
  if (error) redirect("/settings?staffError=" + encodeURIComponent(error));
  redirect("/settings?staffSaved=" + encodeURIComponent("Account added"));
}

export async function updateUserAction(fd: FormData): Promise<void> {
  const actor = await currentUser();
  if (actor?.role !== "owner") {
    redirect("/settings?staffError=" + encodeURIComponent("Only the owner can manage staff"));
  }
  const settings = await getSettings();
  const pinLength = Number(settings["security.pinLength"]) || 4;
  const id = Number(fd.get("id"));
  let error = "";
  try {
    updateUser(
      id,
      {
        name: str(fd, "name"),
        role: str(fd, "role"),
        pin: str(fd, "pin"),
        password: str(fd, "password"),
        active: bool(fd, "active"),
      },
      pinLength
    );
    await audit({
      action: "update",
      userId: actor?.id,
      userName: actor?.name,
      entity: "User",
      entityId: id,
      details: { name: str(fd, "name"), role: str(fd, "role"), active: bool(fd, "active") },
    });
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not save account";
  }
  revalidatePath("/settings");
  if (error) redirect("/settings?staffError=" + encodeURIComponent(error));
  redirect("/settings?staffSaved=" + encodeURIComponent("Account saved"));
}
