import { z } from 'zod'
import { validateFinancialState } from './legacy-validation-v2'
import { discountAmount } from './arithmetic'

export const roles = ['owner', 'manager', 'cashier'] as const
export type Role = (typeof roles)[number]
export const categories = ['Tablets', 'Capsules', 'Liquids', 'Essentials'] as const
export const baseUnits = ['tablet', 'capsule', 'piece', 'ml'] as const
export const packUnits = ['box', 'strip', 'loose'] as const
export type PackUnit = (typeof packUnits)[number]

const id = z.string().min(1).max(100)
const customerPhoneSchema = z
  .string()
  .trim()
  .max(40)
  .regex(/^[0-9+() -]*$/)
  .refine((value) => !value || value.replace(/\D/g, '').length >= 3, 'Invalid lookup phone.')
const money = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const count = z.number().int().nonnegative().max(1_000_000_000_000)
const quantity = z.number().int().positive().max(1_000_000)
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const parsed = new Date(`${s}T00:00:00Z`)
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === s
  }, 'Enter a valid date.')
const timestamp = z.iso.datetime()

export const productSchema = z
  .object({
    id,
    name: z.string().trim().min(2).max(100),
    description: z.string().trim().max(120),
    category: z.enum(categories),
    baseUnit: z.enum(baseUnits),
    unitsPerStrip: z.number().int().positive().max(1_000),
    stripsPerBox: z.number().int().positive().max(1_000),
    barcodes: z.object({
      box: z.string().trim().max(50),
      strip: z.string().trim().max(50),
      loose: z.string().trim().max(50),
    }),
  })
  .strict()
export type Product = z.infer<typeof productSchema>
export type ProductInput = Omit<Product, 'id'>

export const batchSchema = z
  .object({
    id,
    productId: id,
    purchaseId: id,
    number: z.string().trim().min(1).max(50),
    expiresOn: dateSchema,
    receivedAt: timestamp,
    stockUnits: count,
    quarantinedUnits: count,
    costPerBase: money,
    pricePerBase: money,
  })
  .strict()
export type Batch = z.infer<typeof batchSchema>

export const cartLineSchema = z
  .object({
    id,
    productId: id,
    batchId: id,
    unit: z.enum(packUnits),
    quantity,
  })
  .strict()
export type CartLine = z.infer<typeof cartLineSchema>
const parkedCartSchema = z
  .object({
    id,
    name: z.string().trim().min(1).max(60),
    createdAt: timestamp,
    lines: z.array(cartLineSchema).min(1),
    discountBps: z.number().int().min(0).max(10000),
    discountMode: z.enum(['margin', 'retail']),
    phone: customerPhoneSchema,
  })
  .strict()
export type ParkedCart = z.infer<typeof parkedCartSchema>

const purchaseLineSchema = z
  .object({
    productId: id,
    productName: z.string(),
    batchId: id,
    batchNumber: z.string(),
    expiresOn: dateSchema,
    baseUnit: z.enum(baseUnits),
    unit: z.enum(packUnits),
    quantity,
    baseQuantity: count,
    costPerBase: money,
    pricePerBase: money,
    totalCost: money,
  })
  .strict()
export const purchaseSchema = z
  .object({
    id,
    number: z.string().regex(/^PINV-\d{4,}$/),
    supplier: z.string().trim().min(2).max(100),
    reference: z.string().trim().max(80),
    createdAt: timestamp,
    role: z.enum(roles),
    lines: z.array(purchaseLineSchema).min(1),
    totalCost: money,
  })
  .strict()
export type Purchase = z.infer<typeof purchaseSchema>

const saleLineSchema = z
  .object({
    productId: id,
    productName: z.string(),
    batchId: id,
    batchNumber: z.string(),
    expiresOn: dateSchema,
    baseUnit: z.enum(baseUnits),
    unit: z.enum(packUnits),
    quantity,
    baseQuantity: count,
    pricePerPack: money,
    retailTotal: money,
    discount: money,
    cost: money,
    total: money,
  })
  .strict()
export const saleSchema = z
  .object({
    id,
    number: z.string().regex(/^INV-\d{4,}$/),
    createdAt: timestamp,
    role: z.enum(roles),
    lines: z.array(saleLineSchema).min(1),
    grossSubtotal: money,
    discount: money,
    discountBps: z.number().int().min(0).max(10000),
    discountMode: z.enum(['margin', 'retail']),
    customerPhone: customerPhoneSchema,
    cashSessionId: id.nullable(),
    legacy: z.boolean(),
    subtotal: money,
    cost: money,
    rounding: money,
    roundingSkipped: z.boolean(),
    total: money,
    tendered: money,
    change: money,
  })
  .strict()
export type Sale = z.infer<typeof saleSchema>
export type SaleLine = Sale['lines'][number]

export const settingsSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    address: z.string().trim().max(150),
    phone: z.string().trim().max(50),
    footer: z.string().trim().max(180),
    paperWidth: z.union([z.literal(58), z.literal(80)]),
    discountMode: z.enum(['margin', 'retail']),
    cashierMaxDiscountBps: z.number().int().min(0).max(10000),
  })
  .strict()
export type Settings = z.infer<typeof settingsSchema>

export const returnReasons = [
  'Customer change',
  'Wrong item',
  'Damaged',
  'Expired',
  'Other',
] as const
const signedMoney = z.number().int().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER)
const returnLineSchema = z
  .object({
    saleLineIndex: z.number().int().nonnegative(),
    productId: id,
    batchId: id,
    productName: z.string(),
    baseQuantity: count.positive(),
    refund: money,
    disposition: z.enum(['restock', 'quarantine']),
  })
  .strict()
export const returnSchema = z
  .object({
    id,
    number: z.string().regex(/^RET-\d{4,}$/),
    saleId: id,
    provisionalId: id.nullable(),
    createdAt: timestamp,
    role: z.enum(roles),
    reason: z.enum(returnReasons),
    notes: z.string().trim().max(400),
    lines: z.array(returnLineSchema).min(1),
    refund: money,
    cashSessionId: id.nullable(),
    settlement: z.enum(['direct', 'matched', 'cash', 'expense']),
    cashDifference: signedMoney,
    differenceExpenseId: id.nullable(),
  })
  .strict()
export type SalesReturn = z.infer<typeof returnSchema>
export const provisionalSchema = z
  .object({
    id,
    number: z.string().regex(/^PR-\d{4,}$/),
    createdAt: timestamp,
    role: z.enum(roles),
    phone: customerPhoneSchema,
    reason: z.enum(returnReasons),
    notes: z.string().trim().max(400),
    refundPaid: money.positive(),
    cashSessionId: id,
    items: z
      .array(z.object({ productId: id, productName: z.string(), baseQuantity: count.positive() }))
      .min(1),
    linkedReturnId: id.nullable(),
  })
  .strict()
export type ProvisionalReturn = z.infer<typeof provisionalSchema>
export const cashSessionSchema = z
  .object({
    id,
    number: z.string().regex(/^SHIFT-\d{4,}$/),
    operator: z.string().trim().min(2).max(60),
    opening: money,
    openedAt: timestamp,
    openedBy: z.enum(roles),
    status: z.enum(['open', 'closed']),
    closedAt: timestamp.nullable(),
    closedBy: z.enum(roles).nullable(),
    counted: money.nullable(),
    expectedAtClose: money.nullable(),
    variance: signedMoney.nullable(),
    closeNote: z.string().trim().max(300),
    previousSessionId: id.nullable(),
    handoverTo: id.nullable(),
  })
  .strict()
export type CashSession = z.infer<typeof cashSessionSchema>
export const cashEntryKinds = [
  'sale',
  'return',
  'provisional-refund',
  'return-settlement',
  'expense',
  'owner-withdrawal',
  'owner-deposit',
] as const
const cashEntrySchema = z
  .object({
    id,
    sessionId: id,
    createdAt: timestamp,
    role: z.enum(roles),
    kind: z.enum(cashEntryKinds),
    amount: signedMoney,
    refId: id,
  })
  .strict()
export type CashEntry = z.infer<typeof cashEntrySchema>
const expenseSchema = z
  .object({
    id,
    number: z.string().regex(/^EXP-\d{4,}$/),
    createdAt: timestamp,
    paidOn: dateSchema,
    role: z.enum(['owner', 'manager']),
    kind: z.enum(['daily', 'monthly', 'return-adjustment']),
    category: z.string().trim().min(2).max(60),
    amount: money.positive(),
    notes: z.string().trim().max(300),
    payment: z.enum(['cash', 'adjustment']),
    cashSessionId: id.nullable(),
    relatedReturnId: id.nullable(),
  })
  .strict()
export type Expense = z.infer<typeof expenseSchema>
const ownerEntrySchema = z
  .object({
    id,
    number: z.string().regex(/^DRAW-\d{4,}$/),
    createdAt: timestamp,
    role: z.literal('owner'),
    kind: z.enum(['cash-withdrawal', 'cash-deposit', 'medicine-use']),
    amount: money,
    notes: z.string().trim().min(2).max(300),
    cashSessionId: id.nullable(),
    productId: id.nullable(),
    batchId: id.nullable(),
    baseQuantity: count.nullable(),
  })
  .strict()
export type OwnerEntry = z.infer<typeof ownerEntrySchema>

const rawStateSchema = z
  .object({
    schemaVersion: z.literal(2),
    revision: count,
    nextPurchaseNumber: z.number().int().positive(),
    nextSaleNumber: z.number().int().positive(),
    nextReturnNumber: z.number().int().positive(),
    nextProvisionalNumber: z.number().int().positive(),
    nextCashSessionNumber: z.number().int().positive(),
    nextExpenseNumber: z.number().int().positive(),
    nextOwnerEntryNumber: z.number().int().positive(),
    products: z.array(productSchema),
    batches: z.array(batchSchema),
    purchases: z.array(purchaseSchema),
    sales: z.array(saleSchema),
    cart: z.array(cartLineSchema),
    parkedCarts: z.array(parkedCartSchema),
    settings: settingsSchema,
    cartDiscountMode: z.enum(['margin', 'retail']),
    cartDiscountBps: z.number().int().min(0).max(10000),
    cartPhone: customerPhoneSchema,
    salesReturns: z.array(returnSchema),
    provisionalReturns: z.array(provisionalSchema),
    cashSessions: z.array(cashSessionSchema),
    cashEntries: z.array(cashEntrySchema),
    expenses: z.array(expenseSchema),
    ownerEntries: z.array(ownerEntrySchema),
  })
  .strict()
export type LegacyV2State = z.infer<typeof rawStateSchema>

// Validate saved data before using it. Never silently overwrite an unreadable workspace.
export const legacyV2StateSchema = rawStateSchema.superRefine((s, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: 'custom', message })
  for (const list of [s.products, s.batches, s.purchases, s.sales, s.parkedCarts]) {
    if (new Set(list.map((x) => x.id)).size !== list.length) fail('Duplicate record identifiers.')
  }
  const productIds = new Set(s.products.map((p) => p.id))
  const batchIds = new Set(s.batches.map((b) => b.id))
  const purchaseIds = new Set(s.purchases.map((p) => p.id))
  const barcodes = s.products.flatMap((p) => Object.values(p.barcodes)).filter(Boolean)
  if (new Set(barcodes).size !== barcodes.length) fail('Duplicate barcodes.')
  for (const b of s.batches) {
    if (!productIds.has(b.productId) || !purchaseIds.has(b.purchaseId)) fail('Orphan stock batch.')
    if (b.quarantinedUnits > b.stockUnits) fail('Quarantined units exceed batch stock.')
    if (b.pricePerBase < b.costPerBase) fail('Retail price is below purchase cost.')
  }
  for (const line of [...s.cart, ...s.parkedCarts.flatMap((c) => c.lines)]) {
    if (!productIds.has(line.productId) || !batchIds.has(line.batchId)) fail('Orphan cart line.')
    if (s.batches.find((b) => b.id === line.batchId)?.productId !== line.productId)
      fail('Cart product and batch do not match.')
  }
  for (const p of s.purchases) {
    if (
      p.totalCost !== p.lines.reduce((sum, l) => sum + l.totalCost, 0) ||
      p.lines.some(
        (l) =>
          l.baseQuantity < 1 ||
          l.totalCost !== l.baseQuantity * l.costPerBase ||
          l.pricePerBase < l.costPerBase,
      )
    )
      fail('Invalid purchase total.')
    if (p.lines.some((l) => !productIds.has(l.productId) || !batchIds.has(l.batchId)))
      fail('Orphan purchase line.')
  }
  for (const sale of s.sales) {
    if (
      sale.grossSubtotal !== sale.lines.reduce((n, l) => n + l.retailTotal, 0) ||
      sale.discount !== sale.grossSubtotal - sale.subtotal ||
      sale.lines.some(
        (l) =>
          l.retailTotal < l.cost || l.total !== l.retailTotal - l.discount || l.baseQuantity < 1,
      )
    )
      fail('Invalid discounted sale.')
    for (const line of sale.lines) {
      if (
        line.retailTotal >= line.cost &&
        line.discount !==
          discountAmount(line.retailTotal, line.cost, sale.discountBps, sale.discountMode)
      )
        fail('Invalid discount snapshot.')
    }

    if (
      sale.subtotal !== sale.lines.reduce((sum, l) => sum + l.total, 0) ||
      sale.cost !== sale.lines.reduce((sum, l) => sum + l.cost, 0)
    )
      fail('Invalid sale totals.')
    if (sale.subtotal < sale.cost) {
      fail('Sale is below purchase cost.')
      continue
    }
    const expected = roundBill(sale.subtotal, sale.cost)
    if (
      sale.total !== expected.total ||
      sale.rounding !== expected.rounding ||
      sale.roundingSkipped !== expected.skipped ||
      sale.change !== sale.tendered - sale.total ||
      sale.total < sale.cost
    )
      fail('Invalid sale payment.')
    if (sale.lines.some((l) => !productIds.has(l.productId) || !batchIds.has(l.batchId)))
      fail('Orphan sale line.')
  }
  for (const [records, next] of [
    [s.purchases, s.nextPurchaseNumber],
    [s.sales, s.nextSaleNumber],
  ] as const) {
    const numbers = records.map((r) => r.number)
    if (
      new Set(numbers).size !== numbers.length ||
      numbers.some((n) => Number(n.split('-')[1]) >= next)
    )
      fail('Invalid invoice sequence.')
  }
  validateFinancialState(s, fail)
})

export class DomainError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DomainError'
  }
}
export const uid = () => crypto.randomUUID()
export const invoiceNumber = (
  prefix: 'INV' | 'PINV' | 'RET' | 'PR' | 'EXP' | 'DRAW' | 'SHIFT',
  value: number,
) => `${prefix}-${String(value).padStart(4, '0')}`
export function businessDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const get = (key: string) => parts.find((p) => p.type === key)!.value
  return `${get('year')}-${get('month')}-${get('day')}`
}
export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
export function daysUntil(date: string, today: string): number {
  return Math.round((Date.parse(date) - Date.parse(today)) / 86_400_000)
}
// A printed expiry date remains saleable through that date. Month-only input is not guessed.
export const isExpired = (batch: Batch, today: string) => batch.expiresOn < today
export const factor = (p: Product, unit: PackUnit) =>
  unit === 'box' ? p.stripsPerBox * p.unitsPerStrip : unit === 'strip' ? p.unitsPerStrip : 1
export const availableUnits = (p: Product): PackUnit[] => [
  ...(factor(p, 'box') > 1 ? ['box' as const] : []),
  ...(p.unitsPerStrip > 1 ? ['strip' as const] : []),
  'loose',
]
export const defaultUnit = (p: Product): PackUnit => (p.unitsPerStrip > 1 ? 'strip' : 'loose')
export function unitLabel(p: Pick<Product, 'baseUnit'>, unit: PackUnit, plural = false) {
  if (unit === 'box') return plural ? 'boxes' : 'box'
  if (unit === 'strip') return plural ? 'strips' : 'strip'
  return p.baseUnit === 'ml' ? 'ml' : `${p.baseUnit}${plural ? 's' : ''}`
}
export function safeMultiply(...values: number[]) {
  const result = values.reduce((a, b) => a * b, 1)
  if (!Number.isSafeInteger(result) || result < 0)
    throw new DomainError('This amount is too large. Use a smaller quantity.')
  return result
}
export function parseMoney(value: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim()))
    throw new DomainError('Enter a non-negative price with up to two decimal places.')
  const [whole, fraction = ''] = value.trim().split('.')
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  if (!Number.isSafeInteger(result) || result > 1_000_000_000)
    throw new DomainError('The price is too large.')
  return result
}
export function parseQuantity(value: string): number {
  const result = Number(value)
  if (!value.trim() || !Number.isInteger(result) || result <= 0 || result > 1_000_000)
    throw new DomainError('Quantity must be a whole number between 1 and 1,000,000.')
  return result
}
export function roundBill(subtotal: number, cost: number) {
  if (![subtotal, cost].every((n) => Number.isSafeInteger(n) && n >= 0))
    throw new DomainError('Invalid bill amount.')
  if (subtotal < cost) throw new DomainError('A sale cannot be completed below purchase cost.')
  const floor = Math.floor(subtotal / 1000) * 1000 // ten rupees = 1,000 paisa
  const skipped = floor < cost
  return { total: skipped ? subtotal : floor, rounding: skipped ? 0 : subtotal - floor, skipped }
}
export function formatMoney(paisa: number) {
  return `Rs. ${new Intl.NumberFormat('en-PK', { minimumFractionDigits: paisa % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 }).format(paisa / 100)}`
}
export function formatDate(value: string, withTime = false) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Karachi',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(new Date(value.length === 10 ? `${value}T12:00:00Z` : value))
}

export const usableUnits = (batch: Batch) => batch.stockUnits - batch.quarantinedUnits
export function parsePercent(value: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim()))
    throw new DomainError('Enter a percentage from 0 to 100, with up to two decimals.')
  const bps = parseMoney(value)
  if (bps > 10000) throw new DomainError('Discount cannot exceed 100%.')
  return bps
}
export const formatPercent = (bps: number) => `${bps / 100}%`
