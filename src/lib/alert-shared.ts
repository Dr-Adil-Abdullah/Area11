// ---------------------------------------------------------------------------
// Area11 - ALERT: saaf (pure) hisaab -- bina database ke
// ---------------------------------------------------------------------------
// Is file me SIRF woh functions hain jinhein koi database ya network nahi
// chahiye. Is liye in par `npm test` mein asaani se test likhe ja sakte hain
// (khali data folder par bhi) -- baqi sab `alert-dismiss.ts` me hai.
// ---------------------------------------------------------------------------

/** Wajah kitni chhoti ho sakti hai (3 harf se kam manzoor nahi) */
export const REASON_MIN = 3;

/** alert_key ka dhancha: har qism ka apna (ek alert ek hi dafa khatam hota hai) */
export function alertKey(type: string, entityId: number | null | undefined): string {
  return `${type}:${entityId ?? 0}`;
}

/** Manfi stock wali dawa ka key */
export function negStockKey(productId: number): string {
  return alertKey("negstock", productId);
}

/** Bina bill wapsi ka key */
export function provisionalKey(id: number): string {
  return alertKey("provisional", id);
}

export type AnyAlert = { key: string; type: string };

/** Khatam ki hui alerts ko fehrist se nikaal dein (malik ki wajah ka ehtaram) */
export function removeDismissed<T extends AnyAlert>(rows: T[], dismissed: Set<string>): T[] {
  return rows.filter((r) => !dismissed.has(r.key));
}

/** Wajah theek hai ya nahi (khaali / bohat chhoti = manzoor nahi) */
export function reasonError(reason: string | null | undefined): string | null {
  const r = (reason ?? "").trim();
  if (r.length < REASON_MIN) {
    return `Wajah (reason) likhna lazmi hai — kam az kam ${REASON_MIN} harf.`;
  }
  return null;
}

/** Sirf MALIK (owner) alert khatam kar sakta hai */
export function canDismissAlerts(role: string | null | undefined): boolean {
  return role === "owner";
}
