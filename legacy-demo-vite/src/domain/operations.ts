import {
  type AppState,
  type Product,
  type ProductInput,
  type Role,
  type PackUnit,
  type CartLine,
  type SaleLine,
  type Settings,
  productSchema,
  settingsSchema,
  dateSchema,
  DomainError,
  factor,
  isExpired,
  safeMultiply,
  roundBill,
  uid,
  invoiceNumber,
  usableUnits,
  defaultReorder,
} from './model'
import { discountAmount } from './arithmetic'
import { recordCash, requireOpenSession } from './cash'
import { createSupplier, getSupplier, supplierNameKey } from './suppliers'
import { validatePhone } from './returns'

function requireStockAccess(role: Role) {
  if (role !== 'owner' && role !== 'manager')
    throw new DomainError('Switch to Owner or Manager to manage stock.')
}
function getProduct(state: AppState, id: string): Product {
  const product = state.products.find((p) => p.id === id)
  if (!product) throw new DomainError('This product no longer exists.')
  return product
}

export function sortedBatches(
  state: AppState,
  productId: string,
  today: string,
  saleableOnly = false,
) {
  return state.batches
    .filter(
      (b) =>
        b.productId === productId &&
        (!saleableOnly || (usableUnits(b) > 0 && !isExpired(b, today))),
    )
    .sort(
      (a, b) =>
        Number(usableUnits(a) === 0 || isExpired(a, today)) -
          Number(usableUnits(b) === 0 || isExpired(b, today)) ||
        a.expiresOn.localeCompare(b.expiresOn) ||
        a.receivedAt.localeCompare(b.receivedAt) ||
        a.id.localeCompare(b.id),
    )
}
export function saleableStock(state: AppState, productId: string, today: string) {
  return sortedBatches(state, productId, today, true).reduce((n, b) => n + usableUnits(b), 0)
}
export function barcodeMatch(state: AppState, text: string) {
  const code = text.trim()
  if (!code) return undefined
  for (const product of state.products) {
    for (const [unit, barcode] of Object.entries(product.barcodes)) {
      if (barcode && barcode === code) return { product, unit: unit as PackUnit }
    }
  }
  return undefined
}

export function createProduct(state: AppState, input: ProductInput, role: Role): AppState {
  requireStockAccess(role)
  const parsed = productSchema.safeParse({
    ...input,
    id: uid(),
    reorder: input.reorder ?? defaultReorder(input),
  })
  if (!parsed.success) throw new DomainError(parsed.error.issues[0].message)
  const existingCodes = new Set(
    state.products.flatMap((p) => Object.values(p.barcodes)).filter(Boolean),
  )
  const newCodes = Object.values(parsed.data.barcodes).filter(Boolean)
  if (new Set(newCodes).size !== newCodes.length || newCodes.some((c) => existingCodes.has(c)))
    throw new DomainError('Each pack barcode must be unique across the inventory.')
  return { ...state, products: [...state.products, parsed.data] }
}

export interface StockLineInput {
  productId: string
  unit: PackUnit
  quantity: number
  batchNumber: string
  expiresOn: string
  costPerBase: number
  pricePerBase: number
  stockKind?: 'standard' | 'bonus'
}
export interface StockInput {
  supplierId?: string
  supplier: string
  reference: string
  lines: StockLineInput[]
}
export function receiveStock(
  state: AppState,
  input: StockInput,
  role: Role,
  now: string,
): AppState {
  requireStockAccess(role)
  let supplier = input.supplierId
    ? getSupplier(state, input.supplierId)
    : state.suppliers.find((s) => supplierNameKey(s.name) === supplierNameKey(input.supplier))
  if (!supplier) {
    state = createSupplier(
      state,
      {
        name: input.supplier,
        agency: '',
        phone: '',
        address: '',
        openingBalance: 0,
        openingNote: 'New demo account started at zero with its first delivery.',
        confirmed: true,
      },
      role,
      now,
    )
    supplier = state.suppliers.at(-1)!
  }
  if (!input.lines.length) throw new DomainError('Add at least one stock item.')
  const purchaseId = uid()
  const batches = input.lines.map((line) => {
    const product = getProduct(state, line.productId)
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 1_000_000)
      throw new DomainError('Stock quantity must be a positive whole number.')
    if (!line.batchNumber.trim() || line.batchNumber.trim().length > 50)
      throw new DomainError(`Enter a batch number for ${product.name}.`)
    if (!dateSchema.safeParse(line.expiresOn).success)
      throw new DomainError(`Enter a valid expiry date for ${product.name}.`)
    if (![line.costPerBase, line.pricePerBase].every((n) => Number.isSafeInteger(n) && n >= 0))
      throw new DomainError('Enter valid non-negative prices.')
    if (
      !['standard', 'bonus'].includes(line.stockKind ?? 'standard') ||
      (line.stockKind === 'bonus' && line.costPerBase !== 0)
    )
      throw new DomainError('Sample/bonus stock must have exactly zero purchase cost.')
    if (line.pricePerBase < line.costPerBase)
      throw new DomainError(`Retail price for ${product.name} cannot be below cost.`)
    return {
      id: uid(),
      productId: product.id,
      purchaseId,
      number: line.batchNumber.trim(),
      expiresOn: line.expiresOn,
      receivedAt: now,
      stockUnits: safeMultiply(line.quantity, factor(product, line.unit)),
      quarantinedUnits: 0,
      costPerBase: line.costPerBase,
      pricePerBase: line.pricePerBase,
    }
  })
  const lines = input.lines.map((line, i) => {
    const product = getProduct(state, line.productId)
    const batch = batches[i]
    return {
      productId: product.id,
      productName: product.name,
      batchId: batch.id,
      batchNumber: batch.number,
      expiresOn: batch.expiresOn,
      baseUnit: product.baseUnit,
      unit: line.unit,
      quantity: line.quantity,
      baseQuantity: batch.stockUnits,
      costPerBase: line.costPerBase,
      pricePerBase: line.pricePerBase,
      totalCost: safeMultiply(batch.stockUnits, line.costPerBase),
      stockKind: line.stockKind ?? 'standard',
    }
  })
  const totalCost = lines.reduce((n, l) => n + l.totalCost, 0)
  if (!Number.isSafeInteger(totalCost)) throw new DomainError('Purchase amount is too large.')
  const purchase = {
    id: purchaseId,
    number: invoiceNumber('PINV', state.nextPurchaseNumber),
    supplier: supplier.name,
    supplierId: supplier.id,
    ledgerTreatment: 'account' as const,
    ledgerOrder: state.nextSupplierLedgerOrder,
    reference: input.reference.trim(),
    createdAt: now,
    role,
    lines,
    totalCost,
  }
  return {
    ...state,
    batches: [...state.batches, ...batches],
    purchases: [...state.purchases, purchase],
    nextPurchaseNumber: state.nextPurchaseNumber + 1,
    nextSupplierLedgerOrder: state.nextSupplierLedgerOrder + 1,
    products: state.products.map((p) =>
      !p.reorder.preferredSupplierId &&
      !state.purchases.some((old) => old.lines.some((l) => l.productId === p.id)) &&
      lines.some((l) => l.productId === p.id)
        ? { ...p, reorder: { ...p.reorder, preferredSupplierId: supplier!.id } }
        : p,
    ),
  }
}

export function cartDetails(
  state: AppState,
  today: string,
  lines: CartLine[] = state.cart,
  role?: Role,
) {
  if (role === 'cashier' && state.cartDiscountBps > state.settings.cashierMaxDiscountBps)
    throw new DomainError(
      'This quote exceeds the cashier discount limit. Reduce the discount or ask Owner/Manager.',
    )
  const reservations = new Map<string, number>()
  const saleLines: SaleLine[] = lines.map((line) => {
    const product = getProduct(state, line.productId)
    const batch = state.batches.find((b) => b.id === line.batchId && b.productId === product.id)
    if (!batch)
      throw new DomainError(
        'A selected batch no longer exists. Remove the item and select it again.',
      )
    if (isExpired(batch, today))
      throw new DomainError(
        `${product.name}, batch ${batch.number}, is expired. Remove it from the cart.`,
      )
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 1_000_000)
      throw new DomainError('Quantity must be a positive whole number.')
    const baseQuantity = safeMultiply(line.quantity, factor(product, line.unit))
    reservations.set(batch.id, (reservations.get(batch.id) ?? 0) + baseQuantity)
    if (reservations.get(batch.id)! > usableUnits(batch))
      throw new DomainError(
        `Not enough stock for ${product.name}, batch ${batch.number}. Reduce the quantity.`,
      )
    const retailTotal = safeMultiply(baseQuantity, batch.pricePerBase)
    const cost = safeMultiply(baseQuantity, batch.costPerBase)
    const discount = discountAmount(
      retailTotal,
      cost,
      state.cartDiscountBps,
      state.cartDiscountMode,
    )
    const total = retailTotal - discount
    if (total < cost)
      throw new DomainError(
        `${product.name}: this discount would put the sale below purchase cost.`,
      )
    return {
      productId: product.id,
      productName: product.name,
      batchId: batch.id,
      batchNumber: batch.number,
      expiresOn: batch.expiresOn,
      baseUnit: product.baseUnit,
      unit: line.unit,
      quantity: line.quantity,
      baseQuantity,
      pricePerPack: safeMultiply(batch.pricePerBase, factor(product, line.unit)),
      retailTotal,
      discount,
      cost,
      total,
    }
  })
  const subtotal = saleLines.reduce((sum, l) => sum + l.total, 0)
  const cost = saleLines.reduce((sum, l) => sum + l.cost, 0)
  const rounded = roundBill(subtotal, cost)
  return {
    lines: saleLines,
    grossSubtotal: saleLines.reduce((n, l) => n + l.retailTotal, 0),
    discount: saleLines.reduce((n, l) => n + l.discount, 0),
    discountBps: state.cartDiscountBps,
    discountMode: state.cartDiscountMode,
    subtotal,
    cost,
    total: rounded.total,
    rounding: rounded.rounding,
    roundingSkipped: rounded.skipped,
  }
}

export function addCartItem(
  state: AppState,
  productId: string,
  batchId: string,
  unit: PackUnit,
  quantity: number,
  today: string,
): AppState {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1_000_000)
    throw new DomainError('Quantity must be a positive whole number.')
  const match = state.cart.find((l) => l.batchId === batchId && l.unit === unit)
  const cart = match
    ? state.cart.map((l) => (l.id === match.id ? { ...l, quantity: l.quantity + quantity } : l))
    : [...state.cart, { id: uid(), productId, batchId, unit, quantity }]
  const next = { ...state, cart }
  cartDetails(next, today)
  return next
}
export function changeCartQuantity(
  state: AppState,
  lineId: string,
  quantity: number,
  today: string,
): AppState {
  const next = {
    ...state,
    cart:
      quantity === 0
        ? state.cart.filter((l) => l.id !== lineId)
        : state.cart.map((l) => (l.id === lineId ? { ...l, quantity } : l)),
  }
  cartDetails(next, today)
  return next
}
export const removeCartItem = (state: AppState, lineId: string): AppState => ({
  ...state,
  cart: state.cart.filter((l) => l.id !== lineId),
})
export const clearCart = (state: AppState): AppState => ({
  ...state,
  cart: [],
  cartDiscountMode: state.settings.discountMode,
  cartDiscountBps: 0,
  cartPhone: '',
})

export function parkCart(state: AppState, name: string, now: string): AppState {
  if (!state.cart.length) throw new DomainError('Add an item before parking a cart.')
  if (name.trim().length > 60) throw new DomainError('Cart name must be 60 characters or fewer.')
  const parked = {
    id: uid(),
    name: name.trim() || `Customer ${state.parkedCarts.length + 1}`,
    createdAt: now,
    lines: state.cart,
    discountMode: state.cartDiscountMode,
    discountBps: state.cartDiscountBps,
    phone: state.cartPhone,
  }
  return {
    ...state,
    cart: [],
    cartDiscountMode: state.settings.discountMode,
    cartDiscountBps: 0,
    cartPhone: '',
    parkedCarts: [...state.parkedCarts, parked],
  }
}
export function resumeCart(state: AppState, id: string): AppState {
  if (state.cart.length)
    throw new DomainError('Park or clear the current cart before resuming another.')
  const parked = state.parkedCarts.find((c) => c.id === id)
  if (!parked) throw new DomainError('This parked cart is no longer available.')
  // Stock is validated again at checkout; parked carts never reserve inventory.
  return {
    ...state,
    cart: parked.lines,
    cartDiscountBps: parked.discountBps,
    cartDiscountMode: parked.discountMode,
    cartPhone: parked.phone,
    parkedCarts: state.parkedCarts.filter((c) => c.id !== id),
  }
}
export const discardParkedCart = (state: AppState, id: string): AppState => ({
  ...state,
  parkedCarts: state.parkedCarts.filter((c) => c.id !== id),
})

export function completeSale(
  state: AppState,
  tendered: number,
  role: Role,
  today: string,
  now: string,
): AppState {
  if (!state.cart.length) throw new DomainError('The cart is empty.')
  const details = cartDetails(state, today, state.cart, role)
  const session = requireOpenSession(state)
  if (!Number.isSafeInteger(tendered) || tendered < details.total)
    throw new DomainError('Cash received must cover the amount due.')
  const consumed = new Map<string, number>()
  for (const line of details.lines)
    consumed.set(line.batchId, (consumed.get(line.batchId) ?? 0) + line.baseQuantity)
  const sale = {
    id: uid(),
    number: invoiceNumber('INV', state.nextSaleNumber),
    createdAt: now,
    role,
    ...details,
    tendered,
    change: tendered - details.total,
    customerPhone: state.cartPhone,
    cashSessionId: session.id,
    legacy: false,
  }
  const withCash = recordCash(state, 'sale', details.total, sale.id, role, now)
  return {
    ...withCash,
    cart: [],
    cartDiscountMode: state.settings.discountMode,
    cartDiscountBps: 0,
    cartPhone: '',
    sales: [...state.sales, sale],
    nextSaleNumber: state.nextSaleNumber + 1,
    batches: state.batches.map((b) => ({
      ...b,
      stockUnits: b.stockUnits - (consumed.get(b.id) ?? 0),
    })),
  }
}
export function saveSettings(state: AppState, input: Settings, role: Role): AppState {
  requireStockAccess(role)
  const parsed = settingsSchema.safeParse(input)
  if (!parsed.success) throw new DomainError(parsed.error.issues[0].message)
  return {
    ...state,
    settings: parsed.data,
    cartDiscountMode:
      state.cart.length || state.cartDiscountBps
        ? state.cartDiscountMode
        : parsed.data.discountMode,
  }
}

export function setCartDiscount(state: AppState, bps: number, role: Role, today: string): AppState {
  if (!Number.isInteger(bps) || bps < 0 || bps > 10000)
    throw new DomainError('Discount must be between 0 and 100%.')
  if (role === 'cashier' && bps > state.settings.cashierMaxDiscountBps)
    throw new DomainError('Discount exceeds the cashier limit set by Owner/Manager.')
  const next = { ...state, cartDiscountBps: bps }
  cartDetails(next, today, next.cart, role)
  return next
}
export function setCartPhone(state: AppState, phone: string): AppState {
  return { ...state, cartPhone: validatePhone(phone) }
}
