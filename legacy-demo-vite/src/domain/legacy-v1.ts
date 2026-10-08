import { z } from 'zod'

export const roles = ['owner', 'manager', 'cashier'] as const
export type Role = (typeof roles)[number]
export const categories = ['Tablets', 'Capsules', 'Liquids', 'Essentials'] as const
export const baseUnits = ['tablet', 'capsule', 'piece', 'ml'] as const
export const packUnits = ['box', 'strip', 'loose'] as const
export type PackUnit = (typeof packUnits)[number]

const id = z.string().min(1).max(100)
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
  })
  .strict()
export type Settings = z.infer<typeof settingsSchema>

const rawStateSchema = z
  .object({
    schemaVersion: z.literal(1),
    revision: count,
    nextPurchaseNumber: z.number().int().positive(),
    nextSaleNumber: z.number().int().positive(),
    products: z.array(productSchema),
    batches: z.array(batchSchema),
    purchases: z.array(purchaseSchema),
    sales: z.array(saleSchema),
    cart: z.array(cartLineSchema),
    parkedCarts: z.array(parkedCartSchema),
    settings: settingsSchema,
  })
  .strict()
export type LegacyState = z.infer<typeof rawStateSchema>

// Validate saved data before using it. Never silently overwrite an unreadable workspace.
export const legacyStateSchema = rawStateSchema.superRefine((s, ctx) => {
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
})

function roundBill(subtotal: number, cost: number) {
  const floor = Math.floor(subtotal / 1000) * 1000
  const skipped = floor < cost
  return { total: skipped ? subtotal : floor, rounding: skipped ? 0 : subtotal - floor, skipped }
}
