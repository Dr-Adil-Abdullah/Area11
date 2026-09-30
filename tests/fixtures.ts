import { createSeedState } from '../src/domain/seed'
import { createProduct, receiveStock, addCartItem, completeSale } from '../src/domain/operations'
import { openCashSession } from '../src/domain/cash'
import { type AppState } from '../src/domain/model'
import { legacyV2StateSchema, type LegacyV2State } from '../src/domain/legacy-v2'
import { legacyStateSchema, type LegacyState } from '../src/domain/legacy-v1'

export const day = '2026-09-30'
export const opened = '2026-09-30T08:00:00.000Z'
export const soldAt = '2026-09-30T09:00:00.000Z'
export const returnAt = '2026-09-30T10:00:00.000Z'
export const linkedAt = '2026-09-30T11:00:00.000Z'
export function stockFixture(cost = 500, price = 700, opening = 100000) {
  let state = openCashSession(createSeedState(day), opening, 'Sample operator', 'owner', opened)
  state = createProduct(
    state,
    {
      name: 'Phase 2 test medicine',
      description: '',
      category: 'Tablets',
      baseUnit: 'tablet',
      unitsPerStrip: 10,
      stripsPerBox: 2,
      barcodes: { box: 'PH2-BOX', strip: 'PH2-STRIP', loose: 'PH2-LOOSE' },
    },
    'owner',
  )
  const product = state.products.at(-1)!
  state = receiveStock(
    state,
    {
      supplier: 'Phase 2 sample supplier',
      reference: 'SAMPLE',
      lines: [
        {
          productId: product.id,
          unit: 'box',
          quantity: 5,
          batchNumber: 'PH2-LOT',
          expiresOn: '2027-09-30',
          costPerBase: cost,
          pricePerBase: price,
        },
      ],
    },
    'owner',
    opened,
  )
  return { state, product, batch: state.batches.at(-1)! }
}
export function soldFixture(cost = 500, price = 700, opening = 100000) {
  const f = stockFixture(cost, price, opening)
  const state = completeSale(
    addCartItem(f.state, f.product.id, f.batch.id, 'strip', 1, day),
    100000,
    'owner',
    day,
    soldAt,
  )
  return { ...f, state, sale: state.sales.at(-1)! }
}
/** Reconstruct the actual V1 shape, not a V2 snapshot with a forged version label. */
export function toLegacy(s: AppState): LegacyState {
  return legacyStateSchema.parse({
    schemaVersion: 1,
    revision: s.revision,
    nextPurchaseNumber: s.nextPurchaseNumber,
    nextSaleNumber: s.nextSaleNumber,
    products: s.products.map(({ reorder: _r, ...p }) => p),
    purchases: s.purchases.map(
      ({ supplierId: _s, ledgerTreatment: _t, ledgerOrder: _o, ...p }) => ({
        ...p,
        lines: p.lines.map(({ stockKind: _k, ...l }) => l),
      }),
    ),
    batches: s.batches.map(({ quarantinedUnits: _q, ...b }) => b),
    cart: s.cart,
    parkedCarts: s.parkedCarts.map(({ discountBps: _d, discountMode: _m, phone: _p, ...c }) => c),
    sales: s.sales.map(
      ({
        grossSubtotal: _g,
        discount: _d,
        discountBps: _b,
        discountMode: _m,
        customerPhone: _p,
        cashSessionId: _s,
        legacy: _l,
        ...sale
      }) => ({
        ...sale,
        lines: sale.lines.map(({ retailTotal: _r, discount: _d, ...line }) => line),
      }),
    ),
    settings: {
      name: s.settings.name,
      address: s.settings.address,
      phone: s.settings.phone,
      footer: s.settings.footer,
      paperWidth: s.settings.paperWidth,
    },
  })
}

export function toV2(s: AppState): LegacyV2State {
  return legacyV2StateSchema.parse({
    schemaVersion: 2,
    revision: s.revision,
    nextPurchaseNumber: s.nextPurchaseNumber,
    nextSaleNumber: s.nextSaleNumber,
    nextReturnNumber: s.nextReturnNumber,
    nextProvisionalNumber: s.nextProvisionalNumber,
    nextCashSessionNumber: s.nextCashSessionNumber,
    nextExpenseNumber: s.nextExpenseNumber,
    nextOwnerEntryNumber: s.nextOwnerEntryNumber,
    products: s.products.map(({ reorder: _r, ...p }) => p),
    purchases: s.purchases.map(
      ({ supplierId: _s, ledgerTreatment: _t, ledgerOrder: _o, ...p }) => ({
        ...p,
        lines: p.lines.map(({ stockKind: _k, ...l }) => l),
      }),
    ),
    batches: s.batches,
    sales: s.sales,
    cart: s.cart,
    parkedCarts: s.parkedCarts,
    settings: {
      name: s.settings.name,
      address: s.settings.address,
      phone: s.settings.phone,
      footer: s.settings.footer,
      paperWidth: s.settings.paperWidth,
      discountMode: s.settings.discountMode,
      cashierMaxDiscountBps: s.settings.cashierMaxDiscountBps,
    },
    cartDiscountMode: s.cartDiscountMode,
    cartDiscountBps: s.cartDiscountBps,
    cartPhone: s.cartPhone,
    salesReturns: s.salesReturns,
    provisionalReturns: s.provisionalReturns,
    cashSessions: s.cashSessions,
    cashEntries: s.cashEntries,
    expenses: s.expenses,
    ownerEntries: s.ownerEntries,
  })
}
