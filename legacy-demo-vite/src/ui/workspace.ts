import { createContext, useContext } from 'react'
import type { AppState, Role } from '../domain/model'

export type Dialog =
  | { type: 'batch'; productId: string }
  | { type: 'product'; selectForRow?: string }
  | { type: 'receipt'; saleId: string }
  | { type: 'purchase'; purchaseId: string }
  | { type: 'sales-return'; saleId: string }
  | { type: 'link-return'; provisionalId: string }
  | { type: 'return-record'; returnId: string }
  | { type: 'supplier'; supplierId?: string; selectForPurchase?: boolean }
  | { type: 'supplier-balance' | 'supplier-cash'; supplierId: string }
  | { type: 'supplier-return'; supplierId?: string; batchId?: string }
  | { type: 'supplier-return-record'; returnId: string }
  | { type: 'reorder-policy'; productId?: string }
  | { type: 'provisional-return' | 'discount' | 'contact' }
  | { type: 'checkout' | 'park' | 'clear' | 'reset' | 'roadmap' }
export type Page =
  | 'counter'
  | 'inventory'
  | 'purchases'
  | 'receipts'
  | 'settings'
  | 'returns'
  | 'cash'
  | 'accounts'
  | 'suppliers'
  | 'expiry'
  | 'reorder'
export interface Workspace {
  state: AppState
  role: Role
  today: string
  storageIssue: string | null
  feedback: { message: string; kind: 'success' | 'error' | 'info' } | null
  run: (change: (state: AppState) => AppState, message?: string) => AppState | undefined
  notify: (message: string, kind?: 'success' | 'error' | 'info') => void
  open: (dialog: Dialog) => void
  close: () => void
  navigate: (page: Page) => void
}
export const WorkspaceContext = createContext<Workspace | null>(null)
export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (!context) throw new Error('Workspace provider is missing.')
  return context
}
