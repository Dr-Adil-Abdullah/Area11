import { stateSchema, type AppState, uid, defaultReorder, DEFAULT_EXPIRY } from '../domain/model'
import { legacyV2StateSchema, type LegacyV2State } from '../domain/legacy-v2'
import { legacyStateSchema } from '../domain/legacy-v1'

export const MIGRATION_BACKUP_KEY = 'area11.migration.phase1.original.v1'
export const PHASE2_BACKUP_KEY = 'area11.migration.phase2.original.v2'
export function decodeSnapshot(raw: string): {
  state: AppState
  migrated: boolean
  backupKey: string | null
} {
  const value: unknown = JSON.parse(raw)
  if (typeof value !== 'object' || value === null) throw new Error('Invalid saved workspace.')
  if ('schemaVersion' in value && value.schemaVersion === 1) {
    const old = legacyStateSchema.parse(value)
    const intermediate = legacyV2StateSchema.parse({
      ...old,
      schemaVersion: 2,
      revision: old.revision,
      settings: { ...old.settings, discountMode: 'margin', cashierMaxDiscountBps: 1000 },
      batches: old.batches.map((b) => ({ ...b, quarantinedUnits: 0 })),
      sales: old.sales.map((sale) => ({
        ...sale,
        grossSubtotal: sale.subtotal,
        discount: 0,
        discountBps: 0,
        discountMode: 'margin',
        customerPhone: '',
        cashSessionId: null,
        legacy: true,
        lines: sale.lines.map((line) => ({ ...line, retailTotal: line.total, discount: 0 })),
      })),
      parkedCarts: old.parkedCarts.map((cart) => ({
        ...cart,
        discountMode: 'margin',
        discountBps: 0,
        phone: '',
      })),
      cartDiscountMode: 'margin',
      cartDiscountBps: 0,
      cartPhone: '',
      nextReturnNumber: 1,
      nextProvisionalNumber: 1,
      nextCashSessionNumber: 1,
      nextExpenseNumber: 1,
      nextOwnerEntryNumber: 1,
      salesReturns: [],
      provisionalReturns: [],
      cashSessions: [],
      cashEntries: [],
      expenses: [],
      ownerEntries: [],
    })
    return { state: upgradeV2(intermediate), migrated: true, backupKey: MIGRATION_BACKUP_KEY }
  }
  if ('schemaVersion' in value && value.schemaVersion === 2)
    return {
      state: upgradeV2(legacyV2StateSchema.parse(value)),
      migrated: true,
      backupKey: PHASE2_BACKUP_KEY,
    }
  return { state: stateSchema.parse(value), migrated: false, backupKey: null }
}

function upgradeV2(old: LegacyV2State): AppState {
  const names = new Map<string, string>()
  for (const purchase of old.purchases)
    if (!names.has(purchase.supplier.trim().toLowerCase()))
      names.set(purchase.supplier.trim().toLowerCase(), purchase.supplier)
  const suppliers = [...names.entries()].map(([key, name]) => ({
    id: uid(),
    name,
    agency: '',
    phone: '',
    address: '',
    source: 'legacy' as const,
    createdAt: old.purchases
      .filter((p) => p.supplier.trim().toLowerCase() === key)
      .map((p) => p.createdAt)
      .sort()[0],
    openingBalance: 0,
    openingConfirmed: false,
    openingConfirmedAt: null,
    openingConfirmedBy: null,
    openingNote:
      'Historical purchase payments were not recorded in Phase 1/2. Verify the current supplier statement before cash settlement.',
  }))
  const purchases = old.purchases.map((p) => ({
    ...p,
    supplierId: suppliers.find(
      (v) => v.name.trim().toLowerCase() === p.supplier.trim().toLowerCase(),
    )!.id,
    ledgerTreatment: 'legacy-reference' as const,
    ledgerOrder: null,
    lines: p.lines.map((l) => ({ ...l, stockKind: 'standard' as const })),
  }))
  const products = old.products.map((p) => {
    const vendorIds = [
      ...new Set(
        purchases
          .filter((purchase) => purchase.lines.some((l) => l.productId === p.id))
          .map((purchase) => purchase.supplierId),
      ),
    ]
    return {
      ...p,
      reorder: {
        ...defaultReorder(p),
        preferredSupplierId: vendorIds.length === 1 ? vendorIds[0] : null,
      },
    }
  })
  return stateSchema.parse({
    ...old,
    schemaVersion: 3,
    revision: old.revision + 1,
    products,
    purchases,
    settings: { ...old.settings, expiry: { ...DEFAULT_EXPIRY } },
    suppliers,
    supplierReturns: [],
    supplierSettlements: [],
    nextSupplierReturnNumber: 1,
    nextSupplierSettlementNumber: 1,
    nextSupplierLedgerOrder: 1,
  })
}
