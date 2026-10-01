import {
  type AppState,
  type Batch,
  type Role,
  type Product,
  daysUntil,
  DomainError,
  safeSum,
  businessDate,
} from './model'
import { saleableStock } from './operations'
import { getSupplier, requireManagement } from './suppliers'
import { normalizePhone } from './returns'

export type ExpiryLevel = 'far' | 'middle' | 'near' | 'expired'
export function expiryLevel(
  batch: Batch,
  today: string,
  policy: AppState['settings']['expiry'],
): ExpiryLevel | null {
  const days = daysUntil(batch.expiresOn, today)
  if (days < 0) return 'expired'
  if (days <= policy.nearDays) return 'near'
  if (days <= policy.middleDays) return 'middle'
  if (days <= policy.farDays) return 'far'
  return null
}
export const expiryColor = (level: ExpiryLevel, policy: AppState['settings']['expiry']) =>
  level === 'expired' ? '#ad3542' : policy[`${level}Color`]
export function expiryLots(state: AppState, today: string, level: ExpiryLevel, supplierId = '') {
  return state.batches
    .filter(
      (b) =>
        b.stockUnits > 0 &&
        expiryLevel(b, today, state.settings.expiry) === level &&
        (!supplierId ||
          state.purchases.some((p) => p.id === b.purchaseId && p.supplierId === supplierId)),
    )
    .sort(
      (a, b) =>
        a.expiresOn.localeCompare(b.expiresOn) ||
        a.receivedAt.localeCompare(b.receivedAt) ||
        a.id.localeCompare(b.id),
    )
}
export type ReorderLevel = 'warning' | 'critical' | 'out' | null
export function reorderLevel(product: Product, available: number): ReorderLevel {
  return available <= 0
    ? 'out'
    : available <= product.reorder.criticalUnits
      ? 'critical'
      : available <= product.reorder.warningUnits
        ? 'warning'
        : null
}
export function productSuppliers(state: AppState, productId: string): string[] {
  const preferred = state.products.find((p) => p.id === productId)?.reorder.preferredSupplierId
  return preferred
    ? [preferred]
    : [
        ...new Set(
          state.purchases
            .filter((p) => p.lines.some((l) => l.productId === productId))
            .map((p) => p.supplierId),
        ),
      ]
}
export function reorderRows(state: AppState, today: string, supplierId = '') {
  return state.products
    .map((product) => {
      const available = saleableStock(state, product.id, today)
      return {
        product,
        available,
        level: reorderLevel(product, available),
        suggested: Math.max(0, product.reorder.targetUnits - available),
        supplierIds: productSuppliers(state, product.id),
      }
    })
    .filter((r) => r.level && (!supplierId || r.supplierIds.includes(supplierId)))
    .sort(
      (a, b) =>
        ({ out: 0, critical: 1, warning: 2 })[a.level!] -
          { out: 0, critical: 1, warning: 2 }[b.level!] ||
        a.product.name.localeCompare(b.product.name),
    )
}
export interface OrderLine {
  productId: string
  baseQuantity: number
}
export function buildPurchaseOrder(
  state: AppState,
  supplierId: string,
  lines: OrderLine[],
  role: Role,
  today = businessDate(),
) {
  requireManagement(role)
  const supplier = getSupplier(state, supplierId)
  if (!lines.length || new Set(lines.map((l) => l.productId)).size !== lines.length)
    throw new DomainError('Choose distinct products and at least one order quantity.')
  const rows = lines.map((line) => {
    const product = state.products.find((p) => p.id === line.productId)
    if (
      !product ||
      !productSuppliers(state, product.id).includes(supplierId) ||
      !Number.isSafeInteger(line.baseQuantity) ||
      line.baseQuantity <= 0 ||
      line.baseQuantity > 1_000_000_000_000
    )
      throw new DomainError(
        'Every ordered product must be assigned to this supplier with a positive whole base-unit quantity.',
      )
    return `${product.name}: ${line.baseQuantity.toLocaleString('en-PK')} ${product.baseUnit === 'ml' ? 'ml' : `${product.baseUnit}${line.baseQuantity === 1 ? '' : 's'}`} (base units)`
  })
  safeSum(lines.map((l) => l.baseQuantity))
  const text = `DEMO PURCHASE REQUEST — please review\n${state.settings.name}\nSupplier: ${supplier.name}\nDate: ${today} (PKT)\n\n${rows.map((row, i) => `${i + 1}. ${row}`).join('\n')}\n\nPlease confirm availability, batch expiry and prices. This request does not receive stock, post a purchase or confirm that a message was sent.`
  if (text.length > 6000)
    throw new DomainError(
      'This order is too long for a WhatsApp link. Split it into smaller requests.',
    )
  const phone = normalizePhone(supplier.phone)
  const phoneValid = /^[1-9]\d{7,14}$/.test(phone)
  return {
    text,
    whatsappWebUrl: phoneValid
      ? `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`
      : null,
  }
}
