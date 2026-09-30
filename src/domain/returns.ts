import {
  type AppState,
  type Role,
  type SalesReturn,
  returnReasons,
  businessDate,
  dateSchema,
  DomainError,
  uid,
  invoiceNumber,
} from './model'
import { paidByLine, partialRefund } from './arithmetic'
import { recordCash, requireOpenSession } from './cash'

export interface ReturnSelection {
  saleLineIndex: number
  baseQuantity: number
  disposition: 'restock' | 'quarantine'
}
export interface ReturnInput {
  requestId?: string
  saleId: string
  lines: ReturnSelection[]
  reason: SalesReturn['reason']
  notes: string
  confirmed: boolean
}
export const returnedUnits = (state: AppState, saleId: string, index: number) =>
  state.salesReturns
    .filter((r) => r.saleId === saleId)
    .flatMap((r) => r.lines)
    .filter((l) => l.saleLineIndex === index)
    .reduce((n, l) => n + l.baseQuantity, 0)
export const normalizePhone = (phone: string) => {
  const digits = phone.replace(/\D/g, '')
  return digits.startsWith('0092') && digits.length === 14
    ? digits.slice(2)
    : digits.startsWith('0') && digits.length === 11
      ? `92${digits.slice(1)}`
      : digits
}
export function validatePhone(phone: string) {
  if (
    phone.trim().length > 40 ||
    !/^[0-9+() -]*$/.test(phone) ||
    (phone.trim() && normalizePhone(phone).length < 3)
  )
    throw new DomainError(
      'Use digits, spaces and phone punctuation, or leave the phone field empty.',
    )
  return phone.trim()
}
export function lookupSales(state: AppState, query: string, phone = '', from = '', to = '') {
  if (
    (from && !dateSchema.safeParse(from).success) ||
    (to && !dateSchema.safeParse(to).success) ||
    (from && to && from > to)
  )
    throw new DomainError('Choose a valid date range.')
  const text = query.trim().toLowerCase()
  const digits = normalizePhone(phone)
  return [...state.sales].reverse().filter((sale) => {
    const date = businessDate(new Date(sale.createdAt))
    return (
      (!text ||
        sale.number.toLowerCase().includes(text) ||
        sale.lines.some((l) => l.productName.toLowerCase().includes(text))) &&
      (!digits || normalizePhone(sale.customerPhone).includes(digits)) &&
      (!from || date >= from) &&
      (!to || date <= to)
    )
  })
}
function checkReason(reason: SalesReturn['reason'], notes: string) {
  if (!returnReasons.includes(reason)) throw new DomainError('Choose a return reason.')
  if (notes.trim().length > 400)
    throw new DomainError('Return notes must be 400 characters or fewer.')
  if (reason === 'Other' && notes.trim().length < 2)
    throw new DomainError('Describe the other return reason.')
}
export function quoteReturn(
  state: AppState,
  saleId: string,
  selections: ReturnSelection[],
  reason: SalesReturn['reason'],
  role: Role,
  today: string,
) {
  const sale = state.sales.find((s) => s.id === saleId)
  if (!sale) throw new DomainError('Original invoice not found.')
  if (!selections.length) throw new DomainError('Enter at least one return quantity.')
  if (new Set(selections.map((s) => s.saleLineIndex)).size !== selections.length)
    throw new DomainError('A sale line cannot appear twice in a return.')
  const paid = paidByLine(sale)
  const lines = selections.map((selection) => {
    const source = sale.lines[selection.saleLineIndex]
    if (!source) throw new DomainError('A selected sale line no longer exists.')
    const already = returnedUnits(state, sale.id, selection.saleLineIndex)
    const quantity = selection.baseQuantity
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > source.baseQuantity - already)
      throw new DomainError(
        `${source.productName}: quantity exceeds the unreturned units on this bill.`,
      )
    if (
      selection.disposition === 'restock' &&
      (role === 'cashier' ||
        reason === 'Damaged' ||
        reason === 'Expired' ||
        source.expiresOn < today)
    )
      throw new DomainError(
        'Only Owner/Manager may restock inspected, unexpired goods. Damaged or expired returns must be quarantined.',
      )
    if (!['restock', 'quarantine'].includes(selection.disposition))
      throw new DomainError('Choose a valid stock disposition.')
    return {
      saleLineIndex: selection.saleLineIndex,
      productId: source.productId,
      batchId: source.batchId,
      productName: source.productName,
      baseQuantity: quantity,
      refund: partialRefund(paid[selection.saleLineIndex], source.baseQuantity, already, quantity),
      disposition: selection.disposition,
    }
  })
  return { lines, refund: lines.reduce((n, l) => n + l.refund, 0) }
}
function restoreBatches(state: AppState, lines: SalesReturn['lines']): AppState {
  return {
    ...state,
    batches: state.batches.map((batch) => {
      const returned = lines.filter((l) => l.batchId === batch.id)
      return {
        ...batch,
        stockUnits: batch.stockUnits + returned.reduce((n, l) => n + l.baseQuantity, 0),
        quarantinedUnits:
          batch.quarantinedUnits +
          returned
            .filter((l) => l.disposition === 'quarantine')
            .reduce((n, l) => n + l.baseQuantity, 0),
      }
    }),
  }
}
export function recordSalesReturn(
  state: AppState,
  input: ReturnInput,
  role: Role,
  now: string,
): AppState {
  if (input.requestId && state.salesReturns.some((r) => r.id === input.requestId))
    throw new DomainError('This return request is already recorded. No second refund was made.')
  if (!input.confirmed)
    throw new DomainError('Confirm receipt of the goods and the actual cash refund.')
  checkReason(input.reason, input.notes)
  const sale = state.sales.find((s) => s.id === input.saleId)
  if (sale && now < sale.createdAt) throw new DomainError('A return cannot precede its sale.')
  const quote = quoteReturn(
    state,
    input.saleId,
    input.lines,
    input.reason,
    role,
    businessDate(new Date(now)),
  )
  const session = requireOpenSession(state)
  const record: SalesReturn = {
    id: input.requestId ?? uid(),
    number: invoiceNumber('RET', state.nextReturnNumber),
    saleId: input.saleId,
    provisionalId: null,
    createdAt: now,
    role,
    reason: input.reason,
    notes: input.notes.trim(),
    ...quote,
    cashSessionId: session.id,
    settlement: 'direct',
    cashDifference: -quote.refund,
    differenceExpenseId: null,
  }
  const withCash = recordCash(state, 'return', -quote.refund, record.id, role, now)
  return restoreBatches(
    {
      ...withCash,
      salesReturns: [...state.salesReturns, record],
      nextReturnNumber: state.nextReturnNumber + 1,
    },
    quote.lines,
  )
}

export interface ProvisionalInput {
  requestId?: string
  items: { productId: string; baseQuantity: number }[]
  refundPaid: number
  phone: string
  reason: SalesReturn['reason']
  notes: string
  confirmed: boolean
}
export function recordProvisionalReturn(
  state: AppState,
  input: ProvisionalInput,
  role: Role,
  now: string,
): AppState {
  if (input.requestId && state.provisionalReturns.some((r) => r.id === input.requestId))
    throw new DomainError(
      'This provisional request is already recorded. No second cash refund was made.',
    )
  if (!input.confirmed)
    throw new DomainError('Confirm the actual cash refunded and goods received.')
  checkReason(input.reason, input.notes)
  const phone = validatePhone(input.phone)
  if (!Number.isSafeInteger(input.refundPaid) || input.refundPaid <= 0)
    throw new DomainError('Enter the positive amount actually refunded.')
  if (
    !input.items.length ||
    new Set(input.items.map((i) => i.productId)).size !== input.items.length
  )
    throw new DomainError('Choose distinct products for this provisional return.')
  const items = input.items.map((item) => {
    const product = state.products.find((p) => p.id === item.productId)
    if (
      !product ||
      !Number.isSafeInteger(item.baseQuantity) ||
      item.baseQuantity < 1 ||
      item.baseQuantity > 1_000_000
    )
      throw new DomainError('Choose a product and a positive whole base-unit quantity.')
    return { ...item, productName: product.name }
  })
  const session = requireOpenSession(state)
  const provisional = {
    id: input.requestId ?? uid(),
    number: invoiceNumber('PR', state.nextProvisionalNumber),
    createdAt: now,
    role,
    phone,
    reason: input.reason,
    notes: input.notes.trim(),
    refundPaid: input.refundPaid,
    cashSessionId: session.id,
    items,
    linkedReturnId: null,
  }
  const withCash = recordCash(
    state,
    'provisional-refund',
    -input.refundPaid,
    provisional.id,
    role,
    now,
  )
  // Unknown batches are held outside saleable inventory until the original invoice is verified.
  return {
    ...withCash,
    provisionalReturns: [...state.provisionalReturns, provisional],
    nextProvisionalNumber: state.nextProvisionalNumber + 1,
  }
}
export function linkProvisionalReturn(
  state: AppState,
  provisionalId: string,
  input: ReturnInput,
  settlement: 'cash' | 'expense',
  role: Role,
  now: string,
): AppState {
  if (role === 'cashier')
    throw new DomainError('Owner or Manager must verify and link a provisional return.')
  if (!input.confirmed)
    throw new DomainError('Confirm the original invoice and any actual cash settlement.')
  const provisional = state.provisionalReturns.find((p) => p.id === provisionalId)
  if (!provisional || provisional.linkedReturnId)
    throw new DomainError('This provisional return is missing or already linked.')
  checkReason(provisional.reason, input.notes || provisional.notes)
  const sale = state.sales.find((s) => s.id === input.saleId)
  if (!sale || sale.createdAt > provisional.createdAt || now < provisional.createdAt)
    throw new DomainError('Choose an original sale that existed before the provisional refund.')
  const quote = quoteReturn(
    state,
    sale.id,
    input.lines,
    provisional.reason,
    role,
    businessDate(new Date(now)),
  )
  const quantities = new Map<string, number>()
  quote.lines.forEach((l) =>
    quantities.set(l.productId, (quantities.get(l.productId) ?? 0) + l.baseQuantity),
  )
  if (
    quantities.size !== provisional.items.length ||
    provisional.items.some((i) => quantities.get(i.productId) !== i.baseQuantity)
  )
    throw new DomainError(
      'The linked products and base-unit quantities must exactly match the provisional goods received.',
    )
  const difference = provisional.refundPaid - quote.refund
  if (!['cash', 'expense'].includes(settlement))
    throw new DomainError('Choose how the refund difference was settled.')
  if (settlement === 'expense' && difference !== 0 && (role !== 'owner' || difference < 0))
    throw new DomainError(
      'Only Owner may absorb an overpayment. An underpayment must be refunded to the customer.',
    )
  const returnId = uid()
  let next = state
  let expenseId: string | null = null
  let cashSessionId: string | null = null
  let cashDifference = 0
  if (difference && settlement === 'cash') {
    cashSessionId = requireOpenSession(state).id
    cashDifference = difference
    next = recordCash(next, 'return-settlement', difference, returnId, role, now)
  } else if (difference && settlement === 'expense') {
    expenseId = uid()
    next = {
      ...next,
      nextExpenseNumber: next.nextExpenseNumber + 1,
      expenses: [
        ...next.expenses,
        {
          id: expenseId,
          number: invoiceNumber('EXP', next.nextExpenseNumber),
          createdAt: now,
          paidOn: businessDate(new Date(now)),
          role: 'owner',
          kind: 'return-adjustment',
          category: 'Provisional refund overpayment',
          amount: difference,
          notes: `Overpayment on ${provisional.number}; linked to ${sale.number}.`,
          payment: 'adjustment',
          cashSessionId: null,
          relatedReturnId: returnId,
        },
      ],
    }
  }
  const record: SalesReturn = {
    id: returnId,
    number: invoiceNumber('RET', next.nextReturnNumber),
    saleId: sale.id,
    provisionalId,
    createdAt: now,
    role,
    reason: provisional.reason,
    notes: input.notes.trim() || provisional.notes,
    ...quote,
    cashSessionId,
    settlement: !difference ? 'matched' : settlement,
    cashDifference,
    differenceExpenseId: expenseId,
  }
  next = {
    ...next,
    nextReturnNumber: next.nextReturnNumber + 1,
    salesReturns: [...next.salesReturns, record],
    provisionalReturns: next.provisionalReturns.map((p) =>
      p.id === provisionalId ? { ...p, linkedReturnId: returnId } : p,
    ),
  }
  return restoreBatches(next, quote.lines)
}
