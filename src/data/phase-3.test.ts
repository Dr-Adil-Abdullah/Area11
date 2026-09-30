import { describe, expect, it } from 'vitest'
import { DemoStore, STORAGE_KEY } from './repository'
import { decodeSnapshot, MIGRATION_BACKUP_KEY, PHASE2_BACKUP_KEY } from './migrations'
import { type AppState, stateSchema } from '../domain/model'
import { legacyV2StateSchema } from '../domain/legacy-v2'
import { createSeedState } from '../domain/seed'
import {
  addCartItem,
  parkCart,
  setCartPhone,
  setCartDiscount,
  receiveStock,
  saveSettings,
} from '../domain/operations'
import { recordSalesReturn } from '../domain/returns'
import { recordExpense, recordOwnerMedicine } from '../domain/accounts'
import {
  createSupplier,
  editSupplier,
  confirmSupplierBalance,
  recordSupplierReturn,
  recordSupplierSettlement,
  saveReorderPolicy,
  supplierBalance,
} from '../domain/suppliers'
import {
  day,
  soldAt,
  returnAt,
  linkedAt,
  soldFixture,
  stockFixture,
  toV2,
} from '../../tests/fixtures'

class MemoryStorage {
  data = new Map<string, string>()
  failKey = ''
  getItem(key: string) {
    return this.data.get(key) ?? null
  }
  setItem(key: string, value: string) {
    if (this.failKey === key) throw new Error('Quota')
    this.data.set(key, value)
  }
}
const seed = () => createSeedState(day)
function populatedV2() {
  const f = soldFixture()
  let s = recordSalesReturn(
    f.state,
    {
      saleId: f.sale.id,
      reason: 'Customer change',
      notes: 'Verified returned sample units',
      confirmed: true,
      lines: [{ saleLineIndex: 0, baseQuantity: 2, disposition: 'quarantine' }],
    },
    'cashier',
    returnAt,
  )
  s = recordExpense(
    s,
    { amount: 1000, kind: 'daily', category: 'Test supplies', notes: 'Sample expense' },
    'owner',
    returnAt,
  )
  s = recordOwnerMedicine(s, f.batch.id, 1, 'Sample owner use', 'owner', returnAt)
  s = setCartPhone(
    setCartDiscount(
      addCartItem(s, f.product.id, f.batch.id, 'loose', 2, day),
      1000,
      'manager',
      day,
    ),
    '03001234567',
  )
  s = parkCart(s, 'Phase 2 held customer', linkedAt)
  s = addCartItem(s, f.product.id, f.batch.id, 'strip', 1, day)
  return toV2({ ...s, revision: 39 })
}

describe('genuine Phase 2 → Phase 3 upgrade', () => {
  it('backs up the exact V2 bytes before upgrading and preserves every previous-version field and counter', () => {
    const old = populatedV2()
    const raw = JSON.stringify(old, null, '\t')
    const storage = new MemoryStorage()
    storage.setItem(STORAGE_KEY, raw)
    const store = new DemoStore(storage, seed)
    const current = store.getSnapshot().state
    expect(store.getSnapshot().issue).toBeNull()
    expect(storage.getItem(PHASE2_BACKUP_KEY)).toBe(raw)
    expect(toV2(current)).toEqual({ ...old, revision: 40 })
    expect(current.schemaVersion).toBe(3)
    expect(current.supplierReturns).toEqual([])
    expect(current.supplierSettlements).toEqual([])
    expect(current.nextSupplierLedgerOrder).toBe(1)
    expect(current.suppliers.every((s) => !s.openingConfirmed)).toBe(true)
    expect(
      current.purchases.every(
        (p) => p.ledgerTreatment === 'legacy-reference' && p.ledgerOrder === null,
      ),
    ).toBe(true)
    expect(current.parkedCarts[0]).toMatchObject({ phone: '03001234567', discountBps: 1000 })
    expect(() => supplierBalance(current, current.suppliers[0].id)).toThrow(/carried-forward/)
    expect(stateSchema.safeParse(current).success).toBe(true)
  })
  it('does not rerun migration or overwrite either original snapshot on reload or explicit Owner reset', () => {
    const storage = new MemoryStorage()
    storage.setItem(MIGRATION_BACKUP_KEY, 'Exact older V1 backup')
    const raw = JSON.stringify(populatedV2())
    storage.setItem(STORAGE_KEY, raw)
    const first = new DemoStore(storage, seed)
    const second = new DemoStore(storage, seed)
    expect(second.getSnapshot()).toEqual(first.getSnapshot())
    second.reset('owner')
    expect(storage.getItem(MIGRATION_BACKUP_KEY)).toBe('Exact older V1 backup')
    expect(storage.getItem(PHASE2_BACKUP_KEY)).toBe(raw)
  })
  it.each([PHASE2_BACKUP_KEY, STORAGE_KEY])(
    'pauses rather than discarding V2 when %s cannot be saved; retry preserves bytes',
    (failKey) => {
      const raw = JSON.stringify(populatedV2(), null, 2)
      const storage = new MemoryStorage()
      storage.setItem(STORAGE_KEY, raw)
      storage.failKey = failKey
      const store = new DemoStore(storage, seed)
      expect(store.getSnapshot().issue).not.toBeNull()
      expect(storage.getItem(STORAGE_KEY)).toBe(raw)
      expect(() => store.commit((s) => s)).toThrow(/paused/)
      storage.failKey = ''
      const retry = new DemoStore(storage, seed)
      expect(retry.getSnapshot().issue).toBeNull()
      expect(storage.getItem(PHASE2_BACKUP_KEY)).toBe(raw)
      expect(toV2(retry.getSnapshot().state)).toEqual({ ...populatedFrom(raw), revision: 40 })
    },
  )
  it('refuses to replace a different original V2 backup', () => {
    const storage = new MemoryStorage()
    const raw = JSON.stringify(populatedV2())
    storage.setItem(STORAGE_KEY, raw)
    storage.setItem(PHASE2_BACKUP_KEY, 'Do not overwrite this earlier original')
    const store = new DemoStore(storage, seed)
    expect(store.getSnapshot().issue).not.toBeNull()
    expect(storage.getItem(PHASE2_BACKUP_KEY)).toBe('Do not overwrite this earlier original')
    expect(storage.getItem(STORAGE_KEY)).toBe(raw)
  })
  it('accepts an identical original V2 backup left by an interrupted primary save', () => {
    const storage = new MemoryStorage()
    const raw = JSON.stringify(populatedV2())
    storage.setItem(STORAGE_KEY, raw)
    storage.setItem(PHASE2_BACKUP_KEY, raw)
    const store = new DemoStore(storage, seed)
    expect(store.getSnapshot().issue).toBeNull()
    expect(storage.getItem(PHASE2_BACKUP_KEY)).toBe(raw)
  })
  it('deduplicates case/space variants of historical suppliers without rewriting historical headers', () => {
    const old = toV2(stockFixture().state)
    old.purchases.at(-1)!.supplier = `  ${old.purchases[0].supplier.toUpperCase()}  `
    const s = decodeSnapshot(JSON.stringify(old)).state
    expect(s.suppliers).toHaveLength(2)
    expect(s.purchases.at(-1)!.supplierId).toBe(s.purchases[0].supplierId)
    expect(toV2(s).purchases).toEqual(legacyV2StateSchema.parse(old).purchases)
    expect(s.purchases.at(-1)!.supplier).toBe(old.purchases.at(-1)!.supplier.trim())
    expect(s.cashEntries).toEqual(old.cashEntries)
  })
  it.each(['root-extra', 'nested-extra', 'false-version', 'wrong-stock'] as const)(
    'rejects corrupted/forged V2 before writing any backup (%s)',
    (damage) => {
      const old = populatedV2()
      let bad: unknown = old
      if (damage === 'root-extra') bad = { ...old, suppliers: [] }
      if (damage === 'nested-extra')
        bad = {
          ...old,
          products: old.products.map((p) => ({ ...p, reorder: { criticalUnits: 1 } })),
        }
      if (damage === 'false-version') bad = { ...soldFixture().state, schemaVersion: 2 }
      if (damage === 'wrong-stock') old.batches.at(-1)!.quarantinedUnits += 1
      const raw = JSON.stringify(bad)
      const storage = new MemoryStorage()
      storage.setItem(STORAGE_KEY, raw)
      const store = new DemoStore(storage, seed)
      expect(store.getSnapshot().issue).not.toBeNull()
      expect(storage.getItem(PHASE2_BACKUP_KEY)).toBeNull()
      expect(storage.getItem(STORAGE_KEY)).toBe(raw)
    },
  )
})
function populatedFrom(raw: string) {
  return JSON.parse(raw)
}

describe('Phase 3 persist-before-publish atomicity', () => {
  it.each([
    'profile',
    'contacts',
    'delivery',
    'bonus',
    'credit',
    'payment',
    'policy',
    'expiry',
    'statement',
  ] as const)('does not publish partial %s changes when browser storage fails', (command) => {
    const f = stockFixture()
    const initial =
      command === 'statement' ? decodeSnapshot(JSON.stringify(toV2(f.state))).state : f.state
    const storage = new MemoryStorage()
    const store = new DemoStore(storage, () => initial)
    const supplierId = initial.purchases.at(-1)!.supplierId
    const transforms: Record<typeof command, (s: AppState) => AppState> = {
      profile: (s) =>
        createSupplier(
          s,
          {
            name: 'Atomic supplier',
            agency: '',
            phone: '',
            address: '',
            openingBalance: 0,
            openingNote: 'Test confirmed zero',
            confirmed: true,
          },
          'owner',
          soldAt,
        ),
      contacts: (s) =>
        editSupplier(
          s,
          supplierId,
          { name: 'Atomic rename', agency: '', phone: '', address: '' },
          'manager',
        ),
      delivery: (s) =>
        receiveStock(
          s,
          {
            supplierId,
            supplier: '',
            reference: '',
            lines: [
              {
                productId: f.product.id,
                unit: 'box',
                quantity: 1,
                batchNumber: 'ATOMIC-PAID',
                expiresOn: '2028-09-30',
                costPerBase: 500,
                pricePerBase: 700,
              },
            ],
          },
          'owner',
          soldAt,
        ),
      bonus: (s) =>
        receiveStock(
          s,
          {
            supplierId,
            supplier: '',
            reference: '',
            lines: [
              {
                productId: f.product.id,
                unit: 'box',
                quantity: 1,
                batchNumber: 'ATOMIC-BONUS',
                expiresOn: '2028-09-30',
                costPerBase: 0,
                pricePerBase: 700,
                stockKind: 'bonus',
              },
            ],
          },
          'owner',
          soldAt,
        ),
      credit: (s) =>
        recordSupplierReturn(
          s,
          {
            supplierId,
            reason: 'Damaged',
            creditReference: 'ATOMIC-CREDIT',
            notes: '',
            confirmed: true,
            requestId: 'atomic-credit-request',
            lines: [{ batchId: f.batch.id, shelfUnits: 3, quarantinedUnits: 0 }],
          },
          'manager',
          soldAt,
        ),
      payment: (s) =>
        recordSupplierSettlement(
          s,
          {
            supplierId,
            kind: 'payment',
            amount: 10000,
            reference: 'ATOMIC-PAY',
            notes: '',
            confirmed: true,
            requestId: 'atomic-pay-request',
          },
          'owner',
          soldAt,
        ),
      policy: (s) =>
        saveReorderPolicy(
          s,
          f.product.id,
          { criticalUnits: 5, warningUnits: 10, targetUnits: 30, preferredSupplierId: supplierId },
          'manager',
        ),
      expiry: (s) =>
        saveSettings(s, { ...s.settings, expiry: { ...s.settings.expiry, farDays: 300 } }, 'owner'),
      statement: (s) =>
        confirmSupplierBalance(
          s,
          supplierId,
          20000,
          'Current sample statement checked',
          'manager',
          soldAt,
          true,
        ),
    }
    const before = store.getSnapshot()
    const raw = storage.getItem(STORAGE_KEY)
    let published = 0
    store.subscribe(() => published++)
    storage.failKey = STORAGE_KEY
    expect(() => store.commit(transforms[command])).toThrow(/Nothing was changed/)
    expect(store.getSnapshot()).toBe(before)
    expect(storage.getItem(STORAGE_KEY)).toBe(raw)
    expect(published).toBe(0)
    storage.failKey = ''
    const next = store.commit(transforms[command])
    expect(next.revision).toBe(before.state.revision + 1)
    expect(published).toBe(1)
    expect(new DemoStore(storage, seed).getSnapshot().state).toEqual(next)
  })
})
