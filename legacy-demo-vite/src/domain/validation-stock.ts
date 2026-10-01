import type { AppState } from './model'

export function validateStockState(s: AppState, fail: (message: string) => void) {
  const ids = new Set(s.suppliers.map((v) => v.id))
  if (
    ids.size !== s.suppliers.length ||
    new Set(s.suppliers.map((v) => v.name.trim().toLowerCase())).size !== s.suppliers.length
  )
    fail('Duplicate supplier profiles.')
  for (const supplier of s.suppliers) {
    if (supplier.openingConfirmed) {
      if (
        !supplier.openingConfirmedAt ||
        !supplier.openingConfirmedBy ||
        supplier.openingConfirmedAt < supplier.createdAt ||
        supplier.openingNote.length < 2
      )
        fail('Invalid confirmed supplier starting balance.')
    } else if (
      supplier.source !== 'legacy' ||
      supplier.openingBalance !== 0 ||
      supplier.openingConfirmedAt !== null ||
      supplier.openingConfirmedBy !== null
    )
      fail('Unreconciled supplier balance must remain explicitly unknown.')
  }
  for (const product of s.products)
    if (product.reorder.preferredSupplierId && !ids.has(product.reorder.preferredSupplierId))
      fail('Unknown preferred reorder supplier.')
  for (const [rows, next] of [
    [s.supplierReturns, s.nextSupplierReturnNumber],
    [s.supplierSettlements, s.nextSupplierSettlementNumber],
  ] as const) {
    if (
      new Set(rows.map((r) => r.id)).size !== rows.length ||
      new Set(rows.map((r) => r.number)).size !== rows.length ||
      rows.some((r) => Number(r.number.split('-')[1]) >= next)
    )
      fail('Invalid supplier document sequence.')
  }
  for (const purchase of s.purchases) {
    if (!ids.has(purchase.supplierId) || purchase.role === 'cashier')
      fail('Invalid purchase supplier or role.')
    if ((purchase.ledgerTreatment === 'account') !== (purchase.ledgerOrder !== null))
      fail('Invalid purchase ledger treatment.')
    if (new Set(purchase.lines.map((l) => l.batchId)).size !== purchase.lines.length)
      fail('Duplicate original purchase lot.')
    for (const line of purchase.lines) {
      const batch = s.batches.find((b) => b.id === line.batchId)
      if (
        !batch ||
        batch.purchaseId !== purchase.id ||
        batch.productId !== line.productId ||
        batch.costPerBase !== line.costPerBase
      )
        fail('Purchase line mismatches its original batch.')
      if (line.stockKind === 'bonus' && (line.costPerBase !== 0 || line.totalCost !== 0))
        fail('Bonus stock must have zero purchase cost.')
    }
  }
  if (
    new Set(
      s.supplierReturns.map((r) => `${r.supplierId}:${r.creditReference.trim().toLowerCase()}`),
    ).size !== s.supplierReturns.length
  )
    fail('Duplicate supplier credit note.')
  for (const r of s.supplierReturns) {
    if (!ids.has(r.supplierId) || new Set(r.lines.map((l) => l.batchId)).size !== r.lines.length)
      fail('Invalid supplier return.')
    if (BigInt(r.totalCredit) !== r.lines.reduce((n, l) => n + BigInt(l.credit), 0n))
      fail('Invalid supplier return credit total.')
    for (const line of r.lines) {
      const b = s.batches.find((b) => b.id === line.batchId)
      const p = s.purchases.find((p) => p.id === b?.purchaseId)
      if (
        !b ||
        !p ||
        p.supplierId !== r.supplierId ||
        line.purchaseId !== p.id ||
        line.productId !== b.productId ||
        line.costPerBase !== b.costPerBase ||
        r.createdAt < b.receivedAt
      ) {
        fail('Supplier return mismatches its original delivery.')
        continue
      }
      if (
        BigInt(line.baseQuantity) !== BigInt(line.shelfUnits) + BigInt(line.quarantinedUnits) ||
        BigInt(line.credit) !== BigInt(line.baseQuantity) * BigInt(line.costPerBase)
      )
        fail('Invalid supplier return unit or credit allocation.')
      const date = day(r.createdAt)
      const remainingDays = Math.round((Date.parse(b.expiresOn) - Date.parse(date)) / 86400000)
      if (r.reason === 'Expired' && b.expiresOn >= date)
        fail('An unexpired batch was labelled expired.')
      // Current configurable thresholds may change later; only the immutable unexpired status is required here.
      if (r.reason === 'Near expiry' && remainingDays < 0)
        fail('An expired batch was labelled near expiry.')
    }
  }
  const ledgerEvents = [
    ...s.purchases
      .filter((p) => p.ledgerTreatment === 'account')
      .map((p) => ({
        order: p.ledgerOrder!,
        supplierId: p.supplierId,
        at: p.createdAt,
        amount: BigInt(p.totalCost),
        settlement: null,
      })),
    ...s.supplierReturns.map((r) => ({
      order: r.ledgerOrder,
      supplierId: r.supplierId,
      at: r.createdAt,
      amount: -BigInt(r.totalCredit),
      settlement: null,
    })),
    ...s.supplierSettlements.map((p) => ({
      order: p.ledgerOrder,
      supplierId: p.supplierId,
      at: p.createdAt,
      amount: BigInt(p.kind === 'payment' ? -p.amount : p.amount),
      settlement: p,
    })),
  ].sort((a, b) => a.order - b.order)
  if (
    new Set(ledgerEvents.map((r) => r.order)).size !== ledgerEvents.length ||
    ledgerEvents.some((r) => r.order >= s.nextSupplierLedgerOrder)
  )
    fail('Invalid supplier ledger event order.')
  const balances = new Map(s.suppliers.map((v) => [v.id, BigInt(v.openingBalance)]))
  const dates = new Map(s.suppliers.map((v) => [v.id, v.createdAt]))
  for (const event of ledgerEvents) {
    const before = balances.get(event.supplierId)
    if (before === undefined) {
      fail('Supplier ledger has an unknown account.')
      continue
    }
    if (event.at < dates.get(event.supplierId)!) fail('Backdated supplier ledger event.')
    dates.set(event.supplierId, event.at)
    const p = event.settlement
    if (p) {
      const supplier = s.suppliers.find((v) => v.id === p.supplierId)!
      if (
        !supplier.openingConfirmed ||
        BigInt(p.balanceBefore) !== before ||
        (p.kind === 'payment'
          ? before <= 0n || BigInt(p.amount) > before
          : before >= 0n || BigInt(p.amount) > -before)
      )
        fail('Supplier settlement exceeds or mismatches the known balance.')
      const kind = p.kind === 'payment' ? 'supplier-payment' : 'supplier-refund'
      const cash = s.cashEntries.filter((e) => e.kind === kind && e.refId === p.id)
      if (
        cash.length !== 1 ||
        cash[0].amount !== Number(event.amount) ||
        cash[0].sessionId !== p.cashSessionId ||
        cash[0].createdAt !== p.createdAt ||
        cash[0].role !== p.role
      )
        fail('Supplier settlement and drawer cash disagree.')
      if (
        s.cashEntries.some(
          (e) =>
            e.refId === p.id &&
            e.kind === (p.kind === 'payment' ? 'supplier-refund' : 'supplier-payment'),
        )
      )
        fail('Supplier cash was recorded twice.')
    }
    const after = before + event.amount
    if (after > BigInt(Number.MAX_SAFE_INTEGER) || after < -BigInt(Number.MAX_SAFE_INTEGER))
      fail('Supplier balance exceeds the safe monetary range.')
    balances.set(event.supplierId, after)
  }
}
function day(value: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value))
  const get = (k: string) => parts.find((p) => p.type === k)!.value
  return `${get('year')}-${get('month')}-${get('day')}`
}
