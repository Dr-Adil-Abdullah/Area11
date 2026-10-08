// ---------------------------------------------------------------------------
// Area11 - Audit: PURANA vs NAYA nikalne ka saada (pure) hisaab
// ---------------------------------------------------------------------------
// Yahan koi database ka kaam nahi -- sirf do records ka farq. Is liye is par
// test likhna aasaan hai (aur woh test chal bhi jayega, kyun ke ye module
// db.ts ko import hi nahi karta).
// ---------------------------------------------------------------------------

export type FieldDiff = Record<string, { from: unknown; to: unknown }>;

/**
 * Do records ka farq: sirf wahi fields jo BADLI hain.
 *   diffFields({a:1,b:"x"}, {a:2,b:"x"})  →  { a: { from: 1, to: 2 } }
 */
export function diffFields(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined
): FieldDiff {
  if (!before || !after) return {};
  const out: FieldDiff = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of keys) {
    const a = before[k];
    const b = after[k];
    if (JSON.stringify(a ?? null) === JSON.stringify(b ?? null)) continue;
    out[k] = { from: a ?? null, to: b ?? null };
  }
  return out;
}

/** Farq ko do column (purana / naya) me baant do */
export function splitDiff(diff: FieldDiff): {
  oldValue: Record<string, unknown>;
  newValue: Record<string, unknown>;
} {
  const oldValue: Record<string, unknown> = {};
  const newValue: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(diff)) {
    oldValue[k] = v.from;
    newValue[k] = v.to;
  }
  return { oldValue, newValue };
}

/** 3.5 tablet ko "3.5" aur 4 ko "4" dikhane ke liye */
export function roundQty(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Log ke do column (purana / naya) taiyar karo -- chahe record naya ho,
 * mita diya gaya ho ya sirf badla ho.
 *   naya record  → purana null, naya = poori value
 *   mitaya gaya  → purana = poori value, naya null
 *   badla gaya   → sirf wahi felds jo badli hain
 */
export function valuesForLog(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined
): { oldValue: Record<string, unknown> | null; newValue: Record<string, unknown> | null } {
  const b = before ?? null;
  const a = after ?? null;
  if (a && !b) return { oldValue: null, newValue: a };
  if (b && !a) return { oldValue: b, newValue: null };
  if (b && a) {
    const diff = diffFields(b, a);
    if (!Object.keys(diff).length) return { oldValue: null, newValue: null };
    return splitDiff(diff);
  }
  return { oldValue: null, newValue: null };
}
