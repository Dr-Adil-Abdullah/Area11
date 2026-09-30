import {
  type AppState,
  type Role,
  type Supplier,
  type SupplierReturn,
  type SupplierSettlement,
  type Product,
  supplierSchema,
  reorderSchema,
  DomainError,
  uid,
  invoiceNumber,
  safeSum,
  safeMultiply,
  businessDate,
  daysUntil,
} from './model'
import { recordCash, requireOpenSession } from './cash'
import { validatePhone } from './returns'

export function requireManagement(role: Role): asserts role is 'owner' | 'manager' {
  if (role !== 'owner' && role !== 'manager')
    throw new DomainError('Only Owner or Manager may manage suppliers and stock alerts.')
}
export const supplierNameKey = (name: string) => name.trim().toLocaleLowerCase('en')
export function getSupplier(state: AppState, id: string) {
  const supplier = state.suppliers.find((s) => s.id === id)
  if (!supplier) throw new DomainError('Supplier profile not found.')
  return supplier
}
export interface SupplierInput {
  name: string
  agency: string
  phone: string
  address: string
  openingBalance: number
  openingNote: string
  confirmed: boolean
}
export function createSupplier(
  state: AppState,
  input: SupplierInput,
  role: Role,
  now: string,
): AppState {
  requireManagement(role)
  if (!input.confirmed)
    throw new DomainError('Confirm the starting supplier balance, including a zero balance.')
  if (state.suppliers.some((s) => supplierNameKey(s.name) === supplierNameKey(input.name)))
    throw new DomainError('A supplier with this name already exists. Choose its existing profile.')
  const parsed = supplierSchema.safeParse({
    id: uid(),
    name: input.name,
    agency: input.agency,
    phone: validatePhone(input.phone),
    address: input.address,
    createdAt: now,
    source: 'created',
    openingBalance: input.openingBalance,
    openingConfirmed: true,
    openingConfirmedAt: now,
    openingConfirmedBy: role,
    openingNote: input.openingNote.trim() || 'New demo account balance confirmed.',
  })
  if (!parsed.success) throw new DomainError(parsed.error.issues[0].message)
  return { ...state, suppliers: [...state.suppliers, parsed.data] }
}
export function editSupplier(
  state: AppState,
  id: string,
  contact: Pick<Supplier, 'name' | 'agency' | 'phone' | 'address'>,
  role: Role,
): AppState {
  requireManagement(role)
  const supplier = getSupplier(state, id)
  if (
    state.suppliers.some(
      (s) => s.id !== id && supplierNameKey(s.name) === supplierNameKey(contact.name),
    )
  )
    throw new DomainError('Supplier names must be distinct.')
  const parsed = supplierSchema.safeParse({
    ...supplier,
    ...contact,
    phone: validatePhone(contact.phone),
  })
  if (!parsed.success) throw new DomainError(parsed.error.issues[0].message)
  // Purchase headers are historical name snapshots; their IDs, amounts and names are not rewritten.
  return { ...state, suppliers: state.suppliers.map((s) => (s.id === id ? parsed.data : s)) }
}
export interface SupplierLedgerRow {
  id: string
  number: string
  order: number
  createdAt: string
  kind: 'purchase' | 'credit' | 'payment' | 'refund'
  amount: number
  role: Role
  balance: number
}
export function supplierLedger(state: AppState, supplierId: string): SupplierLedgerRow[] {
  const supplier = getSupplier(state, supplierId)
  const rows = [
    ...state.purchases
      .filter((p) => p.supplierId === supplierId && p.ledgerTreatment === 'account')
      .map((p) => ({
        id: p.id,
        number: p.number,
        order: p.ledgerOrder!,
        createdAt: p.createdAt,
        kind: 'purchase' as const,
        amount: p.totalCost,
        role: p.role,
      })),
    ...state.supplierReturns
      .filter((r) => r.supplierId === supplierId)
      .map((r) => ({
        id: r.id,
        number: r.number,
        order: r.ledgerOrder,
        createdAt: r.createdAt,
        kind: 'credit' as const,
        amount: -r.totalCredit,
        role: r.role,
      })),
    ...state.supplierSettlements
      .filter((p) => p.supplierId === supplierId)
      .map((p) => ({
        id: p.id,
        number: p.number,
        order: p.ledgerOrder,
        createdAt: p.createdAt,
        kind: p.kind,
        amount: p.kind === 'payment' ? -p.amount : p.amount,
        role: p.role,
      })),
  ].sort((a, b) => a.order - b.order)
  let balance = supplier.openingBalance
  return rows.map((r) => {
    balance = safeSum([balance, r.amount])
    return { ...r, balance }
  })
}
export function supplierMovement(state: AppState, supplierId: string) {
  return safeSum(supplierLedger(state, supplierId).map((r) => r.amount))
}
export function supplierBalance(state: AppState, supplierId: string) {
  const supplier = getSupplier(state, supplierId)
  if (!supplier.openingConfirmed)
    throw new DomainError(
      'Confirm the carried-forward supplier balance first. Historical purchases were not assumed unpaid.',
    )
  return safeSum([supplier.openingBalance, supplierMovement(state, supplierId)])
}
export function confirmSupplierBalance(
  state: AppState,
  supplierId: string,
  statementBalance: number,
  note: string,
  role: Role,
  now: string,
  confirmed: boolean,
): AppState {
  requireManagement(role)
  const supplier = getSupplier(state, supplierId)
  if (supplier.openingConfirmed)
    throw new DomainError(
      'This supplier starting balance is already confirmed and cannot be edited.',
    )
  if (!confirmed || note.trim().length < 2 || note.trim().length > 300)
    throw new DomainError(
      'Confirm the supplier statement and record a reconciliation note (2–300 characters).',
    )
  if (!Number.isSafeInteger(statementBalance))
    throw new DomainError('Enter a valid signed supplier balance.')
  const ledger = supplierLedger(state, supplierId)
  if (ledger.some((r) => r.createdAt > now))
    throw new DomainError('Reconciliation cannot precede a posted supplier movement.')
  const openingBalance = safeSum([statementBalance, -supplierMovement(state, supplierId)])
  return {
    ...state,
    suppliers: state.suppliers.map((s) =>
      s.id === supplierId
        ? {
            ...s,
            openingBalance,
            openingConfirmed: true,
            openingConfirmedAt: now,
            openingConfirmedBy: role,
            openingNote: note.trim(),
          }
        : s,
    ),
  }
}
export function saveReorderPolicy(
  state: AppState,
  productId: string,
  input: Product['reorder'],
  role: Role,
): AppState {
  requireManagement(role)
  if (!state.products.some((p) => p.id === productId)) throw new DomainError('Product not found.')
  const parsed = reorderSchema.safeParse(input)
  if (!parsed.success) throw new DomainError(parsed.error.issues[0].message)
  if (parsed.data.preferredSupplierId) getSupplier(state, parsed.data.preferredSupplierId)
  return {
    ...state,
    products: state.products.map((p) => (p.id === productId ? { ...p, reorder: parsed.data } : p)),
  }
}
export interface SupplierReturnInput {
  supplierId: string
  reason: SupplierReturn['reason']
  creditReference: string
  notes: string
  confirmed: boolean
  requestId?: string
  lines: { batchId: string; shelfUnits: number; quarantinedUnits: number }[]
}
export function quoteSupplierReturn(state: AppState, input: SupplierReturnInput, today: string) {
  getSupplier(state, input.supplierId)
  if (!input.lines.length || new Set(input.lines.map((l) => l.batchId)).size !== input.lines.length)
    throw new DomainError('Choose distinct original batches and at least one return quantity.')
  const lines = input.lines.map((l) => {
    const batch = state.batches.find((b) => b.id === l.batchId)
    const purchase = state.purchases.find((p) => p.id === batch?.purchaseId)
    const product = state.products.find((p) => p.id === batch?.productId)
    if (!batch || !purchase || !product || purchase.supplierId !== input.supplierId)
      throw new DomainError('Every batch must come from this supplier’s original delivery.')
    if (
      ![l.shelfUnits, l.quarantinedUnits].every((n) => Number.isSafeInteger(n) && n >= 0) ||
      l.shelfUnits + l.quarantinedUnits < 1 ||
      l.shelfUnits > batch.stockUnits - batch.quarantinedUnits ||
      l.quarantinedUnits > batch.quarantinedUnits
    )
      throw new DomainError(
        `${product.name}: return exceeds the selected shelf/quarantine quantities.`,
      )
    if (input.reason === 'Expired' && batch.expiresOn >= today)
      throw new DomainError(
        'The expiry date is valid through that date. Choose Expired only after it has passed.',
      )
    if (
      input.reason === 'Near expiry' &&
      (batch.expiresOn < today || daysUntil(batch.expiresOn, today) > state.settings.expiry.farDays)
    )
      throw new DomainError(
        'Near-expiry returns must be unexpired and within the configured alert window.',
      )
    const baseQuantity = safeSum([l.shelfUnits, l.quarantinedUnits])
    return {
      ...l,
      productId: product.id,
      purchaseId: purchase.id,
      productName: product.name,
      batchNumber: batch.number,
      baseQuantity,
      costPerBase: batch.costPerBase,
      credit: safeMultiply(baseQuantity, batch.costPerBase),
    }
  })
  return { lines, totalCredit: safeSum(lines.map((l) => l.credit)) }
}
export function recordSupplierReturn(
  state: AppState,
  input: SupplierReturnInput,
  role: Role,
  now: string,
): AppState {
  requireManagement(role)
  if (!input.confirmed)
    throw new DomainError(
      'Confirm that the supplier accepted these goods and their cost-based credit note.',
    )
  if (input.requestId && state.supplierReturns.some((r) => r.id === input.requestId))
    throw new DomainError('This supplier return request is already recorded.')
  if (
    input.creditReference.trim().length < 2 ||
    input.creditReference.trim().length > 80 ||
    input.notes.trim().length > 400
  )
    throw new DomainError(
      'Enter a supplier credit reference (2–80 characters); notes may be up to 400.',
    )
  if (
    state.supplierReturns.some(
      (r) =>
        r.supplierId === input.supplierId &&
        r.creditReference.toLowerCase() === input.creditReference.trim().toLowerCase(),
    )
  )
    throw new DomainError(
      'This supplier credit note was already recorded. No duplicate credit is allowed.',
    )
  const quote = quoteSupplierReturn(state, input, businessDate(new Date(now)))
  if (quote.lines.some((l) => state.batches.find((b) => b.id === l.batchId)!.receivedAt > now))
    throw new DomainError('A return cannot precede its original delivery.')
  const record: SupplierReturn = {
    id: input.requestId ?? uid(),
    number: invoiceNumber('SRET', state.nextSupplierReturnNumber),
    supplierId: input.supplierId,
    createdAt: now,
    role: role as 'owner' | 'manager',
    reason: input.reason,
    creditReference: input.creditReference.trim(),
    notes: input.notes.trim(),
    ...quote,
    ledgerOrder: state.nextSupplierLedgerOrder,
  }
  return {
    ...state,
    nextSupplierReturnNumber: state.nextSupplierReturnNumber + 1,
    nextSupplierLedgerOrder: state.nextSupplierLedgerOrder + 1,
    supplierReturns: [...state.supplierReturns, record],
    batches: state.batches.map((b) => {
      const line = quote.lines.find((l) => l.batchId === b.id)
      return line
        ? {
            ...b,
            stockUnits: b.stockUnits - line.baseQuantity,
            quarantinedUnits: b.quarantinedUnits - line.quarantinedUnits,
          }
        : b
    }),
  }
}
export interface SettlementInput {
  supplierId: string
  kind: SupplierSettlement['kind']
  amount: number
  reference: string
  notes: string
  confirmed: boolean
  requestId?: string
}
export function recordSupplierSettlement(
  state: AppState,
  input: SettlementInput,
  role: Role,
  now: string,
): AppState {
  requireManagement(role)
  if (!input.confirmed) throw new DomainError('Confirm the actual supplier cash exchange.')
  if (input.requestId && state.supplierSettlements.some((p) => p.id === input.requestId))
    throw new DomainError('This supplier cash request is already recorded.')
  if (
    !Number.isSafeInteger(input.amount) ||
    input.amount <= 0 ||
    input.reference.trim().length < 2 ||
    input.reference.trim().length > 80 ||
    input.notes.trim().length > 300
  )
    throw new DomainError('Enter a positive amount and a reference (2–80 characters).')
  const balanceBefore = supplierBalance(state, input.supplierId)
  if (
    !['payment', 'refund'].includes(input.kind) ||
    (input.kind === 'payment'
      ? input.amount > Math.max(0, balanceBefore)
      : input.amount > Math.max(0, -balanceBefore))
  )
    throw new DomainError(
      'Payment cannot exceed the supplier payable; a received refund cannot exceed the supplier credit balance.',
    )
  const session = requireOpenSession(state)
  const record: SupplierSettlement = {
    id: input.requestId ?? uid(),
    number: invoiceNumber('SPAY', state.nextSupplierSettlementNumber),
    supplierId: input.supplierId,
    createdAt: now,
    role: role as 'owner' | 'manager',
    kind: input.kind,
    amount: input.amount,
    cashSessionId: session.id,
    reference: input.reference.trim(),
    notes: input.notes.trim(),
    balanceBefore,
    ledgerOrder: state.nextSupplierLedgerOrder,
  }
  const withCash = recordCash(
    state,
    input.kind === 'payment' ? 'supplier-payment' : 'supplier-refund',
    input.kind === 'payment' ? -input.amount : input.amount,
    record.id,
    role,
    now,
  )
  return {
    ...withCash,
    nextSupplierSettlementNumber: state.nextSupplierSettlementNumber + 1,
    nextSupplierLedgerOrder: state.nextSupplierLedgerOrder + 1,
    supplierSettlements: [...state.supplierSettlements, record],
  }
}
