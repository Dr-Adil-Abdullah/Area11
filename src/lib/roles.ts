// ---------------------------------------------------------------------------
// Area11 - Roles (Login ke baad "kaun kya kar sakta hai")
// ---------------------------------------------------------------------------
// Owner   = sab kuch (settings, backup, staff, discount sab se zyada)
// Manager = roz-marra ka kaam + apni discount limit
// Cashier = counter + sales + returns (settings/staff/backup nahi)
// ---------------------------------------------------------------------------

export type Role = "owner" | "manager" | "cashier";

export const ROLES: Role[] = ["owner", "manager", "cashier"];

export function isRole(value: string | null | undefined): value is Role {
  return value === "owner" || value === "manager" || value === "cashier";
}

/** Kya ye role settings/staff/backup kar sakta hai? */
export function canManageShop(role: string | null | undefined): boolean {
  return role === "owner" || role === "manager";
}

/** Sab kuch (staff, backup, settings) sirf owner */
export function isOwner(role: string | null | undefined): boolean {
  return role === "owner";
}

/** Discount ki max percent is role ke liye (settings se aati hai) */
export function maxDiscountPercent(
  role: string | null | undefined,
  limits: { cashier: number; manager: number; owner: number }
): number {
  if (role === "cashier") return limits.cashier;
  if (role === "manager") return limits.manager;
  return limits.owner;
}

/**
 * Bill discount check: percent limit se zyada hai?
 * Return: { allowed, percent, limit }
 */
export function checkDiscountLimit(
  discountPaisa: number,
  linesTotalPaisa: number,
  limitPercent: number
): { allowed: boolean; percent: number; limit: number } {
  if (linesTotalPaisa <= 0 || discountPaisa <= 0) {
    return { allowed: true, percent: 0, limit: limitPercent };
  }
  const percent = (discountPaisa / linesTotalPaisa) * 100;
  return {
    allowed: percent <= limitPercent + 1e-9,
    percent: Math.round(percent * 100) / 100,
    limit: limitPercent,
  };
}
