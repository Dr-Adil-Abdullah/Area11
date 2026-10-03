import type { Sale } from './model'

/** Exact paisa arithmetic: intermediate products never go through floating point. */
export function ratioFloor(a: number, b: number, denominator: number) {
  if (![a, b, denominator].every(Number.isSafeInteger) || a < 0 || b < 0 || denominator <= 0)
    throw new Error('Invalid monetary allocation.')
  const result = Number((BigInt(a) * BigInt(b)) / BigInt(denominator))
  if (!Number.isSafeInteger(result)) throw new Error('Amount exceeds the safe monetary range.')
  return result
}
export function discountAmount(
  retail: number,
  cost: number,
  bps: number,
  mode: 'margin' | 'retail',
) {
  return ratioFloor(mode === 'margin' ? Math.max(0, retail - cost) : retail, bps, 10000)
}

/** Allocate invoice rounding from profit, never from a line's purchase cost.
 * Largest remainders are tied by original line order; the sum is actual cash collected.
 */
export function paidByLine(sale: Sale): number[] {
  const margin = sale.subtotal - sale.cost
  if (!margin) return sale.lines.map((line) => line.cost)
  const collectedMargin = sale.total - sale.cost
  const parts = sale.lines.map((line, index) => ({
    index,
    amount: line.cost + ratioFloor(collectedMargin, line.total - line.cost, margin),
    remainder: (BigInt(collectedMargin) * BigInt(line.total - line.cost)) % BigInt(margin),
  }))
  const leftover = sale.total - parts.reduce((n, p) => n + p.amount, 0)
  const ranked = [...parts].sort((a, b) =>
    a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1,
  )
  for (let i = 0; i < leftover; i++) ranked[i].amount += 1
  return parts.map((p) => p.amount)
}
export function partialRefund(
  paid: number,
  soldUnits: number,
  alreadyReturned: number,
  units: number,
) {
  return (
    ratioFloor(paid, alreadyReturned + units, soldUnits) -
    ratioFloor(paid, alreadyReturned, soldUnits)
  )
}
