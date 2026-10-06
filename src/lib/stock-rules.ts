// ---------------------------------------------------------------------------
// Area11 - Spec 1: NEGATIVE inventory ke usool (pure functions)
// ---------------------------------------------------------------------------
// Yahan sirf "hisaab" hai -- koi database nahi. Is liye:
//   (1) is par test likhna aasaan hai
//   (2) counter (POS) aur server dono EK hi tareeqe se faisla karte hain
// ---------------------------------------------------------------------------

// NOTE: ye module jaan-bujh kar kisi cheez ko import nahi karta -- is liye
//       is par test baghair database ke chal jata hai.

/** 3.5 tablet ko "3.5" aur 4 ko "4" dikhane ke liye */
function roundQty(n: number): number {
  return Math.round(n * 1000) / 1000;
}
export type NegativeInput = {
  name: string;
  /** is waqt kitna maujood hai (batch ya poori dawa) */
  inStockBase: number;
  /** kitna becha ja raha hai */
  sellBase: number;
  /** Settings: manfi stock ki ijazat? */
  allowNegative: boolean;
  /** Settings: alert dikhayein? */
  warn: boolean;
  /** kis cheez ka stock dekha (masalan "batch B12") */
  stockLabel?: string;
};

export type NegativeVerdict = {
  /** stock minus me gaya? */
  short: boolean;
  /** bikri ROKNI hai? (allowNegative OFF hone par hi true) */
  block: boolean;
  /** ooper wale bade alert ka paigham ( Urdu ) */
  message: string;
  /** is ke baad stock kitna hoga */
  afterBase: number;
};

/**
 * Faisla: ye line stock ko minus me le jayegi ya nahi?
 *  - allowNegative ON  → bikri HOTI rahe + bara alert
 *  - allowNegative OFF → bikri RUK jaye
 */
export function evaluateNegativeStock(i: NegativeInput): NegativeVerdict {
  const shortBy = i.sellBase - i.inStockBase;
  const afterBase = roundQty(i.inStockBase - i.sellBase);
  const label = i.stockLabel || "stock";

  if (shortBy <= 1e-9) {
    return { short: false, block: false, message: "", afterBase };
  }

  const warned =
    `${i.name}: ${label} me sirf ${roundQty(i.inStockBase)} the, ${roundQty(i.sellBase)} bike — ` +
    `stock MINUS (${roundQty(-shortBy)}) me chala gaya.`;

  if (!i.allowNegative) {
    const err = new Error(
      `${i.name}: ${label} me sirf ${roundQty(i.inStockBase)} hain, ${roundQty(i.sellBase)} nahi ho sakte. ` +
        `(Manfi stock band hai — Settings › Stock se ijazat dein ya miqdar kam karein.)`
    );
    (err as Error & { status?: number }).status = 409;
    (err as Error & { verdict?: NegativeVerdict }).verdict = {
      short: true,
      block: true,
      message: err.message,
      afterBase,
    };
    throw err;
  }

  return { short: true, block: false, message: i.warn ? warned : "", afterBase };
}
