import type { AppState, CashEntry } from './model'
import { paidByLine, partialRefund } from './arithmetic'

export function validateFinancialState(s: AppState, fail: (message: string) => void) {
  const sequences = [
    [s.salesReturns, s.nextReturnNumber],
    [s.provisionalReturns, s.nextProvisionalNumber],
    [s.cashSessions, s.nextCashSessionNumber],
    [s.expenses, s.nextExpenseNumber],
    [s.ownerEntries, s.nextOwnerEntryNumber],
  ] as const
  for (const [records, next] of sequences) {
    if (
      new Set(records.map((r) => r.id)).size !== records.length ||
      new Set(records.map((r) => r.number)).size !== records.length ||
      records.some((r) => Number(r.number.split('-')[1]) >= next)
    )
      fail('Invalid financial record sequence.')
  }
  if (
    new Set(s.cashEntries.map((e) => e.id)).size !== s.cashEntries.length ||
    new Set(s.cashEntries.map((e) => `${e.kind}:${e.refId}`)).size !== s.cashEntries.length
  )
    fail('Duplicate cash transaction.')
  if (s.cashSessions.filter((c) => c.status === 'open').length > 1)
    fail('More than one cash shift is open.')
  const sessionIds = new Set(s.cashSessions.map((c) => c.id))
  const entryFor = (kind: CashEntry['kind'], ref: string) =>
    s.cashEntries.filter((e) => e.kind === kind && e.refId === ref)
  const checkEntry = (
    kind: CashEntry['kind'],
    ref: string,
    amount: number,
    sessionId: string | null,
    createdAt: string,
  ) => {
    const entries = entryFor(kind, ref)
    if (
      !sessionId ||
      entries.length !== 1 ||
      entries[0].amount !== amount ||
      entries[0].sessionId !== sessionId ||
      entries[0].createdAt !== createdAt
    )
      fail('Financial record and cash movement disagree.')
  }
  for (const session of s.cashSessions) {
    let balance = BigInt(session.opening)
    let lastAt = session.openedAt
    for (const entry of s.cashEntries.filter((e) => e.sessionId === session.id)) {
      balance += BigInt(entry.amount)
      if (entry.createdAt < lastAt || balance < 0n || balance > BigInt(Number.MAX_SAFE_INTEGER))
        fail('Invalid historical cash drawer balance.')
      lastAt = entry.createdAt
    }
    const expected = Number(balance)
    if (!Number.isSafeInteger(expected) || expected < 0) fail('Invalid cash drawer balance.')
    if (session.status === 'open') {
      if (
        session.closedAt !== null ||
        session.closedBy !== null ||
        session.counted !== null ||
        session.expectedAtClose !== null ||
        session.variance !== null ||
        session.handoverTo !== null
      )
        fail('Open cash shift has closing data.')
    } else if (
      !session.closedAt ||
      !session.closedBy ||
      session.counted === null ||
      session.expectedAtClose !== expected ||
      session.variance !== session.counted - expected ||
      session.closedAt < session.openedAt ||
      (session.variance && session.closeNote.length < 2)
    )
      fail('Invalid cash closing snapshot.')
    if (session.previousSessionId) {
      const previous = s.cashSessions.find((c) => c.id === session.previousSessionId)
      if (
        !previous ||
        previous.status !== 'closed' ||
        previous.handoverTo !== session.id ||
        previous.counted !== session.opening ||
        previous.closedAt !== session.openedAt
      )
        fail('Invalid cash handover.')
    }
    if (
      session.handoverTo &&
      !s.cashSessions.some((c) => c.id === session.handoverTo && c.previousSessionId === session.id)
    )
      fail('Broken handover reference.')
  }
  for (const entry of s.cashEntries) {
    const session = s.cashSessions.find((c) => c.id === entry.sessionId)
    if (
      !session ||
      entry.createdAt < session.openedAt ||
      (session.closedAt && entry.createdAt > session.closedAt)
    )
      fail('Cash movement is outside its shift.')
    const source =
      entry.kind === 'sale'
        ? s.sales.find((r) => r.id === entry.refId)
        : entry.kind === 'return' || entry.kind === 'return-settlement'
          ? s.salesReturns.find((r) => r.id === entry.refId)
          : entry.kind === 'provisional-refund'
            ? s.provisionalReturns.find((r) => r.id === entry.refId)
            : entry.kind === 'expense'
              ? s.expenses.find((r) => r.id === entry.refId)
              : entry.kind === 'supplier-payment' || entry.kind === 'supplier-refund'
                ? s.supplierSettlements.find((r) => r.id === entry.refId)
                : s.ownerEntries.find((r) => r.id === entry.refId)
    if (!source || source.role !== entry.role) fail('Cash movement has no matching source.')
  }
  for (const sale of s.sales) {
    if (sale.legacy) {
      if (sale.cashSessionId !== null || entryFor('sale', sale.id).length)
        fail('Legacy sale was added to a cash shift.')
    } else checkEntry('sale', sale.id, sale.total, sale.cashSessionId, sale.createdAt)
    for (const line of sale.lines) {
      const batch = s.batches.find((b) => b.id === line.batchId)
      if (
        !batch ||
        batch.productId !== line.productId ||
        BigInt(line.cost) !== BigInt(batch.costPerBase) * BigInt(line.baseQuantity)
      )
        fail('Sale line disagrees with its original purchase cost.')
    }
    if (sale.lines.some((l) => l.retailTotal !== l.pricePerPack * l.quantity))
      fail('Invalid original sale price snapshot.')
  }
  const returned = new Map<string, number>()
  const paidCache = new Map<string, number[]>()
  for (const r of s.salesReturns) {
    const sale = s.sales.find((sale) => sale.id === r.saleId)
    if (!sale || r.createdAt < sale.createdAt) {
      fail('Return has no valid original sale.')
      continue
    }
    if (new Set(r.lines.map((l) => l.saleLineIndex)).size !== r.lines.length)
      fail('Duplicate return line.')
    if (
      sale.lines.reduce((n, l) => n + l.total, 0) !== sale.subtotal ||
      sale.total > sale.subtotal ||
      sale.total < sale.cost ||
      sale.cost !== sale.lines.reduce((n, l) => n + l.cost, 0) ||
      sale.lines.some((l) => l.total < l.cost)
    ) {
      fail('Cannot allocate an invalid sale.')
      continue
    }
    const paid = paidCache.get(sale.id) ?? paidByLine(sale)
    paidCache.set(sale.id, paid)
    if (r.refund !== r.lines.reduce((n, l) => n + l.refund, 0)) fail('Invalid refund total.')
    for (const line of r.lines) {
      const source = sale.lines[line.saleLineIndex]
      const key = `${sale.id}:${line.saleLineIndex}`
      const old = returned.get(key) ?? 0
      if (
        !source ||
        line.productId !== source.productId ||
        line.batchId !== source.batchId ||
        line.productName !== source.productName ||
        old + line.baseQuantity > source.baseQuantity
      ) {
        fail('Return exceeds or mismatches original sale.')
        continue
      }
      if (
        line.refund !==
        partialRefund(paid[line.saleLineIndex], source.baseQuantity, old, line.baseQuantity)
      )
        fail('Refund exceeds its allocated collected price.')
      if (
        line.disposition === 'restock' &&
        (r.role === 'cashier' ||
          r.reason === 'Damaged' ||
          r.reason === 'Expired' ||
          source.expiresOn < businessDay(r.createdAt))
      )
        fail('Unsafe returned goods were restocked.')
      returned.set(key, old + line.baseQuantity)
    }
    if (!r.provisionalId) {
      if (
        r.settlement !== 'direct' ||
        r.cashDifference !== -r.refund ||
        r.differenceExpenseId !== null
      )
        fail('Invalid direct return settlement.')
      checkEntry('return', r.id, -r.refund, r.cashSessionId, r.createdAt)
      if (entryFor('return-settlement', r.id).length)
        fail('Direct return has an extra cash settlement.')
    } else {
      const p = s.provisionalReturns.find((p) => p.id === r.provisionalId)
      if (
        !p ||
        p.linkedReturnId !== r.id ||
        r.role === 'cashier' ||
        p.createdAt > r.createdAt ||
        sale.createdAt > p.createdAt ||
        p.reason !== r.reason
      ) {
        fail('Invalid provisional return link.')
        continue
      }
      const quantities = new Map<string, number>()
      r.lines.forEach((l) =>
        quantities.set(l.productId, (quantities.get(l.productId) ?? 0) + l.baseQuantity),
      )
      if (
        quantities.size !== p.items.length ||
        p.items.some((i) => quantities.get(i.productId) !== i.baseQuantity)
      )
        fail('Linked goods do not match provisional goods.')
      const difference = p.refundPaid - r.refund
      if (entryFor('return', r.id).length) fail('Provisional return was refunded twice.')
      if (r.settlement === 'cash' && difference) {
        if (r.cashDifference !== difference || r.differenceExpenseId !== null)
          fail('Invalid cash refund difference.')
        checkEntry('return-settlement', r.id, difference, r.cashSessionId, r.createdAt)
      } else if (r.settlement === 'expense' && difference > 0) {
        const expense = s.expenses.find((e) => e.id === r.differenceExpenseId)
        if (
          r.role !== 'owner' ||
          r.cashDifference !== 0 ||
          r.cashSessionId !== null ||
          !expense ||
          expense.relatedReturnId !== r.id ||
          expense.amount !== difference ||
          expense.payment !== 'adjustment'
        )
          fail('Invalid absorbed overpayment.')
      } else if (
        r.settlement !== 'matched' ||
        difference !== 0 ||
        r.cashDifference !== 0 ||
        r.cashSessionId !== null ||
        r.differenceExpenseId !== null
      )
        fail('Invalid matched provisional refund.')
      if (r.settlement !== 'cash' && entryFor('return-settlement', r.id).length)
        fail('Unexpected duplicate refund settlement.')
    }
  }
  for (const p of s.provisionalReturns) {
    if (
      new Set(p.items.map((i) => i.productId)).size !== p.items.length ||
      p.items.some((i) => !s.products.some((product) => product.id === i.productId))
    )
      fail('Invalid provisional goods.')
    checkEntry('provisional-refund', p.id, -p.refundPaid, p.cashSessionId, p.createdAt)
    if (
      p.linkedReturnId &&
      !s.salesReturns.some((r) => r.id === p.linkedReturnId && r.provisionalId === p.id)
    )
      fail('Broken provisional return resolution.')
  }
  for (const expense of s.expenses) {
    if (expense.payment === 'cash') {
      if (expense.kind === 'return-adjustment' || expense.relatedReturnId !== null)
        fail('Invalid cash expense kind.')
      checkEntry('expense', expense.id, -expense.amount, expense.cashSessionId, expense.createdAt)
    } else if (
      expense.role !== 'owner' ||
      expense.kind !== 'return-adjustment' ||
      expense.cashSessionId !== null ||
      !s.salesReturns.some(
        (r) => r.id === expense.relatedReturnId && r.differenceExpenseId === expense.id,
      ) ||
      entryFor('expense', expense.id).length
    )
      fail('Invalid non-cash return adjustment.')
  }
  for (const owner of s.ownerEntries) {
    if (owner.kind === 'medicine-use') {
      const batch = s.batches.find((b) => b.id === owner.batchId)
      if (
        !batch ||
        batch.productId !== owner.productId ||
        !owner.baseQuantity ||
        owner.amount !== batch.costPerBase * owner.baseQuantity ||
        owner.cashSessionId !== null ||
        batch.expiresOn < businessDay(owner.createdAt)
      )
        fail('Invalid owner medicine drawing.')
      if (
        entryFor('owner-withdrawal', owner.id).length ||
        entryFor('owner-deposit', owner.id).length
      )
        fail('Medicine use affected cash.')
    } else {
      if (
        owner.amount <= 0 ||
        owner.productId !== null ||
        owner.batchId !== null ||
        owner.baseQuantity !== null
      )
        fail('Invalid owner cash entry.')
      checkEntry(
        owner.kind === 'cash-deposit' ? 'owner-deposit' : 'owner-withdrawal',
        owner.id,
        owner.kind === 'cash-deposit' ? owner.amount : -owner.amount,
        owner.cashSessionId,
        owner.createdAt,
      )
      if (
        entryFor(owner.kind === 'cash-deposit' ? 'owner-withdrawal' : 'owner-deposit', owner.id)
          .length
      )
        fail('Owner entry affected cash twice.')
    }
  }
  for (const batch of s.batches) {
    const purchase = s.purchases.find((p) => p.id === batch.purchaseId)
    const source = purchase?.lines.find((l) => l.batchId === batch.id)
    if (
      !source ||
      source.productId !== batch.productId ||
      source.costPerBase !== batch.costPerBase
    ) {
      fail('Batch has no original purchase line.')
      continue
    }
    let expected = BigInt(source.baseQuantity)
    let quarantined = 0n
    for (const sale of s.sales)
      for (const line of sale.lines)
        if (line.batchId === batch.id) expected -= BigInt(line.baseQuantity)
    for (const r of s.salesReturns)
      for (const line of r.lines)
        if (line.batchId === batch.id) {
          expected += BigInt(line.baseQuantity)
          if (line.disposition === 'quarantine') quarantined += BigInt(line.baseQuantity)
        }
    for (const drawing of s.ownerEntries)
      if (drawing.batchId === batch.id && drawing.baseQuantity)
        expected -= BigInt(drawing.baseQuantity)
    for (const supplierReturn of s.supplierReturns)
      for (const line of supplierReturn.lines)
        if (line.batchId === batch.id) {
          expected -= BigInt(line.baseQuantity)
          quarantined -= BigInt(line.quarantinedUnits)
        }
    if (expected !== BigInt(batch.stockUnits) || quarantined !== BigInt(batch.quarantinedUnits))
      fail('Batch stock does not reconcile with recorded movements.')
  }
  if (s.cashEntries.some((e) => !sessionIds.has(e.sessionId))) fail('Orphan cash entry.')
}
function businessDay(value: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value))
  const part = (key: string) => parts.find((p) => p.type === key)!.value
  return `${part('year')}-${part('month')}-${part('day')}`
}
