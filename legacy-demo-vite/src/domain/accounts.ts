import {
  type AppState,
  type Role,
  type OwnerEntry,
  type Expense,
  DomainError,
  businessDate,
  uid,
  invoiceNumber,
  usableUnits,
  isExpired,
  safeMultiply,
} from './model'
import { recordCash, requireOpenSession } from './cash'

function positive(amount: number) {
  if (!Number.isSafeInteger(amount) || amount <= 0)
    throw new DomainError('Enter a positive amount.')
}
function notes(value: string, required = false) {
  if (value.trim().length > 300 || (required && value.trim().length < 2))
    throw new DomainError('Enter a description between 2 and 300 characters.')
  return value.trim()
}
export function recordExpense(
  state: AppState,
  input: { amount: number; kind: 'daily' | 'monthly'; category: string; notes: string },
  role: Role,
  now: string,
): AppState {
  if (role === 'cashier') throw new DomainError('Only Owner or Manager can record shop expenses.')
  positive(input.amount)
  if (
    !['daily', 'monthly'].includes(input.kind) ||
    input.category.trim().length < 2 ||
    input.category.trim().length > 60
  )
    throw new DomainError('Choose an expense period and a category (2–60 characters).')
  const session = requireOpenSession(state)
  const expense: Expense = {
    id: uid(),
    number: invoiceNumber('EXP', state.nextExpenseNumber),
    createdAt: now,
    paidOn: businessDate(new Date(now)),
    role,
    kind: input.kind,
    category: input.category.trim(),
    notes: notes(input.notes),
    amount: input.amount,
    payment: 'cash',
    cashSessionId: session.id,
    relatedReturnId: null,
  }
  const withCash = recordCash(state, 'expense', -input.amount, expense.id, role, now)
  return {
    ...withCash,
    nextExpenseNumber: state.nextExpenseNumber + 1,
    expenses: [...state.expenses, expense],
  }
}
export function recordOwnerCash(
  state: AppState,
  kind: 'cash-withdrawal' | 'cash-deposit',
  amount: number,
  description: string,
  role: Role,
  now: string,
): AppState {
  if (role !== 'owner') throw new DomainError('Only Owner can use the personal drawing account.')
  positive(amount)
  if (!['cash-withdrawal', 'cash-deposit'].includes(kind))
    throw new DomainError('Choose an owner withdrawal or deposit.')
  const session = requireOpenSession(state)
  const entry: OwnerEntry = {
    id: uid(),
    number: invoiceNumber('DRAW', state.nextOwnerEntryNumber),
    createdAt: now,
    role: 'owner',
    kind,
    amount,
    notes: notes(description, true),
    cashSessionId: session.id,
    productId: null,
    batchId: null,
    baseQuantity: null,
  }
  const withCash = recordCash(
    state,
    kind === 'cash-withdrawal' ? 'owner-withdrawal' : 'owner-deposit',
    kind === 'cash-withdrawal' ? -amount : amount,
    entry.id,
    role,
    now,
  )
  return {
    ...withCash,
    nextOwnerEntryNumber: state.nextOwnerEntryNumber + 1,
    ownerEntries: [...state.ownerEntries, entry],
  }
}
export function recordOwnerMedicine(
  state: AppState,
  batchId: string,
  quantity: number,
  description: string,
  role: Role,
  now: string,
): AppState {
  if (role !== 'owner') throw new DomainError('Only Owner can record personal medicine use.')
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1_000_000)
    throw new DomainError('Enter a positive whole base-unit quantity.')
  const batch = state.batches.find((b) => b.id === batchId)
  if (!batch || isExpired(batch, businessDate(new Date(now))) || usableUnits(batch) < quantity)
    throw new DomainError('Choose an unexpired batch with enough unquarantined units.')
  const entry: OwnerEntry = {
    id: uid(),
    number: invoiceNumber('DRAW', state.nextOwnerEntryNumber),
    createdAt: now,
    role: 'owner',
    kind: 'medicine-use',
    amount: safeMultiply(quantity, batch.costPerBase),
    notes: notes(description, true),
    cashSessionId: null,
    productId: batch.productId,
    batchId,
    baseQuantity: quantity,
  }
  return {
    ...state,
    nextOwnerEntryNumber: state.nextOwnerEntryNumber + 1,
    ownerEntries: [...state.ownerEntries, entry],
    batches: state.batches.map((b) =>
      b.id === batchId ? { ...b, stockUnits: b.stockUnits - quantity } : b,
    ),
  }
}
export function ownerBalance(state: AppState) {
  return state.ownerEntries.reduce(
    (sum, e) => sum + (e.kind === 'cash-deposit' ? -e.amount : e.amount),
    0,
  )
}
