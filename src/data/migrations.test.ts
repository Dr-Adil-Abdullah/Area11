import { describe, expect, it } from 'vitest'
import { DemoStore, STORAGE_KEY } from './repository'
import { decodeSnapshot, MIGRATION_BACKUP_KEY } from './migrations'
import { stateSchema } from '../domain/model'
import { createSeedState } from '../domain/seed'
import {
  addCartItem,
  parkCart,
  resumeCart,
  completeSale,
  sortedBatches,
} from '../domain/operations'
import { openCashSession, handoverCashSession } from '../domain/cash'
import {
  recordSalesReturn,
  recordProvisionalReturn,
  linkProvisionalReturn,
  type ReturnInput,
} from '../domain/returns'
import { recordExpense, recordOwnerCash, recordOwnerMedicine } from '../domain/accounts'
import {
  day,
  soldAt,
  returnAt,
  linkedAt,
  soldFixture,
  stockFixture,
  toLegacy,
} from '../../tests/fixtures'

class MemoryStorage {
  data = new Map<string, string>()
  failKey = ''
  getItem(key: string) {
    return this.data.get(key) ?? null
  }
  setItem(key: string, value: string) {
    if (this.failKey === key || this.failKey === '*') throw new Error('Quota')
    this.data.set(key, value)
  }
}
const seed = () => createSeedState(day)
const input = (saleId: string): ReturnInput => ({
  saleId,
  lines: [{ saleLineIndex: 0, baseQuantity: 2, disposition: 'quarantine' }],
  reason: 'Customer change',
  notes: '',
  confirmed: true,
})
const provisionalInput = (productId: string) => ({
  items: [{ productId, baseQuantity: 2 }],
  refundPaid: 1600,
  phone: '03001234567',
  reason: 'Customer change' as const,
  notes: 'Sample bill missing',
  confirmed: true,
})

describe('V1 → current migration without erasing phase 1', () => {
  it('backs up the exact original JSON, preserving stock, sequences, sale snapshots and held batches', () => {
    const f = soldFixture()
    let state = addCartItem(f.state, f.product.id, f.batch.id, 'strip', 1, day)
    state = parkCart(state, 'Legacy held customer', returnAt)
    state = addCartItem(state, f.product.id, f.batch.id, 'loose', 1, day)
    const old = toLegacy({ ...state, revision: 41 })
    const raw = JSON.stringify(old, null, 2)
    const storage = new MemoryStorage()
    storage.setItem(STORAGE_KEY, raw)
    const store = new DemoStore(storage, seed)
    const { state: upgraded, issue } = store.getSnapshot()
    expect(issue).toBeNull()
    expect(storage.getItem(MIGRATION_BACKUP_KEY)).toBe(raw)
    expect(upgraded).toMatchObject({
      schemaVersion: 3,
      revision: 42,
      nextSaleNumber: old.nextSaleNumber,
      nextPurchaseNumber: old.nextPurchaseNumber,
    })
    expect(toLegacy(upgraded).products).toEqual(old.products)
    expect(toLegacy(upgraded).purchases).toEqual(old.purchases)
    expect(upgraded.cart).toEqual(old.cart)
    expect(upgraded.batches.map(({ quarantinedUnits: _q, ...batch }) => batch)).toEqual(old.batches)
    expect(toLegacy(upgraded)).toEqual({ ...old, revision: 42 })
    expect(upgraded.sales[0]).toMatchObject({
      legacy: true,
      cashSessionId: null,
      customerPhone: '',
      discount: 0,
    })
    expect(upgraded.cashEntries).toEqual([])
    expect(upgraded.cashSessions).toEqual([])
    const cleared = { ...upgraded, cart: [] }
    const resumed = resumeCart(cleared, upgraded.parkedCarts[0].id)
    expect(resumed.cart[0].batchId).toBe(old.parkedCarts[0].lines[0].batchId)
    expect(stateSchema.safeParse(upgraded).success).toBe(true)
  })
  it('does not rerun migration or replace the original backup on reload or Owner reset', () => {
    const old = toLegacy(soldFixture().state)
    const storage = new MemoryStorage()
    storage.setItem(STORAGE_KEY, JSON.stringify(old))
    const first = new DemoStore(storage, seed)
    const backup = storage.getItem(MIGRATION_BACKUP_KEY)
    const second = new DemoStore(storage, seed)
    expect(second.getSnapshot()).toEqual(first.getSnapshot())
    second.reset('owner')
    expect(storage.getItem(MIGRATION_BACKUP_KEY)).toBe(backup)
    expect(second.getSnapshot().state.schemaVersion).toBe(3)
  })
  it.each([MIGRATION_BACKUP_KEY, STORAGE_KEY])(
    'pauses on %s write failure, preserving original data for retry',
    (failedKey) => {
      const storage = new MemoryStorage()
      const raw = JSON.stringify(toLegacy(soldFixture().state))
      storage.setItem(STORAGE_KEY, raw)
      storage.failKey = failedKey
      const store = new DemoStore(storage, seed)
      expect(store.getSnapshot().issue).not.toBeNull()
      expect(storage.getItem(STORAGE_KEY)).toBe(raw)
      expect(() => store.commit((s) => s)).toThrow(/paused/)
      storage.failKey = ''
      const recovered = new DemoStore(storage, seed)
      expect(recovered.getSnapshot().issue).toBeNull()
      expect(storage.getItem(MIGRATION_BACKUP_KEY)).toBe(raw)
      expect(recovered.getSnapshot().state.schemaVersion).toBe(3)
    },
  )
  it('does not strip V2 records when the root version is falsely changed to V1', () => {
    const state = soldFixture().state
    expect(() => decodeSnapshot(JSON.stringify({ ...state, schemaVersion: 1 }))).toThrow()
    const nested = toLegacy(state)
    const bad = { ...nested, batches: nested.batches.map((b) => ({ ...b, quarantinedUnits: 0 })) }
    expect(() => decodeSnapshot(JSON.stringify(bad))).toThrow()
  })
  it('never writes a backup or new snapshot when genuine V1 data fails validation', () => {
    const storage = new MemoryStorage()
    const old = toLegacy(soldFixture().state)
    old.sales[0].total++
    const raw = JSON.stringify(old)
    storage.setItem(STORAGE_KEY, raw)
    const store = new DemoStore(storage, seed)
    expect(store.getSnapshot().issue).not.toBeNull()
    expect(storage.getItem(STORAGE_KEY)).toBe(raw)
    expect(storage.getItem(MIGRATION_BACKUP_KEY)).toBeNull()
  })
  it('refuses to overwrite a different existing original backup', () => {
    const storage = new MemoryStorage()
    const raw = JSON.stringify(toLegacy(soldFixture().state))
    storage.setItem(STORAGE_KEY, raw)
    storage.setItem(MIGRATION_BACKUP_KEY, 'existing original snapshot')
    const store = new DemoStore(storage, seed)
    expect(store.getSnapshot().issue).not.toBeNull()
    expect(storage.getItem(STORAGE_KEY)).toBe(raw)
    expect(storage.getItem(MIGRATION_BACKUP_KEY)).toBe('existing original snapshot')
  })
  it('requires a real opening float after migration; old sales never become new cash movements', () => {
    const decoded = decodeSnapshot(JSON.stringify(toLegacy(soldFixture().state))).state
    const p = decoded.products[0],
      b = sortedBatches(decoded, p.id, day, true)[0]
    const cart = addCartItem({ ...decoded, cart: [] }, p.id, b.id, 'loose', 1, day)
    expect(() => completeSale(cart, 100000, 'owner', day, linkedAt)).toThrow(/Open a cash shift/)
    const opened = openCashSession(cart, 50000, 'Sample migrated operator', 'owner', returnAt)
    const sold = completeSale(opened, 100000, 'owner', day, linkedAt)
    expect(sold.cashEntries).toHaveLength(1)
    expect(sold.cashEntries[0].refId).toBe(sold.sales[1].id)
    expect(sold.sales[0].legacy).toBe(true)
    expect(stateSchema.safeParse(sold).success).toBe(true)
  })
})

describe('atomic cash / stock / accounts persistence', () => {
  it('failed direct refund persistence changes neither cash, quantities, records nor sequence', () => {
    const f = soldFixture()
    const storage = new MemoryStorage()
    const store = new DemoStore(storage, () => f.state)
    const before = store.getSnapshot(),
      raw = storage.getItem(STORAGE_KEY)
    storage.failKey = '*'
    expect(() =>
      store.commit((s) => recordSalesReturn(s, input(f.sale.id), 'manager', returnAt)),
    ).toThrow(/Nothing was changed/)
    expect(store.getSnapshot()).toBe(before)
    expect(storage.getItem(STORAGE_KEY)).toBe(raw)
    expect(before.state.salesReturns).toHaveLength(0)
    expect(before.state.nextReturnNumber).toBe(1)
  })
  it('failed provisional persistence does not pay, hold goods, create alerts or advance its number', () => {
    const f = soldFixture(),
      storage = new MemoryStorage()
    const store = new DemoStore(storage, () => f.state)
    const before = store.getSnapshot()
    storage.failKey = '*'
    expect(() =>
      store.commit((s) =>
        recordProvisionalReturn(s, provisionalInput(f.product.id), 'cashier', returnAt),
      ),
    ).toThrow(/Nothing was changed/)
    expect(store.getSnapshot()).toBe(before)
    expect(before.state.provisionalReturns).toEqual([])
    expect(before.state.nextProvisionalNumber).toBe(1)
  })
  it('failed link/expense persistence keeps the pending alert and all source records intact', () => {
    const f = soldFixture(),
      storage = new MemoryStorage()
    const state = recordProvisionalReturn(
      f.state,
      provisionalInput(f.product.id),
      'cashier',
      returnAt,
    )
    const store = new DemoStore(storage, () => state)
    const before = store.getSnapshot()
    storage.failKey = '*'
    expect(() =>
      store.commit((s) =>
        linkProvisionalReturn(
          s,
          state.provisionalReturns[0].id,
          input(f.sale.id),
          'expense',
          'owner',
          linkedAt,
        ),
      ),
    ).toThrow(/Nothing was changed/)
    expect(store.getSnapshot()).toBe(before)
    expect(before.state.provisionalReturns[0].linkedReturnId).toBeNull()
    expect(before.state.salesReturns).toHaveLength(0)
    expect(before.state.expenses).toHaveLength(0)
  })
  it('failed handover does not close the old shift or create a new one', () => {
    const f = soldFixture(),
      storage = new MemoryStorage()
    const store = new DemoStore(storage, () => f.state)
    const before = store.getSnapshot()
    storage.failKey = '*'
    expect(() =>
      store.commit((s) =>
        handoverCashSession(s, 106000, 'Sample shortage', 'Next operator', 'cashier', returnAt),
      ),
    ).toThrow(/Nothing was changed/)
    expect(store.getSnapshot()).toBe(before)
    expect(before.state.cashSessions[0].status).toBe('open')
    expect(before.state.cashSessions).toHaveLength(1)
  })
  it.each(['expense', 'owner-cash', 'owner-medicine'] as const)(
    '%s is not published if storage fails',
    (kind) => {
      const f = stockFixture(),
        storage = new MemoryStorage()
      const store = new DemoStore(storage, () => f.state),
        before = store.getSnapshot()
      storage.failKey = '*'
      const change =
        kind === 'expense'
          ? (s: typeof f.state) =>
              recordExpense(
                s,
                { amount: 500, category: 'Tea', kind: 'daily', notes: '' },
                'manager',
                soldAt,
              )
          : kind === 'owner-cash'
            ? (s: typeof f.state) =>
                recordOwnerCash(s, 'cash-withdrawal', 500, 'Sample draw', 'owner', soldAt)
            : (s: typeof f.state) =>
                recordOwnerMedicine(s, f.batch.id, 1, 'Sample medicine use', 'owner', soldAt)
      expect(() => store.commit(change)).toThrow(/Nothing was changed/)
      expect(store.getSnapshot()).toBe(before)
    },
  )
  it('rejects corrupt financial mutations before attempting persistence', () => {
    const f = soldFixture(),
      storage = new MemoryStorage()
    const store = new DemoStore(storage, () => f.state),
      before = store.getSnapshot(),
      raw = storage.getItem(STORAGE_KEY)
    expect(() =>
      store.commit((s) => ({
        ...s,
        cashEntries: s.cashEntries.map((e) => ({ ...e, amount: e.amount + 1 })),
      })),
    ).toThrow(/cash movement disagree/)
    expect(store.getSnapshot()).toBe(before)
    expect(storage.getItem(STORAGE_KEY)).toBe(raw)
  })
})
