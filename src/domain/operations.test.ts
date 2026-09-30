import { describe, expect, it } from 'vitest'
import { openCashSession } from './cash'
import { createSeedState } from './seed'
import {
  addCartItem,
  barcodeMatch,
  cartDetails,
  changeCartQuantity,
  clearCart,
  completeSale,
  createProduct,
  parkCart,
  receiveStock,
  resumeCart,
  saveSettings,
  sortedBatches,
} from './operations'
import {
  type AppState,
  type ProductInput,
  dateSchema,
  factor,
  isExpired,
  parseMoney,
  parseQuantity,
  roundBill,
  stateSchema,
} from './model'

const today = '2026-09-30'
const now = '2026-09-30T10:00:00.000Z'
const seed = () =>
  openCashSession(createSeedState(today), 0, 'Test operator', 'owner', '2026-09-30T00:00:00.000Z')
const productInput: ProductInput = {
  name: 'Test product',
  description: '',
  category: 'Tablets',
  baseUnit: 'tablet',
  unitsPerStrip: 10,
  stripsPerBox: 2,
  barcodes: { box: 'TEST-BOX', strip: 'TEST-STRIP', loose: 'TEST-LOOSE' },
}
function testStock(cost = 500, price = 675, boxes = 5) {
  let state = createProduct(seed(), productInput, 'owner')
  const product = state.products.at(-1)!
  state = receiveStock(
    state,
    {
      supplier: 'Test supplier',
      reference: 'TEST',
      lines: [
        {
          productId: product.id,
          unit: 'box',
          quantity: boxes,
          batchNumber: 'TEST-BATCH',
          expiresOn: '2027-09-30',
          costPerBase: cost,
          pricePerBase: price,
        },
      ],
    },
    'owner',
    now,
  )
  return {
    state,
    product: state.products.find((p) => p.id === product.id)!,
    batch: state.batches.at(-1)!,
  }
}
function singlePriceCart(subtotal: number, cost: number) {
  const { state, product, batch } = testStock(cost, subtotal, 1)
  return addCartItem(state, product.id, batch.id, 'loose', 1, today)
}

describe('seed and pack math', () => {
  it('seeds only a valid, clearly labelled sample workspace', () => {
    const state = seed()
    expect(stateSchema.safeParse(state).success).toBe(true)
    expect(state.products).toHaveLength(12)
    expect(state.purchases).toHaveLength(2)
    expect(state.sales).toHaveLength(0)
    expect(state.settings.name).toContain('Demo')
    expect(state.purchases.every((p) => p.supplier.includes('sample'))).toBe(true)
  })
  it('adds 100 tablets for 5 boxes of 2 strips × 10 tablets', () => {
    const { state, product, batch } = testStock()
    expect(factor(product, 'box')).toBe(20)
    expect(factor(product, 'strip')).toBe(10)
    expect(factor(product, 'loose')).toBe(1)
    expect(batch.stockUnits).toBe(100)
    expect(state.purchases.at(-1)!.totalCost).toBe(50_000)
    expect(state.purchases.at(-1)!.number).toBe('PINV-0003')
  })
  it('converts strip and loose purchases without floating point rounding', () => {
    const { state, product } = testStock()
    const next = receiveStock(
      state,
      {
        supplier: 'Test supplier',
        reference: '',
        lines: [
          {
            productId: product.id,
            unit: 'strip',
            quantity: 3,
            batchNumber: 'S',
            expiresOn: '2027-01-01',
            costPerBase: 125,
            pricePerBase: 150,
          },
          {
            productId: product.id,
            unit: 'loose',
            quantity: 7,
            batchNumber: 'L',
            expiresOn: '2027-02-01',
            costPerBase: 125,
            pricePerBase: 150,
          },
        ],
      },
      'manager',
      now,
    )
    expect(next.batches.slice(-2).map((b) => b.stockUnits)).toEqual([30, 7])
    expect(next.purchases.at(-1)!.totalCost).toBe(4625)
  })
  it('keeps delivery lots and their original cost/price separate', () => {
    const { state, product, batch } = testStock()
    const next = receiveStock(
      state,
      {
        supplier: 'Another supplier',
        reference: '',
        lines: [
          {
            productId: product.id,
            unit: 'loose',
            quantity: 1,
            batchNumber: batch.number,
            expiresOn: batch.expiresOn,
            costPerBase: 600,
            pricePerBase: 800,
          },
        ],
      },
      'owner',
      now,
    )
    expect(next.batches.at(-1)!.id).not.toBe(batch.id)
    expect(next.batches.find((b) => b.id === batch.id)!.costPerBase).toBe(500)
    expect(next.batches.at(-1)!.costPerBase).toBe(600)
  })
})

describe('expiry, batches and barcodes', () => {
  it('uses nearest expiry rather than receipt date (FEFO)', () => {
    const { state, product } = testStock()
    const next = receiveStock(
      state,
      {
        supplier: 'Late delivery',
        reference: '',
        lines: [
          {
            productId: product.id,
            unit: 'box',
            quantity: 1,
            batchNumber: 'NEAR',
            expiresOn: '2026-10-01',
            costPerBase: 500,
            pricePerBase: 700,
          },
        ],
      },
      'owner',
      now,
    )
    expect(sortedBatches(next, product.id, today, true)[0].number).toBe('NEAR')
  })
  it('cannot add an expired batch to a sale', () => {
    const state = seed()
    const expired = state.batches.find((b) => isExpired(b, today))!
    expect(() => addCartItem(state, expired.productId, expired.id, 'loose', 1, today)).toThrow(
      /expired/,
    )
    expect(
      sortedBatches(state, expired.productId, today, true).some((b) => b.id === expired.id),
    ).toBe(false)
    expect(isExpired(sortedBatches(state, expired.productId, today)[0], today)).toBe(false)
  })
  it('allows sale on the printed expiry date but rechecks on the next day', () => {
    const { state, product, batch } = testStock()
    const onExpiry = addCartItem(state, product.id, batch.id, 'loose', 1, batch.expiresOn)
    expect(cartDetails(onExpiry, batch.expiresOn).lines).toHaveLength(1)
    expect(() => completeSale(onExpiry, 10000, 'cashier', '2027-10-01', now)).toThrow(/expired/)
  })
  it.each([
    ['TEST-BOX', 'box'],
    ['TEST-STRIP', 'strip'],
    ['TEST-LOOSE', 'loose'],
  ])('matches pack-specific barcode %s', (barcode, unit) => {
    const { state, product } = testStock()
    expect(barcodeMatch(state, ` ${barcode} `)).toEqual({ product, unit })
    expect(barcodeMatch(state, '')).toBeUndefined()
  })
  it('rejects duplicate codes both within a product and across products', () => {
    const { state } = testStock()
    expect(() => createProduct(state, { ...productInput, name: 'Other product' }, 'owner')).toThrow(
      /unique/,
    )
    expect(() =>
      createProduct(
        seed(),
        { ...productInput, barcodes: { box: 'A', strip: 'A', loose: '' } },
        'owner',
      ),
    ).toThrow(/unique/)
  })
  it('does not interpret impossible expiry dates', () => {
    expect(dateSchema.safeParse('2026-02-30').success).toBe(false)
    expect(dateSchema.safeParse('2028-02-29').success).toBe(true)
  })
})

describe('cart, payment and stock integrity', () => {
  it('deducts only the selected lot and creates one final sale snapshot', () => {
    const { state, product, batch } = testStock()
    const original = structuredClone(state)
    const cart = addCartItem(state, product.id, batch.id, 'strip', 1, today)
    const sold = completeSale(cart, 10_000, 'cashier', today, now)
    expect(sold.batches.find((b) => b.id === batch.id)!.stockUnits).toBe(90)
    expect(sold.batches.filter((b) => b.id !== batch.id)).toEqual(
      state.batches.filter((b) => b.id !== batch.id),
    )
    expect(sold.cart).toEqual([])
    expect(sold.sales.at(-1)!.number).toBe('INV-0001')
    expect(sold.sales.at(-1)!.lines[0].baseQuantity).toBe(10)
    expect(sold.sales.at(-1)!.subtotal).toBe(6750)
    expect(sold.sales.at(-1)!.total).toBe(6000)
    expect(sold.sales.at(-1)!.change).toBe(4000)
    expect(state).toEqual(original)
    expect(stateSchema.safeParse(sold).success).toBe(true)
    expect(() => completeSale(sold, 10000, 'cashier', today, now)).toThrow(/empty/)
  })
  it('increments sale numbers without reusing a completed invoice', () => {
    const { state, product, batch } = testStock()
    let next = completeSale(
      addCartItem(state, product.id, batch.id, 'loose', 1, today),
      10000,
      'owner',
      today,
      now,
    )
    next = completeSale(
      addCartItem(next, product.id, batch.id, 'loose', 1, today),
      10000,
      'manager',
      today,
      now,
    )
    expect(next.sales.map((s) => s.number)).toEqual(['INV-0001', 'INV-0002'])
  })
  it('aggregates different pack sizes against the same batch', () => {
    const { state, product, batch } = testStock(500, 675, 1)
    const cart = addCartItem(state, product.id, batch.id, 'strip', 1, today)
    expect(() => addCartItem(cart, product.id, batch.id, 'box', 1, today)).toThrow(
      /Not enough stock/,
    )
    const mixed = addCartItem(cart, product.id, batch.id, 'loose', 10, today)
    expect(cartDetails(mixed, today).lines.reduce((n, l) => n + l.baseQuantity, 0)).toBe(20)
  })
  it('merges repeated additions of the same batch/pack', () => {
    const { state, product, batch } = testStock()
    const cart = addCartItem(
      addCartItem(state, product.id, batch.id, 'loose', 2, today),
      product.id,
      batch.id,
      'loose',
      3,
      today,
    )
    expect(cart.cart).toHaveLength(1)
    expect(cart.cart[0].quantity).toBe(5)
    const removed = changeCartQuantity(cart, cart.cart[0].id, 0, today)
    expect(removed.cart).toHaveLength(0)
    expect(removed.batches).toEqual(state.batches)
  })
  it('rejects fractional, negative and oversized quantities', () => {
    const { state, product, batch } = testStock()
    for (const q of [-1, 0, 1.5, 1_000_001])
      expect(() => addCartItem(state, product.id, batch.id, 'loose', q, today)).toThrow()
    const cart = addCartItem(state, product.id, batch.id, 'loose', 5, today)
    expect(() => addCartItem(cart, product.id, batch.id, 'loose', -1, today)).toThrow()
  })
  it('never finalizes underpayment or a cart whose stock changed', () => {
    const { state, product, batch } = testStock()
    const cart = addCartItem(state, product.id, batch.id, 'strip', 2, today)
    expect(() => completeSale(cart, 1, 'cashier', today, now)).toThrow(/cover/)
    const stale = {
      ...cart,
      batches: cart.batches.map((b) => (b.id === batch.id ? { ...b, stockUnits: 0 } : b)),
    }
    expect(() => completeSale(stale, 100_000, 'cashier', today, now)).toThrow(/Not enough stock/)
    expect(cart.sales).toHaveLength(0)
  })
  it('holds and resumes exact units, selected batches and quantities without reserving stock', () => {
    const { state, product, batch } = testStock()
    const cart = addCartItem(state, product.id, batch.id, 'strip', 2, today)
    const parked = parkCart(cart, 'Customer A', now)
    expect(parked.cart).toHaveLength(0)
    expect(parked.batches).toEqual(state.batches)
    expect(parked.parkedCarts[0].lines).toEqual(cart.cart)
    const resumed = resumeCart(parked, parked.parkedCarts[0].id)
    expect(resumed.cart).toEqual(cart.cart)
    expect(resumed.parkedCarts).toHaveLength(0)
    expect(() => parkCart(clearCart(resumed), '', now)).toThrow(/Add an item/)
  })
  it('does not overwrite an active cart when resuming another', () => {
    const { state, product, batch } = testStock()
    const parked = parkCart(addCartItem(state, product.id, batch.id, 'loose', 1, today), 'A', now)
    const busy = addCartItem(parked, product.id, batch.id, 'loose', 1, today)
    expect(() => resumeCart(busy, parked.parkedCarts[0].id)).toThrow(/Park or clear/)
  })
  it('rechecks parked stock after another customer buys it', () => {
    const { state, product, batch } = testStock(500, 675, 1)
    const parked = parkCart(addCartItem(state, product.id, batch.id, 'box', 1, today), 'A', now)
    const otherSale = completeSale(
      addCartItem(parked, product.id, batch.id, 'box', 1, today),
      20000,
      'owner',
      today,
      now,
    )
    const resumed = resumeCart(otherSale, parked.parkedCarts[0].id)
    expect(() => completeSale(resumed, 20000, 'owner', today, now)).toThrow(/Not enough stock/)
  })
})

describe('integer PKR rounding and cost protection', () => {
  it.each([
    [54500, 50000, 54000, 500, false],
    [54500, 54300, 54500, 0, true],
    [55600, 55000, 55000, 600, false],
    [54000, 50000, 54000, 0, false],
    [675, 500, 675, 0, true],
  ])('rounds %i with cost %i', (subtotal, cost, total, rounding, skipped) => {
    expect(roundBill(subtotal, cost)).toEqual({ total, rounding, skipped })
    const state = singlePriceCart(subtotal, cost)
    const sale = completeSale(state, subtotal + 10000, 'owner', today, now).sales.at(-1)!
    expect(sale.total).toBe(total)
    expect(sale.roundingSkipped).toBe(skipped)
  })
  it('blocks a below-cost bill rather than merely skipping rounding', () => {
    expect(() => roundBill(500, 501)).toThrow(/below purchase cost/)
    const { state, product } = testStock()
    expect(() =>
      receiveStock(
        state,
        {
          supplier: 'Test supplier',
          reference: '',
          lines: [
            {
              productId: product.id,
              unit: 'box',
              quantity: 1,
              batchNumber: 'INVALID',
              expiresOn: '2027-01-01',
              costPerBase: 1000,
              pricePerBase: 999,
            },
          ],
        },
        'owner',
        now,
      ),
    ).toThrow(/below cost/)
  })
  it('parses paisa exactly and rejects invalid money/quantity input', () => {
    expect(parseMoney('6.75')).toBe(675)
    expect(parseMoney('0.1')).toBe(10)
    expect(parseMoney('543')).toBe(54300)
    for (const s of ['', '-1', '1.001', 'NaN', 'Infinity', '1e3'])
      expect(() => parseMoney(s)).toThrow()
    for (const s of ['', '-1', '1.1', '0', '1000001']) expect(() => parseQuantity(s)).toThrow()
  })
})

describe('test role boundaries and saved data', () => {
  it('rejects cashier stock, product and settings commands', () => {
    const { state, product } = testStock()
    expect(() =>
      createProduct(
        state,
        { ...productInput, barcodes: { box: '', strip: '', loose: '' } },
        'cashier',
      ),
    ).toThrow(/Owner or Manager/)
    expect(() =>
      receiveStock(
        state,
        {
          supplier: 'Test supplier',
          reference: '',
          lines: [
            {
              productId: product.id,
              unit: 'box',
              quantity: 1,
              batchNumber: 'A',
              expiresOn: '2027-01-01',
              costPerBase: 0,
              pricePerBase: 0,
            },
          ],
        },
        'cashier',
        now,
      ),
    ).toThrow(/Owner or Manager/)
    expect(() => saveSettings(state, state.settings, 'cashier')).toThrow(/Owner or Manager/)
  })
  it('rejects broken references, reused invoice sequences and inconsistent sale totals', () => {
    const { state, product, batch } = testStock()
    const cart = addCartItem(state, product.id, batch.id, 'loose', 1, today)
    expect(
      stateSchema.safeParse({ ...cart, cart: [{ ...cart.cart[0], batchId: 'missing' }] }).success,
    ).toBe(false)
    expect(stateSchema.safeParse({ ...state, nextPurchaseNumber: 1 }).success).toBe(false)
    const sold: AppState = completeSale(cart, 10000, 'owner', today, now)
    expect(
      stateSchema.safeParse({ ...sold, sales: [{ ...sold.sales[0], total: 1 }] }).success,
    ).toBe(false)
    const badCost = sold.sales[0].subtotal + 1
    expect(
      stateSchema.safeParse({
        ...sold,
        sales: [
          {
            ...sold.sales[0],
            cost: badCost,
            lines: [{ ...sold.sales[0].lines[0], cost: badCost }],
          },
        ],
      }).success,
    ).toBe(false)
    const purchase = state.purchases.at(-1)!
    expect(
      stateSchema.safeParse({
        ...state,
        purchases: [
          ...state.purchases.slice(0, -1),
          { ...purchase, lines: [{ ...purchase.lines[0], baseQuantity: 101 }] },
        ],
      }).success,
    ).toBe(false)
  })
})
