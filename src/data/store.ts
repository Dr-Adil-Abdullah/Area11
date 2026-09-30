import { DemoStore, STORAGE_KEY } from './repository'

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

// Store acquisition can itself fail in private/restricted browsers. Keep the UI usable for recovery.
function browserStorage(): StorageLike {
  try {
    return window.localStorage
  } catch {
    return {
      getItem() {
        throw new Error('Storage disabled')
      },
      setItem() {
        throw new Error('Storage disabled')
      },
    }
  }
}
export const demoStore = new DemoStore(browserStorage())
window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY || event.key === null)
    demoStore.receiveExternal(event.key === null ? null : event.newValue)
})
