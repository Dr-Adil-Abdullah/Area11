// ---------------------------------------------------------------------------
// Area11 - Reports ka saaf (pure) hisaab -- bina database ke
// ---------------------------------------------------------------------------
// Review (U-36) me pakra gaya nuqs: wapsi ka maal jab SHELF par wapas aata hai
// (restock = 1) to us ki laagat (cost) bhi munafay me wapas aani chahiye --
// warna munafa KAM dikhta hai. Is file me wohi qaida likha hai, taake
// `npm test` is par hamesha nazar rakhe (khali data folder par bhi).
// ---------------------------------------------------------------------------

/**
 * Khudara (net) munafa:
 *   (bikri − wapsi) − (laagat − wapas aaye maal ki laagat)
 *
 * Wapsi ki LAAGAT sirf tab wapas milti hai jab maal waqai stock me aya ho
 * (restock = 1). Agar maal quarantine me hai ya kharaab ho gaya to laagat
 * wapas NAHI aati (nuqsan mana jata hai).
 */
export function netProfitPaisa(i: {
  salesPaisa: number;
  refundPaisa: number;
  costPaisa: number;
  /** wapas aaye (restock = 1) maal ki laagat */
  returnedCostPaisa: number;
}): number {
  return i.salesPaisa - i.refundPaisa - (i.costPaisa - i.returnedCostPaisa);
}

/**
 * Margin (faisad / percent): net bikri par munafa ka hissa.
 * Net bikri zero ya manfi ho to 0 (taake hisab na bigray).
 */
export function marginPercent(salesMinusRefundPaisa: number, profitPaisa: number): number {
  if (salesMinusRefundPaisa <= 0) return 0;
  return Math.round((profitPaisa / salesMinusRefundPaisa) * 1000) / 10;
}

/** Kitne number (units) waqai bike (wapsi ghat kar) */
export function netUnitsSold(soldBase: number, returnedBase: number): number {
  return Math.round((soldBase - returnedBase) * 1000) / 1000;
}
