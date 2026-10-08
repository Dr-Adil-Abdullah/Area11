// ---------------------------------------------------------------------------
// Area11 - galla/shift ka sirf riyazi hisaab (DB se azad -> test asaan)
// ---------------------------------------------------------------------------

/** Expected cash = opening float + (cash sales + wasooli) - (refund + supplier + kharcha + nikasi) */
export function expectedCashOf(openingFloatPaisa: number, f: {
  cashSales: number; collections: number; refunds: number;
  supplierPaid: number; expenses: number; drawings: number;
}): number {
  const r = (n: number) => Math.round(n);
  return (
    r(openingFloatPaisa) + r(f.cashSales) + r(f.collections) - r(f.refunds) - r(f.supplierPaid) - r(f.expenses) - r(f.drawings)
  );
}

/** Ginta hua cash aur expected ka farq (+ = zyada, - = kam) */
export function varianceOf(expectedPaisa: number, actualPaisa: number): number {
  return Math.round(actualPaisa) - Math.round(expectedPaisa);
}
