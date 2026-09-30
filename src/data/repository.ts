import { type AppState, type Role, stateSchema, DomainError, businessDate } from '../domain/model'
import { createSeedState } from '../domain/seed'
import { decodeSnapshot } from './migrations'

export const STORAGE_KEY = 'area11.phase1.workspace.v1'
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>
type Snapshot = { state: AppState; issue: string | null }

export class DemoStore {
  private snapshot: Snapshot
  private listeners = new Set<() => void>()
  constructor(
    private storage: StorageLike,
    private seed = () => createSeedState(businessDate()),
  ) {
    const initial = seed()
    try {
      const saved = storage.getItem(STORAGE_KEY)
      const decoded = saved
        ? decodeSnapshot(saved)
        : { state: initial, migrated: false, backupKey: null }
      const state = decoded.state
      if (saved && decoded.migrated) {
        const backup = storage.getItem(decoded.backupKey!)
        if (backup !== null && backup !== saved)
          throw new Error(
            'An original migration backup already exists and differs. Nothing was overwritten.',
          )
        if (storage.getItem(STORAGE_KEY) !== saved)
          throw new Error(
            'The saved workspace changed during migration. Reload it before continuing.',
          )
        if (backup === null) storage.setItem(decoded.backupKey!, saved)
        storage.setItem(STORAGE_KEY, JSON.stringify(state))
      }
      if (!saved) storage.setItem(STORAGE_KEY, JSON.stringify(state))
      this.snapshot = { state, issue: null }
    } catch {
      this.snapshot = {
        state: initial,
        issue:
          'Saved demo data could not be loaded or upgraded. Transactions are paused; existing data has not been overwritten. Check browser storage and try reloading. Download the saved snapshot before considering an Owner reset.',
      }
    }
  }
  getSnapshot = () => this.snapshot
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  private notify() {
    this.listeners.forEach((listener) => listener())
  }
  private write(state: AppState) {
    const checked = stateSchema.safeParse(state)
    if (!checked.success)
      throw new DomainError(`Could not save this change: ${checked.error.issues[0].message}`)
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(checked.data))
    } catch {
      throw new DomainError(
        'Browser storage is unavailable or full. Nothing was changed. Free space or enable storage, then try again.',
      )
    }
    this.snapshot = { state: checked.data, issue: null }
    this.notify()
    return checked.data
  }
  commit(transform: (state: AppState) => AppState): AppState {
    if (this.snapshot.issue)
      throw new DomainError(
        'Transactions are paused because saved demo data is unreadable. Reload after resolving storage issues, or preserve the saved snapshot before an explicit Owner reset.',
      )
    let saved: AppState
    try {
      const raw = this.storage.getItem(STORAGE_KEY)
      if (!raw) throw new Error('Missing workspace')
      const decoded = decodeSnapshot(raw)
      if (decoded.migrated) throw new Error('Reload to migrate the legacy workspace.')
      saved = decoded.state
    } catch {
      this.snapshot = {
        ...this.snapshot,
        issue:
          'Saved data changed or became unreadable. Transactions are paused. Reload first; download the saved snapshot before an explicit Owner reset.',
      }
      this.notify()
      throw new DomainError(this.snapshot.issue!)
    }
    if (saved.revision !== this.snapshot.state.revision) {
      this.snapshot = { state: saved, issue: null }
      this.notify()
      throw new DomainError(
        'The workspace changed in another tab. It has been refreshed; check your cart and try again.',
      )
    }
    const next = transform(this.snapshot.state)
    return this.write({ ...next, revision: this.snapshot.state.revision + 1 })
  }
  reset(role: Role) {
    if (role !== 'owner') throw new DomainError('Only the demo Owner can reset this workspace.')
    return this.write({ ...this.seed(), revision: this.snapshot.state.revision + 1 })
  }
  receiveExternal(raw: string | null) {
    try {
      if (!raw) throw new Error('Missing data')
      const decoded = decodeSnapshot(raw)
      if (decoded.migrated) throw new Error('Reload to migrate the legacy workspace.')
      this.snapshot = { state: decoded.state, issue: null }
    } catch {
      this.snapshot = {
        ...this.snapshot,
        issue:
          'Demo data was cleared or became unreadable in another tab. Transactions are paused; reload first and preserve any remaining saved snapshot before an Owner reset.',
      }
    }
    this.notify()
  }
}
