import { describe, expect, it } from 'vitest'
import { DemoStore, STORAGE_KEY } from './repository'
import { openCashSession } from '../domain/cash'
import { createSeedState } from '../domain/seed'
import { addCartItem, completeSale, sortedBatches } from '../domain/operations'

const today = '2026-09-30'
class MemoryStorage {
  data = new Map<string, string>()
  failWrites = false
  getItem(key: string) {
    return this.data.get(key) ?? null
  }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new Error('Quota')
    this.data.set(key, value)
  }
}
const seed = () =>
  openCashSession(createSeedState(today), 0, 'Test operator', 'owner', '2026-09-30T00:00:00.000Z')

describe('local demo repository', () => {
  it('restores the workspace and an unfinished cart on reload', () => {
    const storage = new MemoryStorage()
    const store = new DemoStore(storage, seed)
    const state = store.getSnapshot().state
    const p = state.products[0]
    const b = sortedBatches(state, p.id, today, true)[0]
    store.commit((s) => addCartItem(s, p.id, b.id, 'strip', 1, today))
    const reloaded = new DemoStore(storage, seed)
    expect(reloaded.getSnapshot().state).toEqual(store.getSnapshot().state)
    expect(reloaded.getSnapshot().state.cart[0].unit).toBe('strip')
  })
  it('never deducts stock or creates an invoice if persisting a sale fails', () => {
    const storage = new MemoryStorage()
    const store = new DemoStore(storage, seed)
    const { state } = store.getSnapshot()
    const p = state.products[0]
    const b = sortedBatches(state, p.id, today, true)[0]
    store.commit((s) => addCartItem(s, p.id, b.id, 'strip', 1, today))
    const before = store.getSnapshot()
    const persisted = storage.getItem(STORAGE_KEY)
    storage.failWrites = true
    expect(() =>
      store.commit((s) => completeSale(s, 100000, 'owner', today, '2026-09-30T10:00:00.000Z')),
    ).toThrow(/Nothing was changed/)
    expect(store.getSnapshot()).toBe(before)
    expect(storage.getItem(STORAGE_KEY)).toBe(persisted)
    expect(store.getSnapshot().state.sales).toHaveLength(0)
  })
  it('does not silently overwrite corrupt data', () => {
    const storage = new MemoryStorage()
    storage.setItem(STORAGE_KEY, '{bad json')
    const store = new DemoStore(storage, seed)
    expect(store.getSnapshot().issue).not.toBeNull()
    expect(storage.getItem(STORAGE_KEY)).toBe('{bad json')
    expect(() => store.commit((s) => s)).toThrow(/paused/)
    expect(() => store.reset('cashier')).toThrow(/Owner/)
    store.reset('owner')
    expect(store.getSnapshot().issue).toBeNull()
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!).schemaVersion).toBe(3)
  })
  it('refreshes instead of overwriting a newer revision from another tab', () => {
    const storage = new MemoryStorage()
    const first = new DemoStore(storage, seed)
    const second = new DemoStore(storage, seed)
    const s = first.getSnapshot().state
    const b = sortedBatches(s, s.products[0].id, today, true)[0]
    first.commit((state) => addCartItem(state, s.products[0].id, b.id, 'strip', 1, today))
    expect(() => second.commit((state) => ({ ...state, cart: [] }))).toThrow(/another tab/)
    expect(second.getSnapshot().state).toEqual(first.getSnapshot().state)
    expect(second.getSnapshot().state.cart).toHaveLength(1)
  })
  it('pauses writes when external data is corrupt or cleared', () => {
    const store = new DemoStore(new MemoryStorage(), seed)
    store.receiveExternal('broken')
    expect(store.getSnapshot().issue).not.toBeNull()
    expect(() => store.commit((s) => s)).toThrow(/paused/)
    store.receiveExternal(null)
    expect(store.getSnapshot().issue).not.toBeNull()
  })
})
