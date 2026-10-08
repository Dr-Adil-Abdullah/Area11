import { describe, expect, it } from 'vitest'
import { createSeedState } from './seed'
import { type AppState, type Role, stateSchema, usableUnits, parsePercent } from './model'
import {
  addCartItem,
  cartDetails,
  completeSale,
  parkCart,
  resumeCart,
  saveSettings,
  setCartDiscount,
  setCartPhone,
  sortedBatches,
  saleableStock,
} from './operations'
import {
  closeCashSession,
  expectedCash,
  handoverCashSession,
  openCashSession,
  openSession,
} from './cash'
import { recordExpense, recordOwnerCash, recordOwnerMedicine, ownerBalance } from './accounts'
import {
  recordSalesReturn,
  recordProvisionalReturn,
  linkProvisionalReturn,
  quoteReturn,
  returnedUnits,
  lookupSales,
  type ReturnInput,
} from './returns'
import { discountAmount, paidByLine, partialRefund, ratioFloor } from './arithmetic'
import {
  day,
  opened,
  soldAt,
  returnAt,
  linkedAt,
  stockFixture,
  soldFixture,
} from '../../tests/fixtures'

const valid = (state: AppState) => expect(stateSchema.safeParse(state).success).toBe(true)
const direct = (
  saleId: string,
  units = 1,
  disposition: 'quarantine' | 'restock' = 'quarantine',
): ReturnInput => ({
  saleId,
  reason: 'Customer change',
  notes: '',
  confirmed: true,
  lines: [{ saleLineIndex: 0, baseQuantity: units, disposition }],
})
function pendingFixture(paid = 7000, units = 10) {
  const f = soldFixture()
  const state = recordProvisionalReturn(
    f.state,
    {
      items: [{ productId: f.product.id, baseQuantity: units }],
      refundPaid: paid,
      phone: '03001234567',
      reason: 'Customer change',
      notes: 'Sample bill missing',
      confirmed: true,
    },
    'cashier',
    returnAt,
  )
  return { ...f, before: f.state, state, pending: state.provisionalReturns.at(-1)! }
}

describe('cash shift controls', () => {
  it('starts without a fabricated shift or float and requires a shift for sales', () => {
    const fresh = createSeedState(day)
    expect(fresh.cashSessions).toHaveLength(0)
    expect(fresh.cashEntries).toHaveLength(0)
    const p = fresh.products[0]
    const b = sortedBatches(fresh, p.id, day, true)[0]
    expect(() =>
      completeSale(addCartItem(fresh, p.id, b.id, 'loose', 1, day), 100000, 'cashier', day, soldAt),
    ).toThrow(/Open a cash shift/)
  })
  it('records net sale cash, not tendered cash, and cannot open a second drawer', () => {
    const { state, sale } = soldFixture()
    expect(sale.tendered).toBe(100000)
    expect(sale.total).toBe(7000)
    expect(sale.change).toBe(93000)
    expect(expectedCash(state, openSession(state)!.id)).toBe(107000)
    expect(state.cashEntries[0].amount).toBe(7000)
    expect(() => openCashSession(state, 0, 'Second operator', 'manager', returnAt)).toThrow(
      /already open/,
    )
    valid(state)
  })
  it.each([-1, NaN, 1.2])('rejects an invalid float %s', (amount) => {
    expect(() =>
      openCashSession(createSeedState(day), amount, 'Operator', 'cashier', opened),
    ).toThrow(/cash amount/)
  })
  it('closes with counted cash, immutable expected snapshot, variance and a required explanation', () => {
    const { state } = soldFixture()
    expect(() => closeCashSession(state, 106000, '', 'cashier', returnAt)).toThrow(/Explain/)
    const closed = closeCashSession(state, 106000, 'Sample Rs 10 shortage', 'cashier', returnAt)
    expect(openSession(closed)).toBeUndefined()
    expect(closed.cashSessions[0]).toMatchObject({
      status: 'closed',
      expectedAtClose: 107000,
      counted: 106000,
      variance: -1000,
    })
    valid(closed)
    expect(() =>
      recordExpense(
        closed,
        { amount: 100, category: 'Tea', kind: 'daily', notes: '' },
        'manager',
        linkedAt,
      ),
    ).toThrow(/Open a cash shift/)
  })
  it('handover carries actual count into the new opening, not expected cash', () => {
    const { state } = soldFixture()
    const next = handoverCashSession(
      state,
      106000,
      'Rs 10 shortage',
      'Evening operator',
      'manager',
      returnAt,
    )
    expect(next.cashSessions[0].handoverTo).toBe(next.cashSessions[1].id)
    expect(next.cashSessions[1]).toMatchObject({
      number: 'SHIFT-0002',
      opening: 106000,
      previousSessionId: state.cashSessions[0].id,
    })
    expect(expectedCash(next, openSession(next)!.id)).toBe(106000)
    valid(next)
    expect(() => handoverCashSession(state, 107000, '', '', 'owner', returnAt)).toThrow(
      /operator label/,
    )
    expect(state.cashSessions).toHaveLength(1)
    expect(state.cashSessions[0].status).toBe('open')
  })
  it('prevents negative counted cash and backdated cash transactions', () => {
    const { state } = stockFixture()
    expect(() => closeCashSession(state, -1, '', 'owner', returnAt)).toThrow(/cash amount/)
    expect(() => closeCashSession(state, 100000, '', 'owner', '2026-09-29T00:00:00.000Z')).toThrow(
      /Closing time/,
    )
    expect(() =>
      recordOwnerCash(
        state,
        'cash-deposit',
        100,
        'Sample credit',
        'owner',
        '2026-09-29T00:00:00.000Z',
      ),
    ).toThrow(/precede/)
  })
})

describe('discount cost floor and snapshot policy', () => {
  it('implements master examples: Rs 200 cost / Rs 300 retail → 290 margin or 270 retail', () => {
    const f = stockFixture(20000, 30000)
    let state = addCartItem(f.state, f.product.id, f.batch.id, 'loose', 1, day)
    state = setCartDiscount(state, 1000, 'cashier', day)
    expect(cartDetails(state, day).total).toBe(29000)
    state = completeSale(state, 30000, 'cashier', day, soldAt)
    expect(state.sales[0]).toMatchObject({
      grossSubtotal: 30000,
      discount: 1000,
      subtotal: 29000,
      discountBps: 1000,
      discountMode: 'margin',
    })
    valid(state)
    const retail = setCartDiscount(
      addCartItem(
        saveSettings(f.state, { ...f.state.settings, discountMode: 'retail' }, 'manager'),
        f.product.id,
        f.batch.id,
        'loose',
        1,
        day,
      ),
      1000,
      'cashier',
      day,
    )
    expect(cartDetails(retail, day).total).toBe(27000)
  })
  it.each(['owner', 'manager', 'cashier'] as Role[])(
    'prevents below-cost retail discounts for %s',
    (role) => {
      const f = stockFixture(20000, 21000)
      const configured = saveSettings(
        f.state,
        { ...f.state.settings, discountMode: 'retail' },
        'owner',
      )
      const cart = addCartItem(configured, f.product.id, f.batch.id, 'loose', 1, day)
      expect(() => setCartDiscount(cart, 1000, role, day)).toThrow(/below purchase cost/)
    },
  )
  it('enforces Owner/Manager-set cashier limits when applying and again at checkout', () => {
    const f = stockFixture()
    let state = addCartItem(f.state, f.product.id, f.batch.id, 'strip', 1, day)
    expect(() => setCartDiscount(state, 1001, 'cashier', day)).toThrow(/cashier limit/)
    state = setCartDiscount(state, 5000, 'manager', day)
    expect(() => completeSale(state, 100000, 'cashier', day, soldAt)).toThrow(
      /cashier discount limit/,
    )
    const settings = { ...state.settings, cashierMaxDiscountBps: 5000 }
    expect(() => saveSettings(state, settings, 'cashier')).toThrow(/Owner or Manager/)
    state = saveSettings(state, settings, 'manager')
    valid(completeSale(state, 100000, 'cashier', day, soldAt))
  })
  it('allows a 100% margin discount only down to cost and still skips unsafe rounding', () => {
    const f = stockFixture(543, 700)
    const state = setCartDiscount(
      addCartItem(f.state, f.product.id, f.batch.id, 'loose', 1, day),
      10000,
      'owner',
      day,
    )
    const quote = cartDetails(state, day)
    expect(quote.total).toBe(543)
    expect(quote.roundingSkipped).toBe(true)
    valid(completeSale(state, 1000, 'owner', day, soldAt))
  })
  it('preserves exact held batch, percentage, mode and phone across a settings change', () => {
    const f = stockFixture()
    let state = setCartPhone(
      setCartDiscount(
        addCartItem(f.state, f.product.id, f.batch.id, 'strip', 1, day),
        5000,
        'owner',
        day,
      ),
      '+92 300 1234567',
    )
    const expected = cartDetails(state, day)
    state = parkCart(state, 'Sample waiting customer', soldAt)
    state = saveSettings(state, { ...state.settings, discountMode: 'retail' }, 'manager')
    expect(state.cartDiscountMode).toBe('retail')
    state = resumeCart(state, state.parkedCarts[0].id)
    expect(state.cart[0].batchId).toBe(f.batch.id)
    expect(state.cartDiscountMode).toBe('margin')
    expect(state.cartDiscountBps).toBe(5000)
    expect(state.cartPhone).toBe('+92 300 1234567')
    expect(cartDetails(state, day)).toEqual(expected)
    expect(() => completeSale(state, 100000, 'cashier', day, soldAt)).toThrow(
      /cashier discount limit/,
    )
    valid(state)
  })
  it('parses percentages exactly and never uses floating-point products for discounts', () => {
    expect(parsePercent('12.34')).toBe(1234)
    expect(discountAmount(30000, 20000, 1234, 'margin')).toBe(1234)
    expect(ratioFloor(9007199254740000, 9999, 10000)).toBe(
      Number((9007199254740000n * 9999n) / 10000n),
    )
    for (const input of ['101', '-1', '1.234', '', 'NaN'])
      expect(() => parsePercent(input)).toThrow()
  })
})

describe('linked returns and safe stock', () => {
  it('returns base units to the exact original lot; quarantine is never saleable', () => {
    const f = soldFixture()
    const state = recordSalesReturn(f.state, direct(f.sale.id, 3), 'cashier', returnAt)
    const b = state.batches.find((b) => b.id === f.batch.id)!
    expect(b.stockUnits).toBe(93)
    expect(b.quarantinedUnits).toBe(3)
    expect(usableUnits(b)).toBe(90)
    expect(state.salesReturns[0].refund).toBe(2100)
    expect(expectedCash(state, openSession(state)!.id)).toBe(104900)
    expect(state.sales[0]).toEqual(f.sale)
    valid(state)
    expect(() => addCartItem(state, f.product.id, b.id, 'loose', 91, day)).toThrow(/enough/)
    expect(saleableStock(state, f.product.id, day)).toBe(90)
  })
  it('only management may explicitly restock inspected unexpired goods', () => {
    const f = soldFixture()
    expect(() =>
      recordSalesReturn(f.state, direct(f.sale.id, 10, 'restock'), 'cashier', returnAt),
    ).toThrow(/Only Owner\/Manager/)
    const state = recordSalesReturn(f.state, direct(f.sale.id, 10, 'restock'), 'manager', returnAt)
    expect(state.batches.find((b) => b.id === f.batch.id)).toMatchObject({
      stockUnits: 100,
      quarantinedUnits: 0,
    })
    valid(state)
  })
  it.each(['Damaged', 'Expired'] as const)('never restocks %s goods even for Owner', (reason) => {
    const f = soldFixture()
    expect(() =>
      recordSalesReturn(f.state, { ...direct(f.sale.id, 1, 'restock'), reason }, 'owner', returnAt),
    ).toThrow(/quarantined/)
    valid(recordSalesReturn(f.state, { ...direct(f.sale.id), reason }, 'owner', returnAt))
  })
  it('blocks restock when the original lot has expired since its sale', () => {
    const f = soldFixture()
    const later = '2027-10-01T10:00:00.000Z'
    expect(() =>
      recordSalesReturn(f.state, direct(f.sale.id, 1, 'restock'), 'owner', later),
    ).toThrow(/quarantined/)
    valid(recordSalesReturn(f.state, direct(f.sale.id), 'manager', later))
  })
  it('caps cumulative returns and prevents duplicate original line selections', () => {
    const f = soldFixture()
    const state = recordSalesReturn(f.state, direct(f.sale.id, 8), 'owner', returnAt)
    expect(returnedUnits(state, f.sale.id, 0)).toBe(8)
    expect(() => recordSalesReturn(state, direct(f.sale.id, 3), 'manager', linkedAt)).toThrow(
      /unreturned/,
    )
    expect(() =>
      quoteReturn(
        f.state,
        f.sale.id,
        [...direct(f.sale.id).lines, ...direct(f.sale.id).lines],
        'Customer change',
        'owner',
        day,
      ),
    ).toThrow(/twice/)
    valid(recordSalesReturn(state, direct(f.sale.id, 2), 'manager', linkedAt))
  })
  it.each([0, -1, 1.5, 11])('rejects invalid/excess returned units %s', (quantity) => {
    const f = soldFixture()
    expect(() =>
      recordSalesReturn(f.state, direct(f.sale.id, quantity), 'owner', returnAt),
    ).toThrow(/unreturned/)
  })
  it('requires confirmation, custom reason details and a sufficient current drawer', () => {
    const f = soldFixture()
    expect(() =>
      recordSalesReturn(f.state, { ...direct(f.sale.id), confirmed: false }, 'owner', returnAt),
    ).toThrow(/Confirm/)
    expect(() =>
      recordSalesReturn(f.state, { ...direct(f.sale.id), reason: 'Other' }, 'owner', returnAt),
    ).toThrow(/Describe/)
    const emptied = recordOwnerCash(
      f.state,
      'cash-withdrawal',
      107000,
      'Sample full cash drawing',
      'owner',
      returnAt,
    )
    expect(() => recordSalesReturn(emptied, direct(f.sale.id), 'owner', linkedAt)).toThrow(
      /Not enough cash/,
    )
  })
  it('refunds original discounted/rounded cash even if the current retail price changes', () => {
    const f = stockFixture(20000, 30000)
    const cart = setCartDiscount(
      addCartItem(f.state, f.product.id, f.batch.id, 'loose', 1, day),
      1000,
      'owner',
      day,
    )
    const sold = completeSale(cart, 30000, 'owner', day, soldAt)
    const repriced = {
      ...sold,
      batches: sold.batches.map((b) => (b.id === f.batch.id ? { ...b, pricePerBase: 50000 } : b)),
    }
    const returned = recordSalesReturn(repriced, direct(sold.sales[0].id), 'manager', returnAt)
    expect(returned.salesReturns[0].refund).toBe(29000)
    expect(returned.sales[0]).toEqual(sold.sales[0])
    valid(returned)
  })
  it('repeated partial returns preserve every paisa and cannot over-refund a rounded bill', () => {
    const f = stockFixture()
    let state = completeSale(
      addCartItem(f.state, f.product.id, f.batch.id, 'loose', 3, day),
      3000,
      'owner',
      day,
      soldAt,
    )
    const sale = state.sales[0]
    expect(sale.total).toBe(2000)
    for (let i = 0; i < 3; i++) {
      state = recordSalesReturn(state, direct(sale.id), 'manager', returnAt)
      valid(state)
    }
    expect(state.salesReturns.map((r) => r.refund)).toEqual([666, 667, 667])
    expect(state.salesReturns.reduce((n, r) => n + r.refund, 0)).toBe(sale.total)
    expect(() => recordSalesReturn(state, direct(sale.id), 'owner', linkedAt)).toThrow(/unreturned/)
  })
  it('allocates rounding out of margin, keeping at-cost lines at cost; full return equals collected cash', () => {
    const f = stockFixture(10000, 10000)
    const other = f.state.products[0]
    const batch = sortedBatches(f.state, other.id, day, true)[0]
    let state = addCartItem(f.state, f.product.id, f.batch.id, 'loose', 1, day)
    state = addCartItem(state, other.id, batch.id, 'loose', 1, day)
    state = completeSale(state, 20000, 'owner', day, soldAt)
    const sale = state.sales[0]
    const paid = paidByLine(sale)
    expect(paid[0]).toBe(10000)
    expect(paid.reduce((n, p) => n + p, 0)).toBe(sale.total)
    expect(paid.every((p, i) => p >= sale.lines[i].cost && p <= sale.lines[i].total)).toBe(true)
    const selections = sale.lines.map((l, i) => ({
      saleLineIndex: i,
      baseQuantity: l.baseQuantity,
      disposition: 'quarantine' as const,
    }))
    state = recordSalesReturn(state, { ...direct(sale.id), lines: selections }, 'manager', returnAt)
    expect(state.salesReturns[0].refund).toBe(sale.total)
    valid(state)
  })
  it('property regression: allocated cash and all partial refunds exactly conserve collected totals', () => {
    const template = soldFixture().sale
    for (let a = 1; a <= 9; a++)
      for (let b = 1; b <= 7; b++) {
        const lines = [
          { ...template.lines[0], baseQuantity: a, cost: a * 101, total: a * 227 },
          { ...template.lines[0], baseQuantity: b, cost: b * 93, total: b * 317 },
        ]
        const cost = lines.reduce((n, l) => n + l.cost, 0),
          subtotal = lines.reduce((n, l) => n + l.total, 0)
        const floor = Math.floor(subtotal / 1000) * 1000
        const sale = { ...template, lines, cost, subtotal, total: floor < cost ? subtotal : floor }
        const paid = paidByLine(sale)
        expect(paid.reduce((n, p) => n + p, 0)).toBe(sale.total)
        lines.forEach((l, i) => {
          expect(paid[i]).toBeGreaterThanOrEqual(l.cost)
          expect(paid[i]).toBeLessThanOrEqual(l.total)
          expect(
            Array.from({ length: l.baseQuantity }, (_, old) =>
              partialRefund(paid[i], l.baseQuantity, old, 1),
            ).reduce((n, p) => n + p, 0),
          ).toBe(paid[i])
        })
      }
  })
})

describe('provisional queue and exact reconciliation', () => {
  it('refunds cash now, holds unknown goods outside stock and keeps a durable unresolved record', () => {
    const f = pendingFixture()
    expect(f.state.batches).toEqual(f.before.batches)
    expect(f.pending).toMatchObject({ number: 'PR-0001', linkedReturnId: null, refundPaid: 7000 })
    expect(expectedCash(f.state, openSession(f.state)!.id)).toBe(100000)
    expect(JSON.parse(JSON.stringify(f.state)).provisionalReturns[0].linkedReturnId).toBeNull()
    valid(f.state)
  })
  it('links a matched refund without paying cash twice and rejects a second link', () => {
    const f = pendingFixture()
    const cashBefore = expectedCash(f.state, openSession(f.state)!.id)
    const state = linkProvisionalReturn(
      f.state,
      f.pending.id,
      direct(f.sale.id, 10),
      'cash',
      'manager',
      linkedAt,
    )
    expect(state.provisionalReturns[0].linkedReturnId).toBe(state.salesReturns[0].id)
    expect(state.salesReturns[0].settlement).toBe('matched')
    expect(state.cashEntries).toHaveLength(f.state.cashEntries.length)
    expect(expectedCash(state, openSession(state)!.id)).toBe(cashBefore)
    expect(state.batches.find((b) => b.id === f.batch.id)).toMatchObject({
      stockUnits: 100,
      quarantinedUnits: 10,
    })
    expect(() =>
      linkProvisionalReturn(
        state,
        f.pending.id,
        direct(f.sale.id, 10),
        'cash',
        'manager',
        linkedAt,
      ),
    ).toThrow(/already linked/)
    valid(state)
  })
  it('pays only the under-refunded difference, and never lets it be written off', () => {
    const f = pendingFixture(6000)
    expect(() =>
      linkProvisionalReturn(
        f.state,
        f.pending.id,
        direct(f.sale.id, 10),
        'expense',
        'owner',
        linkedAt,
      ),
    ).toThrow(/underpayment/)
    const state = linkProvisionalReturn(
      f.state,
      f.pending.id,
      direct(f.sale.id, 10),
      'cash',
      'manager',
      linkedAt,
    )
    expect(state.cashEntries.at(-1)).toMatchObject({ kind: 'return-settlement', amount: -1000 })
    expect(state.salesReturns[0].cashDifference).toBe(-1000)
    expect(expectedCash(state, openSession(state)!.id)).toBe(100000)
    valid(state)
  })
  it('recovers only overpaid cash into the current drawer', () => {
    const f = pendingFixture(8000)
    const state = linkProvisionalReturn(
      f.state,
      f.pending.id,
      direct(f.sale.id, 10),
      'cash',
      'manager',
      linkedAt,
    )
    expect(state.cashEntries.at(-1)).toMatchObject({ kind: 'return-settlement', amount: 1000 })
    expect(expectedCash(state, openSession(state)!.id)).toBe(100000)
    valid(state)
  })
  it('Owner can absorb an overpayment as an accounting expense, without deducting cash again', () => {
    const f = pendingFixture(8000)
    expect(() =>
      linkProvisionalReturn(
        f.state,
        f.pending.id,
        direct(f.sale.id, 10),
        'expense',
        'manager',
        linkedAt,
      ),
    ).toThrow(/Only Owner/)
    const state = linkProvisionalReturn(
      f.state,
      f.pending.id,
      direct(f.sale.id, 10),
      'expense',
      'owner',
      linkedAt,
    )
    expect(state.expenses[0]).toMatchObject({
      amount: 1000,
      kind: 'return-adjustment',
      payment: 'adjustment',
    })
    expect(state.salesReturns[0].differenceExpenseId).toBe(state.expenses[0].id)
    expect(state.cashEntries).toEqual(f.state.cashEntries)
    expect(expectedCash(state, openSession(state)!.id)).toBe(99000)
    valid(state)
  })
  it('cannot clear a case by guessing quantities, a future invoice or a Cashier link', () => {
    const f = pendingFixture()
    expect(() =>
      linkProvisionalReturn(
        f.state,
        f.pending.id,
        direct(f.sale.id, 9),
        'cash',
        'manager',
        linkedAt,
      ),
    ).toThrow(/exactly match/)
    expect(() =>
      linkProvisionalReturn(
        f.state,
        f.pending.id,
        direct(f.sale.id, 10),
        'cash',
        'cashier',
        linkedAt,
      ),
    ).toThrow(/Owner or Manager/)
    const future = { ...f.state, sales: f.state.sales.map((s) => ({ ...s, createdAt: linkedAt })) }
    expect(() =>
      linkProvisionalReturn(future, f.pending.id, direct(f.sale.id, 10), 'cash', 'owner', linkedAt),
    ).toThrow(/before the provisional/)
    expect(f.state.provisionalReturns[0].linkedReturnId).toBeNull()
  })
  it('can resolve a matched case after closing, but must open another shift for a cash difference', () => {
    const f = pendingFixture()
    const closed = closeCashSession(f.state, 100000, '', 'cashier', returnAt)
    valid(
      linkProvisionalReturn(
        closed,
        f.pending.id,
        direct(f.sale.id, 10),
        'cash',
        'manager',
        linkedAt,
      ),
    )
    const underpaid = pendingFixture(6000)
    const closedUnderpaid = closeCashSession(underpaid.state, 101000, '', 'owner', returnAt)
    expect(() =>
      linkProvisionalReturn(
        closedUnderpaid,
        underpaid.pending.id,
        direct(underpaid.sale.id, 10),
        'cash',
        'manager',
        linkedAt,
      ),
    ).toThrow(/Open a cash shift/)
  })
  it('requires real refund confirmation, positive cash and distinct valid received goods', () => {
    const f = soldFixture()
    const input = {
      items: [{ productId: f.product.id, baseQuantity: 1 }],
      refundPaid: 100,
      phone: '',
      reason: 'Customer change' as const,
      notes: '',
      confirmed: true,
    }
    expect(() =>
      recordProvisionalReturn(f.state, { ...input, confirmed: false }, 'cashier', returnAt),
    ).toThrow(/Confirm/)
    expect(() =>
      recordProvisionalReturn(f.state, { ...input, refundPaid: 0 }, 'cashier', returnAt),
    ).toThrow(/positive/)
    expect(() =>
      recordProvisionalReturn(f.state, { ...input, refundPaid: 200000 }, 'cashier', returnAt),
    ).toThrow(/Not enough cash/)
    expect(() =>
      recordProvisionalReturn(
        f.state,
        { ...input, items: [input.items[0], input.items[0]] },
        'cashier',
        returnAt,
      ),
    ).toThrow(/distinct/)
    expect(() =>
      recordProvisionalReturn(
        f.state,
        { ...input, items: [{ productId: 'unknown', baseQuantity: 1 }] },
        'cashier',
        returnAt,
      ),
    ).toThrow(/Choose a product/)
  })
})

describe('owner ledger, operational expenses and role guards', () => {
  it('owner cash debits and repayments are separate from expenses and cash matches their signs', () => {
    const f = stockFixture()
    let state = recordOwnerCash(
      f.state,
      'cash-withdrawal',
      20000,
      'Personal groceries (sample)',
      'owner',
      soldAt,
    )
    state = recordOwnerCash(state, 'cash-deposit', 5000, 'Sample cash returned', 'owner', returnAt)
    expect(ownerBalance(state)).toBe(15000)
    expect(expectedCash(state, openSession(state)!.id)).toBe(85000)
    expect(state.expenses).toHaveLength(0)
    expect(state.ownerEntries.map((e) => e.number)).toEqual(['DRAW-0001', 'DRAW-0002'])
    valid(state)
  })
  it('medicine use is debited at purchase cost, deducts safe stock and creates neither sale nor cash movement', () => {
    const f = stockFixture()
    const state = recordOwnerMedicine(
      f.state,
      f.batch.id,
      3,
      'Sample personal medicine use',
      'owner',
      soldAt,
    )
    expect(state.ownerEntries[0]).toMatchObject({
      amount: 1500,
      kind: 'medicine-use',
      baseQuantity: 3,
      cashSessionId: null,
    })
    expect(state.batches.find((b) => b.id === f.batch.id)!.stockUnits).toBe(97)
    expect(state.cashEntries).toEqual(f.state.cashEntries)
    expect(state.sales).toHaveLength(0)
    expect(ownerBalance(state)).toBe(1500)
    valid(state)
  })
  it.each(['manager', 'cashier'] as Role[])(
    'blocks %s from all owner account operations',
    (role) => {
      const f = stockFixture()
      expect(() =>
        recordOwnerCash(f.state, 'cash-withdrawal', 100, 'Sample draw', role, soldAt),
      ).toThrow(/Only Owner/)
      expect(() =>
        recordOwnerCash(f.state, 'cash-deposit', 100, 'Sample credit', role, soldAt),
      ).toThrow(/Only Owner/)
      expect(() => recordOwnerMedicine(f.state, f.batch.id, 1, 'Sample use', role, soldAt)).toThrow(
        /Only Owner/,
      )
    },
  )
  it('does not allow expired, quarantined or insufficient medicine use', () => {
    const f = soldFixture()
    let state = recordSalesReturn(f.state, direct(f.sale.id, 10), 'manager', returnAt)
    state = recordOwnerMedicine(state, f.batch.id, 90, 'Sample use', 'owner', linkedAt)
    expect(() =>
      recordOwnerMedicine(state, f.batch.id, 1, 'Sample use', 'owner', linkedAt),
    ).toThrow(/unquarantined/)
    expect(() =>
      recordOwnerMedicine(
        f.state,
        f.batch.id,
        1,
        'Sample use',
        'owner',
        '2027-10-01T00:00:00.000Z',
      ),
    ).toThrow(/unexpired/)
    valid(state)
  })
  it('daily/monthly expenses reduce the drawer, never the owner account', () => {
    const f = stockFixture()
    let state = recordExpense(
      f.state,
      { amount: 500, kind: 'daily', category: 'Tea', notes: 'Sample shop tea' },
      'manager',
      soldAt,
    )
    state = recordExpense(
      state,
      { amount: 20000, kind: 'monthly', category: 'Rent', notes: 'Sample rent payment' },
      'owner',
      returnAt,
    )
    expect(expectedCash(state, openSession(state)!.id)).toBe(79500)
    expect(state.expenses.map((e) => e.number)).toEqual(['EXP-0001', 'EXP-0002'])
    expect(ownerBalance(state)).toBe(0)
    valid(state)
    expect(() =>
      recordExpense(
        f.state,
        { amount: 100, kind: 'daily', category: 'Tea', notes: '' },
        'cashier',
        soldAt,
      ),
    ).toThrow(/Owner or Manager/)
  })
  it('stops overspending and zero/invalid cash account entries', () => {
    const f = stockFixture()
    expect(() =>
      recordOwnerCash(f.state, 'cash-withdrawal', 100001, 'Sample draw', 'owner', soldAt),
    ).toThrow(/Not enough cash/)
    expect(() =>
      recordExpense(
        f.state,
        { amount: 100001, kind: 'daily', category: 'Tea', notes: '' },
        'manager',
        soldAt,
      ),
    ).toThrow(/Not enough cash/)
    expect(() =>
      recordOwnerCash(f.state, 'cash-deposit', 0, 'Sample credit', 'owner', soldAt),
    ).toThrow(/positive/)
    expect(() =>
      recordExpense(
        f.state,
        { amount: -1, kind: 'monthly', category: 'Rent', notes: '' },
        'owner',
        soldAt,
      ),
    ).toThrow(/positive/)
  })
})

describe('bill lookup and corrupt financial snapshots', () => {
  it('finds original medicines, invoice codes, normalized phone and Karachi date range', () => {
    const f = stockFixture()
    const cart = setCartPhone(
      addCartItem(f.state, f.product.id, f.batch.id, 'strip', 1, day),
      '+92 (300) 123-4567',
    )
    const state = completeSale(cart, 100000, 'owner', day, soldAt)
    expect(lookupSales(state, 'test medicine')).toHaveLength(1)
    expect(lookupSales(state, 'inv-0001', '300123', day, day)).toHaveLength(1)
    expect(lookupSales(state, '', '03001234567')).toHaveLength(1)
    expect(lookupSales(state, '', '', '2026-10-01')).toHaveLength(0)
    expect(lookupSales(state, 'missing')).toHaveLength(0)
    expect(() => lookupSales(state, '', '', '2026-10-01', day)).toThrow(/date range/)
    expect(() => setCartPhone(state, 'not-a-phone')).toThrow(/phone/)
  })
  it('validates exact cash/source links and rejects duplicates, orphan entries or invented legacy cash', () => {
    const f = soldFixture()
    const bad = structuredClone(f.state)
    bad.cashEntries[0].amount++
    expect(stateSchema.safeParse(bad).success).toBe(false)
    bad.cashEntries[0].amount--
    bad.cashEntries.push({ ...bad.cashEntries[0], id: 'duplicate-cash-id' })
    expect(stateSchema.safeParse(bad).success).toBe(false)
    bad.cashEntries.pop()
    bad.sales[0].legacy = true
    expect(stateSchema.safeParse(bad).success).toBe(false)
    bad.sales[0].legacy = false
    bad.cashEntries[0].refId = 'missing-sale'
    expect(stateSchema.safeParse(bad).success).toBe(false)
  })
  it('rejects altered refunds, stock, quarantine and closing snapshots', () => {
    const f = soldFixture()
    const state = recordSalesReturn(f.state, direct(f.sale.id, 2), 'manager', returnAt)
    const bad = structuredClone(state)
    bad.salesReturns[0].refund++
    expect(stateSchema.safeParse(bad).success).toBe(false)
    bad.salesReturns[0].refund--
    bad.batches.find((b) => b.id === f.batch.id)!.quarantinedUnits = 0
    expect(stateSchema.safeParse(bad).success).toBe(false)
    bad.batches.find((b) => b.id === f.batch.id)!.quarantinedUnits = 2
    bad.batches.find((b) => b.id === f.batch.id)!.stockUnits++
    expect(stateSchema.safeParse(bad).success).toBe(false)
    const closed = closeCashSession(state, 105600, '', 'owner', linkedAt)
    closed.cashSessions[0].expectedAtClose!++
    expect(stateSchema.safeParse(closed).success).toBe(false)
  })
  it('rejects false provisional resolution and never throws while parsing corrupt allocation data', () => {
    const f = pendingFixture()
    const state = linkProvisionalReturn(
      f.state,
      f.pending.id,
      direct(f.sale.id, 10),
      'cash',
      'manager',
      linkedAt,
    )
    const bad = structuredClone(state)
    bad.provisionalReturns[0].linkedReturnId = 'missing-return'
    expect(stateSchema.safeParse(bad).success).toBe(false)
    bad.provisionalReturns[0].linkedReturnId = bad.salesReturns[0].id
    bad.sales[0].subtotal = 1
    expect(stateSchema.safeParse(bad).success).toBe(false)
  })
})

describe('retry identity and cash chronology', () => {
  it('a repeated partial-return request cannot refund another unit', () => {
    const f = soldFixture()
    const request = { ...direct(f.sale.id), requestId: 'sample-return-request-1' }
    const state = recordSalesReturn(f.state, request, 'manager', returnAt)
    expect(() => recordSalesReturn(state, request, 'manager', linkedAt)).toThrow(/already recorded/)
    expect(state.salesReturns).toHaveLength(1)
    valid(state)
  })
  it('a repeated provisional request cannot pay twice or create a duplicate alert', () => {
    const f = soldFixture()
    const request = {
      requestId: 'sample-provisional-request-1',
      items: [{ productId: f.product.id, baseQuantity: 1 }],
      refundPaid: 700,
      phone: '',
      reason: 'Customer change' as const,
      notes: '',
      confirmed: true,
    }
    const state = recordProvisionalReturn(f.state, request, 'cashier', returnAt)
    expect(() => recordProvisionalReturn(state, request, 'cashier', linkedAt)).toThrow(
      /already recorded/,
    )
    expect(state.provisionalReturns).toHaveLength(1)
    valid(state)
  })
  it('cannot backdate a payout or close before the last movement', () => {
    const f = soldFixture()
    expect(() =>
      recordExpense(
        f.state,
        { amount: 500, kind: 'daily', category: 'Tea', notes: '' },
        'manager',
        opened,
      ),
    ).toThrow(/backdated/)
    expect(() => closeCashSession(f.state, 107000, '', 'owner', opened)).toThrow(
      /last cash movement/,
    )
  })
  it('rejects a forged lower historical cost, not just an increased cost', () => {
    const bad = structuredClone(soldFixture().state)
    bad.sales[0].lines[0].cost = 100
    bad.sales[0].cost = 100
    expect(stateSchema.safeParse(bad).success).toBe(false)
  })
})
