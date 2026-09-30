// ---------------------------------------------------------------------------
// Area11 - Money helpers
// ---------------------------------------------------------------------------
// RULE Z-03: raqam me kabhi ghalti na ho.
// Is liye TAMAM raqam "paisa" (integer) me rakhi jati hai: 1 rupee = 100 paisa.
// JavaScript ke float (0.1 + 0.2 = 0.30000000000000004) se bachne ke liye.
// ---------------------------------------------------------------------------

/** Rupees (decimal allowed) -> paisa (integer) */
export function toPaisa(rupees: number | string): number {
  const n = typeof rupees === "string" ? Number(rupees.replace(/[^0-9.\-]/g, "")) : rupees;
  if (!isFinite(n)) return 0;
  return Math.round(n * 100);
}

/** Paisa -> rupees (number, 2 decimals) */
export function toRupees(paisa: number): number {
  return Math.round(paisa) / 100;
}

/** Paisa -> "1,234.50" (bina currency symbol) */
export function formatAmount(paisa: number, decimals = 2): string {
  const v = toRupees(paisa);
  return v.toLocaleString("en-PK", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Paisa -> "Rs 1,234.50" */
export function formatPKR(paisa: number, decimals = 2): string {
  return `Rs ${formatAmount(paisa, decimals)}`;
}

/** Paisa -> "1,234" (agar poora rupay ho to decimals nahi) */
export function formatPKRShort(paisa: number): string {
  const v = toRupees(paisa);
  return `Rs ${v.toLocaleString("en-PK", { maximumFractionDigits: 0 })}`;
}

/**
 * Downward floor round-off (Spec 8.2): sirf NEECHE, kabhi upar nahi.
 *   545 -> 540 ;  556 -> 550
 * Return: roundOff (negative paisa) aur final amount
 */
export function applyDownwardRound(
  totalPaisa: number,
  stepRupees = 10
): { finalPaise: number; roundOffPaise: number } {
  if (stepRupees <= 0) return { finalPaise: totalPaisa, roundOffPaise: 0 };
  const step = Math.round(stepRupees * 100);
  const floored = Math.floor(totalPaisa / step) * step;
  return { finalPaise: floored, roundOffPaise: floored - totalPaisa };
}

/**
 * Discount on PROFIT MARGIN (Spec 7.2.1):
 *   cost 200, sell 300, 10% discount -> discount sirf 100 par = 10 => final 290
 */
export function marginDiscount(costPaisa: number, sellPaisa: number, percent: number): number {
  const margin = Math.max(0, sellPaisa - costPaisa);
  return Math.round((margin * percent) / 100);
}

/** Discount on total retail price (Spec 7.2.2) */
export function retailDiscount(sellPaisa: number, percent: number): number {
  return Math.round((sellPaisa * percent) / 100);
}

/**
 * Pack formula (Spec 4.2): 1 Box = boxStrips strips = boxStrips * stripTablets base units
 * unit: "box" | "strip" | "base"
 */
export function toBaseUnits(
  qty: number,
  unit: "box" | "strip" | "base",
  boxStrips: number,
  stripTablets: number
): number {
  if (unit === "box") {
    const perBox = boxStrips > 0 && stripTablets > 0 ? boxStrips * stripTablets : boxStrips > 0 ? boxStrips : 1;
    return round3(qty * perBox);
  }
  if (unit === "strip") {
    return round3(qty * (stripTablets > 0 ? stripTablets : 1));
  }
  return round3(qty);
}

/** Base units -> display: kitne box/strip/tablet bante hain */
export function fromBaseUnits(
  qtyBase: number,
  boxStrips: number,
  stripTablets: number,
  baseUnitLabel = "tab"
): string {
  if (boxStrips <= 0 || stripTablets <= 0) return `${round3(qtyBase)} ${baseUnitLabel}`;
  const perBox = boxStrips * stripTablets;
  const boxes = Math.floor(qtyBase / perBox);
  const remAfterBox = round3(qtyBase - boxes * perBox);
  const strips = Math.floor(remAfterBox / stripTablets);
  const loose = round3(remAfterBox - strips * stripTablets);

  const parts: string[] = [];
  if (boxes > 0) parts.push(`${boxes} box`);
  if (strips > 0) parts.push(`${strips} strip`);
  if (loose > 0 || parts.length === 0) parts.push(`${loose} ${baseUnitLabel}`);
  return parts.join(" + ");
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Percentage helper */
export function percentOf(amountPaisa: number, percent: number): number {
  return Math.round((amountPaisa * percent) / 100);
}
