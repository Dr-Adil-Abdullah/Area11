import { useState, type RefObject } from 'react'
import {
  Search,
  ScanBarcode,
  Pause,
  ArrowRight,
  ShoppingBasket,
  Plus,
  Minus,
  Trash2,
  X,
  Banknote,
  Phone,
  Percent,
  ReceiptText,
  TrendingUp,
  PackageCheck,
  ShieldCheck,
} from 'lucide-react'
import {
  type Product,
  categories,
  businessDate,
  formatMoney,
  invoiceNumber,
  factor,
  availableUnits,
  unitLabel,
  usableUnits,
  formatPercent,
} from '../domain/model'
import {
  addCartItem,
  barcodeMatch,
  cartDetails,
  changeCartQuantity,
  removeCartItem,
  saleableStock,
  sortedBatches,
} from '../domain/operations'
import { expiryLevel, expiryColor } from '../domain/alerts'
import { openSession } from '../domain/cash'
import { useWorkspace } from '../ui/workspace'
import { Empty, Notice, PageHeading, ProductIcon } from '../ui/common'

export default function Counter({ searchRef }: { searchRef: RefObject<HTMLInputElement | null> }) {
  const { state, today, role, run, notify, open, storageIssue, navigate } = useWorkspace()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All products')
  const search = query.trim().toLowerCase()
  const filtered = state.products.filter(
    (p) =>
      (category === 'All products' || p.category === category) &&
      (!search ||
        p.name.toLowerCase().includes(search) ||
        Object.values(p.barcodes).some((b) => b.includes(search))),
  )
  const todaysSales = state.sales.filter((sale) => businessDate(new Date(sale.createdAt)) === today)
  let details: ReturnType<typeof cartDetails> | undefined
  let cartError = ''
  try {
    details = cartDetails(state, today, state.cart, role)
  } catch (error) {
    cartError = (error as Error).message
  }
  const scan = () => {
    const match = barcodeMatch(state, query)
    if (!match) {
      if (filtered.length === 1) open({ type: 'batch', productId: filtered[0].id })
      else notify('No exact barcode match. Select a product from the results.', 'info')
      return
    }
    const needed = factor(match.product, match.unit)
    const batch = sortedBatches(state, match.product.id, today, true).find((b) => {
      const inCart = state.cart
        .filter((l) => l.batchId === b.id)
        .reduce((sum, l) => sum + l.quantity * factor(match.product, l.unit), 0)
      return usableUnits(b) - inCart >= needed
    })
    if (!batch) {
      notify('No unexpired stock available for this pack size.', 'error')
      return
    }
    if (
      run(
        (s) => addCartItem(s, match.product.id, batch.id, match.unit, 1, today),
        `${match.product.name} added via barcode.`,
      )
    )
      setQuery('')
    searchRef.current?.focus()
  }
  const productCard = (product: Product) => {
    const batches = sortedBatches(state, product.id, today, true)
    const stock = saleableStock(state, product.id, today)
    const alert = batches[0] ? expiryLevel(batches[0], today, state.settings.expiry) : null
    return (
      <button
        key={product.id}
        className="product-card"
        onClick={() => open({ type: 'batch', productId: product.id })}
        aria-label={`Select ${product.name}`}
      >
        <div className="product-card-top">
          <ProductIcon product={product} />
          <span className="product-category">{product.category}</span>
        </div>
        <h3>{product.name}</h3>
        <p className="product-description">
          {product.description
            .replace(' · sample product', '')
            .replace(' · sample bottle', '')
            .replace(' · sample piece', '')
            .replace(' · sample', '') || 'Sample inventory product'}
        </p>
        <div className="product-price">
          {batches[0] ? formatMoney(batches[0].pricePerBase) : 'Unavailable'}
          <span>{batches[0] ? ` / ${product.baseUnit}` : ' for sale'}</span>
        </div>
        <div className="product-stock">
          <span className={`status-dot ${stock ? '' : 'dot-warning'}`} />
          {stock.toLocaleString()} {unitLabel(product, 'loose', stock !== 1)} available
        </div>
        {alert && (
          <div className="catalog-expiry-alert">
            <span
              className="alert-color-dot"
              style={{ background: expiryColor(alert, state.settings.expiry) }}
            />
            {alert === 'near'
              ? 'Near expiry'
              : alert === 'middle'
                ? 'Expiry warning'
                : 'Expiry watch'}
          </div>
        )}
        <div className="product-card-bottom">
          <span>
            {batches.length} saleable {batches.length === 1 ? 'batch' : 'batches'}
          </span>
          <span className="add-product-icon">
            <Plus size={17} />
          </span>
        </div>
      </button>
    )
  }
  return (
    <div className="counter-layout">
      <section className="catalog-panel">
        <PageHeading
          title="Point of sale"
          description="Everything you need for a smoother day at the counter."
        >
          <button
            className="button button-secondary parked-button"
            onClick={() => open({ type: 'park' })}
          >
            <Pause size={16} />
            Parked carts<span className="button-count">{state.parkedCarts.length}</span>
          </button>
        </PageHeading>
        <div className="counter-metrics">
          <div className="metric-card">
            <span className="metric-icon green">
              <TrendingUp size={19} />
            </span>
            <div>
              <p>Today's sales</p>
              <strong>{formatMoney(todaysSales.reduce((n, s) => n + s.total, 0))}</strong>
            </div>
          </div>
          <div className="metric-card">
            <span className="metric-icon blue">
              <ReceiptText size={19} />
            </span>
            <div>
              <p>Bills completed</p>
              <strong>
                {todaysSales.length.toLocaleString()}
                <small>today</small>
              </strong>
            </div>
          </div>
          <div className="metric-card">
            <span className="metric-icon amber">
              <PackageCheck size={19} />
            </span>
            <div>
              <p>Base units sold</p>
              <strong>
                {todaysSales
                  .reduce((n, s) => n + s.lines.reduce((m, l) => m + l.baseQuantity, 0), 0)
                  .toLocaleString()}
                <small>today</small>
              </strong>
            </div>
          </div>
        </div>
        <div className="catalog-tools">
          <div className="search-field">
            <Search size={20} />
            <input
              ref={searchRef}
              aria-label="Search products or scan barcode"
              placeholder="Search a product or scan a barcode…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  scan()
                }
              }}
            />
            {query ? (
              <button
                className="icon-button"
                aria-label="Clear product search"
                onClick={() => {
                  setQuery('')
                  searchRef.current?.focus()
                }}
              >
                <X size={15} />
              </button>
            ) : (
              <kbd>F2</kbd>
            )}
          </div>
          <button
            className="scan-button"
            aria-label="Focus barcode scanner"
            title="USB keyboard scanners: scan into search and press Enter"
            onClick={() => {
              searchRef.current?.focus()
              notify(
                'Scan a barcode into search and press Enter. Keyboard-style USB scanners are supported; actual hardware is not yet verified.',
              )
            }}
          >
            <ScanBarcode size={22} />
          </button>
        </div>
        <div className="category-tabs" aria-label="Product categories">
          {['All products', ...categories].map((c) => (
            <button
              key={c}
              className={category === c ? 'active' : ''}
              onClick={() => setCategory(c)}
              aria-pressed={category === c}
            >
              {c}
              {c === 'All products' && <span>{state.products.length}</span>}
            </button>
          ))}
        </div>
        <h2 className="sr-only">Product catalog</h2>
        <div className="catalog-caption">
          <span>
            {filtered.length} {filtered.length === 1 ? 'product' : 'products'}
          </span>
          <span>
            <span className="status-dot" />
            Nearest expiry shown first
          </span>
        </div>
        {filtered.length ? (
          <div className="product-grid">{filtered.map(productCard)}</div>
        ) : (
          <Empty title="No products found">
            Try a product name or barcode, or choose another category.
          </Empty>
        )}
        <div className="catalog-note">
          <ShieldCheck size={15} />
          Expired batches cannot be sold. All inventory in this workspace is sample data.
        </div>
      </section>
      <aside id="current-cart" className="cart-panel" aria-label="Current sale">
        <div className="cart-heading">
          <div>
            <div className="eyebrow">CURRENT SALE</div>
            <h2>
              {invoiceNumber('INV', state.nextSaleNumber)}
              <span className="cart-item-count">{state.cart.length}</span>
            </h2>
          </div>
          <button
            className="icon-button"
            aria-label="Clear current cart"
            disabled={!state.cart.length && !state.cartPhone && !state.cartDiscountBps}
            onClick={() => open({ type: 'clear' })}
          >
            <Trash2 size={17} />
          </button>
        </div>
        <div className="customer-line">
          <div className="customer-avatar">W</div>
          <div>
            <strong>Walk-in customer</strong>
            <span>{state.cartPhone || 'Cash sale · no customer profile'}</span>
          </div>
          <button
            className="icon-button"
            aria-label="Add receipt phone"
            onClick={() => open({ type: 'contact' })}
          >
            <Phone size={17} />
          </button>
        </div>
        <div className="cart-items">
          {!state.cart.length ? (
            <div className="cart-empty">
              <div className="basket-illustration">
                <ShoppingBasket size={45} strokeWidth={1.35} />
                <span className="basket-plus">
                  <Plus size={14} />
                </span>
              </div>
              <h3>Ready for the next customer</h3>
              <p>
                Select a product or scan a barcode
                <br />
                to start a new sale.
              </p>
              <button
                className="sample-scan"
                onClick={() => {
                  setCategory('All products')
                  setQuery(state.products[0]?.barcodes.loose ?? '')
                  searchRef.current?.focus()
                }}
              >
                <ScanBarcode size={15} />
                Try a sample barcode
                <ArrowRight size={13} />
              </button>
            </div>
          ) : (
            state.cart.map((line) => {
              const product = state.products.find((p) => p.id === line.productId)!
              const batch = state.batches.find((b) => b.id === line.batchId)!
              return (
                <div className="cart-line" key={line.id}>
                  <div className="cart-line-top">
                    <ProductIcon product={product} small />
                    <div>
                      <strong>{product.name}</strong>
                      <span>Batch {batch.number}</span>
                    </div>
                    <button
                      className="icon-button"
                      aria-label={`Remove ${product.name}`}
                      onClick={() => run((s) => removeCartItem(s, line.id))}
                    >
                      <X size={15} />
                    </button>
                  </div>
                  <div className="unit-switch compact">
                    {availableUnits(product).map((unit) => (
                      <button
                        key={unit}
                        aria-pressed={line.unit === unit}
                        className={line.unit === unit ? 'active' : ''}
                        onClick={() =>
                          run((s) => {
                            const next = {
                              ...s,
                              cart: s.cart.map((l) => (l.id === line.id ? { ...l, unit } : l)),
                            }
                            cartDetails(next, today)
                            return next
                          })
                        }
                      >
                        {unitLabel(product, unit)}
                      </button>
                    ))}
                  </div>
                  <div className="cart-line-bottom">
                    <div className="quantity-stepper">
                      <button
                        aria-label={`Decrease ${product.name} quantity`}
                        onClick={() =>
                          run((s) => changeCartQuantity(s, line.id, line.quantity - 1, today))
                        }
                      >
                        <Minus size={13} />
                      </button>
                      <span>{line.quantity}</span>
                      <button
                        aria-label={`Increase ${product.name} quantity`}
                        onClick={() =>
                          run((s) => changeCartQuantity(s, line.id, line.quantity + 1, today))
                        }
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                    <strong>
                      {formatMoney(batch.pricePerBase * factor(product, line.unit) * line.quantity)}
                    </strong>
                  </div>
                </div>
              )
            })
          )}
        </div>
        <div className="cart-footer">
          <div className="cart-policy-tools">
            <button className="button button-text" onClick={() => open({ type: 'discount' })}>
              <Percent size={14} />
              Discount {formatPercent(state.cartDiscountBps)}
            </button>
            <span>{state.cartDiscountMode === 'margin' ? 'on margin' : 'on retail'}</span>
          </div>
          {!openSession(state) && (
            <div className="cash-shift-prompt">
              <Banknote size={16} />
              <div>
                <strong>Cash shift not open</strong>
                <button onClick={() => navigate('cash')}>Enter opening float →</button>
              </div>
            </div>
          )}
          {cartError && <Notice tone="error">{cartError}</Notice>}
          {details?.roundingSkipped && (
            <div className="cost-protection">
              <ShieldCheck size={15} />
              Rounding skipped to protect purchase cost.
            </div>
          )}
          {!!details?.discount && (
            <div className="summary-row">
              <span>Discount</span>
              <span className="text-green">− {formatMoney(details.discount)}</span>
            </div>
          )}
          <div className="summary-row">
            <span>Subtotal</span>
            <span>{formatMoney(details?.subtotal ?? 0)}</span>
          </div>
          <div className="summary-row">
            <span>Round-down adjustment</span>
            <span className="text-green">− {formatMoney(details?.rounding ?? 0)}</span>
          </div>
          <div className="total-row">
            <span>
              Total due<small>PKR · cash payment</small>
            </span>
            <strong data-testid="cart-total">{formatMoney(details?.total ?? 0)}</strong>
          </div>
          <div className="cart-actions">
            <button
              className="button button-secondary park-cart"
              aria-label="Park current cart"
              disabled={!state.cart.length}
              onClick={() => open({ type: 'park' })}
            >
              <Pause size={18} />
              <span>Park</span>
            </button>
            <button
              className="button button-primary checkout-button"
              disabled={!state.cart.length || !!cartError || !!storageIssue || !openSession(state)}
              onClick={() => open({ type: 'checkout' })}
            >
              Checkout
              <ArrowRight size={18} />
            </button>
          </div>
          <div className="cart-shortcuts">
            <span>
              <kbd>F4</kbd> Park cart
            </span>
            <span>
              <kbd>F8</kbd> Checkout
            </span>
          </div>
        </div>
      </aside>
    </div>
  )
}
