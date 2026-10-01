import { describe, expect, it } from 'vitest'
import { type AppState, stateSchema, shiftDate, DEFAULT_EXPIRY } from './model'
import { createSeedState } from './seed'
import {
  receiveStock,
  saleableStock,
  addCartItem,
  completeSale,
  saveSettings,
  parkCart,
  resumeCart,
} from './operations'
import {
  createSupplier,
  editSupplier,
  confirmSupplierBalance,
  supplierBalance,
  supplierLedger,
  recordSupplierReturn,
  quoteSupplierReturn,
  recordSupplierSettlement,
  saveReorderPolicy,
  type SupplierInput,
  type SupplierReturnInput,
  type SettlementInput,
} from './suppliers'
import {
  expiryLevel,
  expiryLots,
  expiryColor,
  reorderLevel,
  reorderRows,
  productSuppliers,
  buildPurchaseOrder,
} from './alerts'
import { expectedCash, openSession, closeCashSession } from './cash'
import { recordSalesReturn, recordProvisionalReturn } from './returns'
import { decodeSnapshot } from '../data/migrations'
import {
  day,
  opened,
  soldAt,
  returnAt,
  linkedAt,
  stockFixture,
  soldFixture,
  toV2,
} from '../../tests/fixtures'

const valid = (s: AppState) => expect(stateSchema.safeParse(s).success).toBe(true)
const vendor = (s: AppState) => s.purchases.at(-1)!.supplierId
const profile: SupplierInput = {
  name: 'New test supplier',
  agency: 'Sample agency',
  phone: '03001234567',
  address: 'Sample address',
  openingBalance: 0,
  openingNote: 'New test account',
  confirmed: true,
}
const returnInput = (s: AppState, units = 2): SupplierReturnInput => ({
  supplierId: vendor(s),
  reason: 'Damaged',
  creditReference: 'CN-SAMPLE-001',
  notes: 'Accepted sample goods',
  confirmed: true,
  requestId: 'supplier-return-request',
  lines: [{ batchId: s.batches.at(-1)!.id, shelfUnits: units, quarantinedUnits: 0 }],
})
const paymentInput = (s: AppState, amount = 10000): SettlementInput => ({
  supplierId: vendor(s),
  kind: 'payment',
  amount,
  reference: 'PAY-SAMPLE-001',
  notes: '',
  confirmed: true,
  requestId: 'supplier-payment-request',
})
function receiveMore(
  s: AppState,
  cost = 500,
  kind: 'standard' | 'bonus' = 'standard',
  expiresOn = '2027-09-30',
) {
  const p = s.products.at(-1)!
  return receiveStock(
    s,
    {
      supplierId: vendor(s),
      supplier: '',
      reference: 'NEW-SAMPLE',
      lines: [
        {
          productId: p.id,
          unit: 'loose',
          quantity: 10,
          batchNumber: `MORE-${s.nextPurchaseNumber}`,
          expiresOn,
          costPerBase: cost,
          pricePerBase: 1000,
          stockKind: kind,
        },
      ],
    },
    'manager',
    soldAt,
  )
}

describe('supplier profiles and exact running accounts', () => {
  it('starts without invented supplier payments, returns or drawer movements', () => {
    const s = createSeedState(day)
    expect(s.suppliers).toHaveLength(2)
    expect(s.supplierReturns).toEqual([])
    expect(s.supplierSettlements).toEqual([])
    expect(s.cashEntries).toEqual([])
    for (const v of s.suppliers)
      expect(supplierBalance(s, v.id)).toBe(
        s.purchases.filter((p) => p.supplierId === v.id).reduce((n, p) => n + p.totalCost, 0),
      )
    valid(s)
  })
  it.each([0, 12000, -9000])(
    'requires explicit confirmation of a %s starting balance, without cash or stock effects',
    (openingBalance) => {
      const f = stockFixture()
      expect(() =>
        createSupplier(f.state, { ...profile, openingBalance, confirmed: false }, 'owner', soldAt),
      ).toThrow(/Confirm/)
      const s = createSupplier(f.state, { ...profile, openingBalance }, 'manager', soldAt)
      expect(supplierBalance(s, s.suppliers.at(-1)!.id)).toBe(openingBalance)
      expect(s.batches).toBe(f.state.batches)
      expect(s.cashEntries).toBe(f.state.cashEntries)
      valid(s)
    },
  )
  it('normalizes duplicate names and validates contact data', () => {
    const s = createSupplier(stockFixture().state, profile, 'owner', soldAt)
    expect(() =>
      createSupplier(s, { ...profile, name: ' new TEST supplier ' }, 'owner', soldAt),
    ).toThrow(/already exists/)
    expect(() =>
      createSupplier(
        s,
        { ...profile, name: 'Other account', phone: 'not a phone' },
        'owner',
        soldAt,
      ),
    ).toThrow()
    expect(() =>
      editSupplier(s, s.suppliers.at(-1)!.id, { ...profile, name: s.suppliers[0].name }, 'manager'),
    ).toThrow(/distinct/)
  })
  it('renames the contact profile without changing original delivery name snapshots', () => {
    const f = stockFixture()
    const before = JSON.stringify(f.state.purchases)
    const s = editSupplier(
      f.state,
      vendor(f.state),
      {
        name: 'Renamed supplier',
        agency: 'Updated agency',
        phone: '+92 300 1234567',
        address: 'Updated sample address',
      },
      'owner',
    )
    expect(JSON.stringify(s.purchases)).toBe(before)
    expect(supplierBalance(s, vendor(s))).toBe(50000)
    valid(s)
  })
  it('posts a purchase once on account, with no purchase expense or automatic cash payment', () => {
    const f = stockFixture()
    const s = receiveMore(f.state)
    expect(supplierBalance(s, vendor(s))).toBe(55000)
    expect(s.cashEntries).toBe(f.state.cashEntries)
    expect(s.expenses).toBe(f.state.expenses)
    expect(s.purchases.at(-1)).toMatchObject({
      ledgerTreatment: 'account',
      number: 'PINV-0004',
      totalCost: 5000,
    })
    expect(supplierLedger(s, vendor(s)).map((r) => r.balance)).toEqual([50000, 55000])
    valid(s)
  })
  it('keeps same-time purchase, credit and payment order deterministic', () => {
    const f = stockFixture()
    let s = receiveMore(f.state)
    s = recordSupplierReturn(s, returnInput(s), 'manager', soldAt)
    s = recordSupplierSettlement(s, paymentInput(s, 10000), 'owner', soldAt)
    expect(supplierLedger(s, vendor(s)).map((r) => [r.kind, r.amount, r.balance])).toEqual([
      ['purchase', 50000, 50000],
      ['purchase', 5000, 55000],
      ['credit', -1000, 54000],
      ['payment', -10000, 44000],
    ])
    valid(s)
  })
  it('does not turn legacy invoice costs into debt, and derives opening from the actual current statement', () => {
    const f = stockFixture()
    let s = decodeSnapshot(JSON.stringify(toV2(f.state))).state
    const supplierId = vendor(s)
    expect(s.suppliers.find((v) => v.id === supplierId)!.openingConfirmed).toBe(false)
    expect(supplierLedger(s, supplierId)).toEqual([])
    expect(() => supplierBalance(s, supplierId)).toThrow(/Historical purchases/)
    expect(() => recordSupplierSettlement(s, paymentInput(s), 'owner', soldAt)).toThrow(
      /carried-forward/,
    )
    s = receiveMore(s)
    s = recordSupplierReturn(s, returnInput(s), 'manager', returnAt)
    s = confirmSupplierBalance(
      s,
      supplierId,
      20000,
      'Current vendor statement checked',
      'manager',
      linkedAt,
      true,
    )
    expect(s.suppliers.find((v) => v.id === supplierId)!.openingBalance).toBe(16000)
    expect(supplierBalance(s, supplierId)).toBe(20000)
    expect(s.purchases.slice(0, 3).every((p) => p.ledgerTreatment === 'legacy-reference')).toBe(
      true,
    )
    expect(s.cashEntries).toEqual([])
    expect(() =>
      confirmSupplierBalance(s, supplierId, 0, 'Edit old opening', 'owner', linkedAt, true),
    ).toThrow(/already confirmed/)
    valid(s)
  })
  it.each([false, true])('rejects unverified or blank-note reconciliation (%s)', (confirmed) => {
    const s = decodeSnapshot(JSON.stringify(toV2(stockFixture().state))).state
    expect(() => confirmSupplierBalance(s, vendor(s), 0, '', 'owner', returnAt, confirmed)).toThrow(
      /Confirm/,
    )
  })
  it('rejects reconciliation before a newly posted movement', () => {
    const s = receiveMore(decodeSnapshot(JSON.stringify(toV2(stockFixture().state))).state)
    expect(() =>
      confirmSupplierBalance(s, vendor(s), 0, 'Statement checked', 'owner', opened, true),
    ).toThrow(/precede/)
  })
})

describe('accepted original-supplier credit notes', () => {
  it('removes exact shelf quantities and credits original cost, preserving invoices and cash', () => {
    const f = stockFixture(500, 700)
    const purchase = JSON.stringify(f.state.purchases)
    const s = recordSupplierReturn(f.state, returnInput(f.state, 3), 'manager', returnAt)
    expect(s.batches.at(-1)!.stockUnits).toBe(97)
    expect(s.supplierReturns[0]).toMatchObject({ number: 'SRET-0001', totalCredit: 1500 })
    expect(s.supplierReturns[0].lines[0]).toMatchObject({
      costPerBase: 500,
      baseQuantity: 3,
      credit: 1500,
      purchaseId: f.batch.purchaseId,
    })
    expect(supplierBalance(s, vendor(s))).toBe(48500)
    expect(s.cashEntries).toBe(f.state.cashEntries)
    expect(JSON.stringify(s.purchases)).toBe(purchase)
    valid(s)
  })
  it('returns separately selected damaged quarantine and shelf units without reviving quarantined stock', () => {
    const f = soldFixture()
    let s = recordSalesReturn(
      f.state,
      {
        saleId: f.sale.id,
        reason: 'Customer change',
        notes: '',
        confirmed: true,
        lines: [{ saleLineIndex: 0, baseQuantity: 4, disposition: 'quarantine' }],
      },
      'cashier',
      returnAt,
    )
    const beforeCash = s.cashEntries
    const beforeSale = s.sales
    const input = returnInput(s)
    input.lines = [{ batchId: f.batch.id, shelfUnits: 2, quarantinedUnits: 3 }]
    s = recordSupplierReturn(s, input, 'owner', linkedAt)
    expect(s.batches.at(-1)).toMatchObject({ stockUnits: 89, quarantinedUnits: 1 })
    expect(saleableStock(s, f.product.id, day)).toBe(88)
    expect(s.supplierReturns[0].totalCredit).toBe(2500)
    expect(s.cashEntries).toBe(beforeCash)
    expect(s.sales).toBe(beforeSale)
    valid(s)
  })
  it('can return expired goods only after their printed expiry date', () => {
    const f = stockFixture()
    const onDate = receiveMore(f.state, 500, 'standard', day)
    const input = { ...returnInput(onDate, 1), reason: 'Expired' as const }
    expect(() => quoteSupplierReturn(onDate, input, day)).toThrow(/valid through/)
    const expired = receiveMore(f.state, 500, 'standard', shiftDate(day, -1))
    const s = recordSupplierReturn(
      expired,
      { ...returnInput(expired, 1), reason: 'Expired' },
      'owner',
      returnAt,
    )
    expect(s.supplierReturns[0].totalCredit).toBe(500)
    expect(saleableStock(s, f.product.id, day)).toBe(100)
    valid(s)
  })
  it('accepts unexpired alert-window returns, but not expired or beyond-window batches under Near expiry', () => {
    const f = stockFixture()
    const s = recordSupplierReturn(
      f.state,
      { ...returnInput(f.state), reason: 'Near expiry' },
      'manager',
      returnAt,
    )
    valid(s)
    for (const expiresOn of [shiftDate(day, -1), shiftDate(day, 366)]) {
      const other = receiveMore(f.state, 500, 'standard', expiresOn)
      expect(() =>
        quoteSupplierReturn(other, { ...returnInput(other), reason: 'Near expiry' }, day),
      ).toThrow(/configured alert window/)
    }
  })
  it('never lets a different supplier claim a batch from the original supplier', () => {
    const f = stockFixture()
    expect(() =>
      recordSupplierReturn(
        f.state,
        { ...returnInput(f.state), supplierId: f.state.suppliers[0].id },
        'owner',
        returnAt,
      ),
    ).toThrow(/original delivery/)
  })
  it.each([
    { shelfUnits: 101, quarantinedUnits: 0 },
    { shelfUnits: 0, quarantinedUnits: 1 },
    { shelfUnits: -1, quarantinedUnits: 0 },
    { shelfUnits: 0.5, quarantinedUnits: 0 },
    { shelfUnits: 0, quarantinedUnits: 0 },
    { shelfUnits: 1, quarantinedUnits: NaN },
  ])('rejects impossible or non-whole return quantities %j', (qty) => {
    const f = stockFixture()
    expect(() =>
      recordSupplierReturn(
        f.state,
        { ...returnInput(f.state), lines: [{ batchId: f.batch.id, ...qty }] },
        'owner',
        returnAt,
      ),
    ).toThrow(/quantities/)
  })
  it('requires explicit acceptance, distinct batches and credit reference', () => {
    const f = stockFixture()
    const input = returnInput(f.state)
    expect(() =>
      recordSupplierReturn(f.state, { ...input, confirmed: false }, 'owner', returnAt),
    ).toThrow(/accepted/)
    expect(() =>
      recordSupplierReturn(f.state, { ...input, creditReference: '' }, 'owner', returnAt),
    ).toThrow(/reference/)
    expect(() =>
      recordSupplierReturn(
        f.state,
        { ...input, lines: [...input.lines, ...input.lines] },
        'owner',
        returnAt,
      ),
    ).toThrow(/distinct/)
    expect(() => recordSupplierReturn(f.state, { ...input, lines: [] }, 'owner', returnAt)).toThrow(
      /distinct/,
    )
    expect(() => recordSupplierReturn(f.state, input, 'owner', '2026-09-29T08:00:00.000Z')).toThrow(
      /precede/,
    )
  })
  it('blocks request retries and a case/space-equivalent supplier credit reference', () => {
    const f = stockFixture()
    const input = returnInput(f.state)
    const s = recordSupplierReturn(f.state, input, 'owner', returnAt)
    expect(() => recordSupplierReturn(s, input, 'owner', linkedAt)).toThrow(/already recorded/)
    expect(() =>
      recordSupplierReturn(
        s,
        { ...input, requestId: 'another-request', creditReference: ' cn-sample-001 ' },
        'owner',
        linkedAt,
      ),
    ).toThrow(/already recorded/)
  })
  it('uses an existing vendor credit once when the next invoice posts, without an extra cash deduction', () => {
    const f = stockFixture()
    let s = recordSupplierSettlement(f.state, paymentInput(f.state, 50000), 'owner', soldAt)
    s = recordSupplierReturn(s, returnInput(s, 4), 'manager', soldAt)
    expect(supplierBalance(s, vendor(s))).toBe(-2000)
    const cash = s.cashEntries
    s = receiveMore(s)
    expect(supplierBalance(s, vendor(s))).toBe(3000)
    expect(s.purchases.at(-1)!.totalCost).toBe(5000)
    expect(s.supplierReturns).toHaveLength(1)
    expect(s.cashEntries).toBe(cash)
    valid(s)
  })
  it('does not assign unknown-batch provisional customer goods to a guessed supplier', () => {
    const f = stockFixture()
    const s = recordProvisionalReturn(
      f.state,
      {
        items: [{ productId: f.product.id, baseQuantity: 2 }],
        refundPaid: 1400,
        phone: '',
        reason: 'Customer change',
        notes: '',
        confirmed: true,
      },
      'cashier',
      soldAt,
    )
    expect(s.batches).toBe(f.state.batches)
    const input = returnInput(s)
    input.lines[0] = { batchId: s.provisionalReturns[0].id, shelfUnits: 1, quarantinedUnits: 0 }
    expect(() => recordSupplierReturn(s, input, 'owner', returnAt)).toThrow(/original delivery/)
  })
  it('does not reserve held carts, but refuses checkout if the supplier return depleted their original lot', () => {
    const f = stockFixture()
    let s = parkCart(
      addCartItem(f.state, f.product.id, f.batch.id, 'box', 5, day),
      'Held customer',
      soldAt,
    )
    s = recordSupplierReturn(s, returnInput(s, 1), 'owner', returnAt)
    s = resumeCart(s, s.parkedCarts[0].id)
    expect(s.cart[0].batchId).toBe(f.batch.id)
    expect(() => completeSale(s, 100000, 'owner', day, linkedAt)).toThrow(/Not enough stock/)
    valid(s)
  })
})

describe('supplier cash settlements', () => {
  it('posts exactly one payment and decreases both payable and expected drawer cash', () => {
    const f = stockFixture()
    const s = recordSupplierSettlement(f.state, paymentInput(f.state), 'manager', returnAt)
    expect(supplierBalance(s, vendor(s))).toBe(40000)
    expect(expectedCash(s, openSession(s)!.id)).toBe(90000)
    expect(s.cashEntries[0]).toMatchObject({
      kind: 'supplier-payment',
      amount: -10000,
      refId: s.supplierSettlements[0].id,
      role: 'manager',
    })
    expect(s.supplierSettlements[0]).toMatchObject({ number: 'SPAY-0001', balanceBefore: 50000 })
    expect(s.purchases).toBe(f.state.purchases)
    valid(s)
  })
  it('posts an actual received vendor refund against credit, not another return credit', () => {
    const f = stockFixture()
    let s = recordSupplierSettlement(f.state, paymentInput(f.state, 50000), 'owner', soldAt)
    s = recordSupplierReturn(s, returnInput(s, 4), 'owner', returnAt)
    s = recordSupplierSettlement(
      s,
      {
        ...paymentInput(s, 1000),
        requestId: 'refund-request',
        kind: 'refund',
        reference: 'VENDOR-REFUND',
      },
      'manager',
      linkedAt,
    )
    expect(supplierBalance(s, vendor(s))).toBe(-1000)
    expect(expectedCash(s, openSession(s)!.id)).toBe(51000)
    expect(s.cashEntries.at(-1)!.kind).toBe('supplier-refund')
    expect(s.supplierReturns[0].totalCredit).toBe(2000)
    const closed = closeCashSession(s, 51000, '', 'owner', '2026-09-30T12:00:00.000Z')
    expect(closed.cashSessions[0].variance).toBe(0)
    valid(closed)
  })
  it.each([0, -1, 1.5, 50001, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid or excessive payment %s',
    (amount) => {
      const f = stockFixture()
      expect(() =>
        recordSupplierSettlement(f.state, paymentInput(f.state, amount), 'owner', returnAt),
      ).toThrow()
    },
  )
  it('cannot spend more than physical drawer cash or refund against a payable', () => {
    const f = stockFixture(500, 700, 5000)
    expect(() =>
      recordSupplierSettlement(f.state, paymentInput(f.state, 10000), 'owner', returnAt),
    ).toThrow(/cash|drawer/)
    expect(() =>
      recordSupplierSettlement(
        f.state,
        { ...paymentInput(f.state), kind: 'refund' },
        'owner',
        returnAt,
      ),
    ).toThrow(/credit balance/)
  })
  it('requires an open shift, explicit exchange confirmation and a stable request ID', () => {
    const f = stockFixture()
    const input = paymentInput(f.state)
    expect(() =>
      recordSupplierSettlement(f.state, { ...input, confirmed: false }, 'owner', returnAt),
    ).toThrow(/Confirm/)
    const closed = closeCashSession(f.state, 100000, '', 'owner', soldAt)
    expect(() => recordSupplierSettlement(closed, input, 'owner', returnAt)).toThrow(
      /Open a cash shift/,
    )
    const s = recordSupplierSettlement(f.state, input, 'owner', returnAt)
    expect(() => recordSupplierSettlement(s, input, 'owner', linkedAt)).toThrow(/already recorded/)
  })
})

describe('exactly zero-cost sample and bonus lots', () => {
  it('adds converted quantities and retail value, with zero supplier charge and no expense/cash', () => {
    const f = stockFixture()
    const s = receiveMore(f.state, 0, 'bonus')
    expect(s.batches.at(-1)).toMatchObject({ costPerBase: 0, stockUnits: 10, pricePerBase: 1000 })
    expect(s.purchases.at(-1)!.lines[0]).toMatchObject({ stockKind: 'bonus', totalCost: 0 })
    expect(supplierBalance(s, vendor(s))).toBe(50000)
    expect(s.expenses).toBe(f.state.expenses)
    expect(s.cashEntries).toBe(f.state.cashEntries)
    valid(s)
  })
  it('rejects nonzero cost rather than silently changing a supplied value to zero', () => {
    const f = stockFixture()
    expect(() => receiveMore(f.state, 1, 'bonus')).toThrow(/exactly zero/)
  })
  it('returns bonus goods with zero supplier credit, and refunds only the original paid sale amount', () => {
    const f = stockFixture()
    let s = receiveMore(f.state, 0, 'bonus')
    const bonus = s.batches.at(-1)!
    s = completeSale(
      addCartItem(s, f.product.id, bonus.id, 'loose', 2, day),
      5000,
      'cashier',
      day,
      returnAt,
    )
    const sale = s.sales.at(-1)!
    expect(sale.cost).toBe(0)
    expect(sale.total).toBe(2000)
    s = recordSalesReturn(
      s,
      {
        saleId: sale.id,
        reason: 'Customer change',
        notes: '',
        confirmed: true,
        lines: [{ saleLineIndex: 0, baseQuantity: 1, disposition: 'quarantine' }],
      },
      'cashier',
      linkedAt,
    )
    const input = returnInput(s, 1)
    input.lines[0] = { batchId: bonus.id, shelfUnits: 1, quarantinedUnits: 1 }
    const cash = s.cashEntries
    s = recordSupplierReturn(s, input, 'manager', linkedAt)
    expect(s.supplierReturns[0].totalCredit).toBe(0)
    expect(s.batches.at(-1)).toMatchObject({ stockUnits: 7, quarantinedUnits: 0 })
    expect(supplierBalance(s, vendor(s))).toBe(50000)
    expect(s.salesReturns[0].refund).toBe(1000)
    expect(s.cashEntries).toBe(cash)
    valid(s)
  })
})

describe('exclusive adjustable expiry bands', () => {
  it.each([
    [-1, 'expired'],
    [0, 'near'],
    [90, 'near'],
    [91, 'middle'],
    [180, 'middle'],
    [181, 'far'],
    [365, 'far'],
    [366, null],
  ] as const)('classifies %s days as %s exactly once', (days, expected) => {
    const b = { ...stockFixture().batch, expiresOn: shiftDate(day, days) }
    expect(expiryLevel(b, day, DEFAULT_EXPIRY)).toBe(expected)
  })
  it('filters on-hand expiry lists by original supplier, retaining quarantined quantities', () => {
    const f = soldFixture()
    const s = recordSalesReturn(
      f.state,
      {
        saleId: f.sale.id,
        reason: 'Customer change',
        notes: '',
        confirmed: true,
        lines: [{ saleLineIndex: 0, baseQuantity: 2, disposition: 'quarantine' }],
      },
      'cashier',
      returnAt,
    )
    expect(expiryLots(s, day, 'far', vendor(s)).map((b) => b.id)).toEqual([f.batch.id])
    expect(expiryLots(s, day, 'far', s.suppliers[0].id).some((b) => b.id === f.batch.id)).toBe(
      false,
    )
    const all = (['far', 'middle', 'near', 'expired'] as const).flatMap((l) =>
      expiryLots(s, day, l),
    )
    expect(new Set(all.map((b) => b.id)).size).toBe(all.length)
    const input = returnInput(s)
    input.lines[0] = { batchId: f.batch.id, shelfUnits: 90, quarantinedUnits: 2 }
    const removed = recordSupplierReturn(s, input, 'owner', linkedAt)
    expect(removed.batches.at(-1)!.stockUnits).toBe(0)
    expect(expiryLots(removed, day, 'far', vendor(removed))).toEqual([])
    valid(removed)
  })
  it('saves ordered days and three hex colors, and keeps expired color fixed', () => {
    const f = stockFixture()
    const expiry = {
      farDays: 200,
      middleDays: 100,
      nearDays: 10,
      farColor: '#234567',
      middleColor: '#678901',
      nearColor: '#ABCDEF',
    }
    const s = saveSettings(f.state, { ...f.state.settings, expiry }, 'manager')
    expect(expiryColor('far', s.settings.expiry)).toBe('#234567')
    expect(expiryColor('middle', s.settings.expiry)).toBe('#678901')
    expect(expiryColor('near', s.settings.expiry)).toBe('#ABCDEF')
    expect(expiryColor('expired', s.settings.expiry)).toBe('#ad3542')
    expect(expiryLevel(f.batch, day, s.settings.expiry)).toBeNull()
    valid(s)
  })
  it.each([
    { nearDays: 181 },
    { middleDays: 365 },
    { nearDays: -1 },
    { farDays: 3651 },
    { farDays: 300.5 },
    { nearColor: 'red' },
  ])('rejects invalid days/colors %j without changing settings', (change) => {
    const f = stockFixture()
    expect(() =>
      saveSettings(
        f.state,
        { ...f.state.settings, expiry: { ...DEFAULT_EXPIRY, ...change } },
        'owner',
      ),
    ).toThrow()
  })
})

describe('three reorder stages and reviewed WhatsApp drafts', () => {
  it.each([
    [0, 'out'],
    [1, 'critical'],
    [20, 'critical'],
    [21, 'warning'],
    [40, 'warning'],
    [41, null],
  ] as const)('maps %s saleable base units to %s', (available, expected) => {
    const f = stockFixture()
    expect(reorderLevel(f.product, available)).toBe(expected)
  })
  it('excludes expired and quarantined units, not just all on-hand stock', () => {
    const f = soldFixture()
    let s = recordSalesReturn(
      f.state,
      {
        saleId: f.sale.id,
        reason: 'Customer change',
        notes: '',
        confirmed: true,
        lines: [{ saleLineIndex: 0, baseQuantity: 4, disposition: 'quarantine' }],
      },
      'cashier',
      returnAt,
    )
    s = saveReorderPolicy(
      s,
      f.product.id,
      { criticalUnits: 95, warningUnits: 100, targetUnits: 150, preferredSupplierId: vendor(s) },
      'owner',
    )
    const row = reorderRows(s, day, vendor(s)).find((r) => r.product.id === f.product.id)!
    expect(row).toMatchObject({ available: 90, level: 'critical', suggested: 60 })
    const expired = receiveMore(f.state, 500, 'standard', shiftDate(day, -1))
    expect(saleableStock(expired, f.product.id, day)).toBe(90)
    valid(s)
  })
  it('routes unassigned stock by history, but a configured preference overrides other vendors', () => {
    const f = stockFixture()
    let s = receiveStock(
      f.state,
      {
        supplierId: f.state.suppliers[0].id,
        supplier: '',
        reference: '',
        lines: [
          {
            productId: f.product.id,
            unit: 'loose',
            quantity: 1,
            batchNumber: 'SECOND-VENDOR',
            expiresOn: '2028-09-30',
            costPerBase: 500,
            pricePerBase: 1000,
          },
        ],
      },
      'owner',
      soldAt,
    )
    s = saveReorderPolicy(
      s,
      f.product.id,
      { criticalUnits: 120, warningUnits: 140, targetUnits: 160, preferredSupplierId: null },
      'manager',
    )
    expect(new Set(productSuppliers(s, f.product.id))).toEqual(
      new Set([vendor(f.state), f.state.suppliers[0].id]),
    )
    expect(reorderRows(s, day, vendor(f.state)).some((r) => r.product.id === f.product.id)).toBe(
      true,
    )
    s = saveReorderPolicy(
      s,
      f.product.id,
      { ...s.products.at(-1)!.reorder, preferredSupplierId: f.state.suppliers[0].id },
      'owner',
    )
    expect(productSuppliers(s, f.product.id)).toEqual([f.state.suppliers[0].id])
    expect(reorderRows(s, day, vendor(f.state)).some((r) => r.product.id === f.product.id)).toBe(
      false,
    )
    valid(s)
  })
  it('validates ordered whole-number thresholds and known supplier assignments', () => {
    const f = stockFixture()
    const policy = f.state.products.at(-1)!.reorder
    for (const input of [
      { ...policy, criticalUnits: 40 },
      { ...policy, targetUnits: 40 },
      { ...policy, warningUnits: 2.5 },
      { ...policy, preferredSupplierId: 'missing' },
    ])
      expect(() => saveReorderPolicy(f.state, f.product.id, input, 'owner')).toThrow()
  })
  it('builds a supplier-specific URL with normalized phone and exact encoded message, without mutating records', () => {
    const f = stockFixture()
    const s = editSupplier(
      f.state,
      vendor(f.state),
      { ...profile, name: 'Sample A & B', phone: '0300 1234567' },
      'owner',
    )
    const before = JSON.stringify(s)
    const draft = buildPurchaseOrder(
      s,
      vendor(s),
      [{ productId: f.product.id, baseQuantity: 1234 }],
      'manager',
      day,
    )
    const url = new URL(draft.whatsappWebUrl!)
    expect(url.origin + url.pathname).toBe('https://web.whatsapp.com/send')
    expect(url.searchParams.get('phone')).toBe('923001234567')
    expect(url.searchParams.get('text')).toBe(draft.text)
    expect(draft.text).toContain('1,234 tablets (base units)')
    expect(draft.text).toContain('Supplier: Sample A & B')
    expect(draft.text).toContain('does not receive stock')
    expect(JSON.stringify(s)).toBe(before)
  })
  it('supports copy-only draft text when a WhatsApp destination cannot be normalized', () => {
    const f = stockFixture()
    const draft = buildPurchaseOrder(
      f.state,
      vendor(f.state),
      [{ productId: f.product.id, baseQuantity: 1 }],
      'owner',
      day,
    )
    expect(draft.whatsappWebUrl).toBeNull()
    expect(draft.text).toContain('1 tablet (base units)')
  })
  it('refuses cross-supplier, duplicate, zero, fractional and excessive order quantities', () => {
    const f = stockFixture()
    const line = { productId: f.product.id, baseQuantity: 1 }
    expect(() =>
      buildPurchaseOrder(f.state, f.state.suppliers[0].id, [line], 'owner', day),
    ).toThrow(/assigned/)
    expect(() => buildPurchaseOrder(f.state, vendor(f.state), [line, line], 'owner', day)).toThrow(
      /distinct/,
    )
    for (const baseQuantity of [0, -1, 1.5, 1_000_000_000_001])
      expect(() =>
        buildPurchaseOrder(f.state, vendor(f.state), [{ ...line, baseQuantity }], 'owner', day),
      ).toThrow(/positive whole/)
  })
})

describe('management-only stock/account commands and stored-data integrity', () => {
  it.each(['create', 'edit', 'opening', 'return', 'payment', 'policy', 'order'] as const)(
    'rejects cashier %s before any mutation',
    (command) => {
      const f = stockFixture()
      const commands = {
        create: () => createSupplier(f.state, profile, 'cashier', soldAt),
        edit: () => editSupplier(f.state, vendor(f.state), profile, 'cashier'),
        opening: () =>
          confirmSupplierBalance(f.state, vendor(f.state), 0, 'checked', 'cashier', returnAt, true),
        return: () => recordSupplierReturn(f.state, returnInput(f.state), 'cashier', returnAt),
        payment: () =>
          recordSupplierSettlement(f.state, paymentInput(f.state), 'cashier', returnAt),
        policy: () => saveReorderPolicy(f.state, f.product.id, f.product.reorder, 'cashier'),
        order: () =>
          buildPurchaseOrder(
            f.state,
            vendor(f.state),
            [{ productId: f.product.id, baseQuantity: 1 }],
            'cashier',
            day,
          ),
      }
      const before = JSON.stringify(f.state)
      expect(commands[command]).toThrow(/Owner or Manager/)
      expect(JSON.stringify(f.state)).toBe(before)
    },
  )
  it.each([
    'foreign-supplier',
    'credit-cost',
    'stock-total',
    'quarantine-total',
    'duplicate-credit',
    'ledger-order',
    'bonus-cost',
    'cash-counterpart',
    'opening-state',
    'preferred-vendor',
    'balance-before',
    'cash-amount',
  ] as const)('rejects persisted corruption: %s', (damage) => {
    const f = stockFixture()
    let s = recordSupplierReturn(f.state, returnInput(f.state), 'owner', soldAt)
    s = recordSupplierSettlement(s, paymentInput(s), 'manager', returnAt)
    valid(s)
    const bad = structuredClone(s)
    if (damage === 'foreign-supplier') bad.supplierReturns[0].supplierId = bad.suppliers[0].id
    if (damage === 'credit-cost') bad.supplierReturns[0].lines[0].costPerBase += 1
    if (damage === 'stock-total') bad.batches.at(-1)!.stockUnits += 1
    if (damage === 'quarantine-total') bad.batches.at(-1)!.quarantinedUnits += 1
    if (damage === 'duplicate-credit')
      bad.supplierReturns.push({
        ...bad.supplierReturns[0],
        id: 'other-credit',
        number: 'SRET-0002',
        ledgerOrder: bad.nextSupplierLedgerOrder++,
      })
    if (damage === 'ledger-order')
      bad.supplierReturns[0].ledgerOrder = bad.supplierSettlements[0].ledgerOrder
    if (damage === 'bonus-cost') bad.purchases.at(-1)!.lines[0].stockKind = 'bonus'
    if (damage === 'cash-counterpart') bad.cashEntries = []
    if (damage === 'opening-state') bad.suppliers.at(-1)!.openingConfirmed = false
    if (damage === 'preferred-vendor')
      bad.products.at(-1)!.reorder.preferredSupplierId = 'not-found'
    if (damage === 'balance-before') bad.supplierSettlements[0].balanceBefore += 1
    if (damage === 'cash-amount') bad.cashEntries[0].amount -= 1
    expect(stateSchema.safeParse(bad).success).toBe(false)
  })
})
