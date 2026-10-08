// ---------------------------------------------------------------------------
// Area11 - QUARANTINE ka saaf (pure) hisaab -- bina database ke (U-34)
// ---------------------------------------------------------------------------
// Malik ka hukum: har saman jo quarantine me ho us ka ek MUSTAQIL number ho
// (Q-0001) jo change na ho sake, aur history me saaf nazar aaye ke
// "kaun sa saman kidhar gaya". Yahan sirf woh functions hain jinhein DB
// nahi chahiye -- taake `npm test` in par nazar rakhe.
// ---------------------------------------------------------------------------

/** Quarantine ke saman ka aakhiri anjam (kahan gaya) */
export type Disposition = "quarantine" | "restocked" | "expired" | "sold";

export const DISPOSITIONS: Disposition[] = ["quarantine", "restocked", "expired", "sold"];

/** Urdu mein saaf matlab (malik ke liye) */
export function dispositionLabel(d: string): string {
  switch (d) {
    case "quarantine":
      return "قرنطینہ میں";
    case "restocked":
      return "اسٹاک (شیلف) میں واپس";
    case "expired":
      return "ایکسپائری / خراب (write-off)";
    case "sold":
      return "فروخت کر دیا گیا";
    default:
      return d;
  }
}

/**
 * Kya ye anjam "aakhri" hai? (yaani ab is par dobara faisla nahi ho sakta)
 * quarantine = abhi faisla baqi; baqi sab = aakhri.
 */
export function isFinalDisposition(d: string): boolean {
  return d === "restocked" || d === "expired" || d === "sold";
}

/** Kya is anjam ke baad maal stock me wapas aata hai? (sirf restocked) */
export function addsBackToStock(d: string): boolean {
  return d === "restocked";
}

/** Alerts ke liye: har quarantine item ki alag (aur mustaqil) key */
export function quarantineAlertKey(returnId: number): string {
  return `quarantine:${returnId}`;
}
