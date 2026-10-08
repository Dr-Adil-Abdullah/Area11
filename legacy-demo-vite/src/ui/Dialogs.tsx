import { useState, type FormEvent } from 'react'
import {
  Plus,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ShieldCheck,
  Pause,
  Play,
  Trash2,
  Printer,
  Banknote,
  Layers,
  PackagePlus,
  RotateCcw,
} from 'lucide-react'
import {
  type ProductInput,
  type PackUnit,
  type Role,
  businessDate,
  categories,
  baseUnits,
  availableUnits,
  defaultUnit,
  factor,
  formatMoney,
  formatDate,
  isExpired,
  invoiceNumber,
  parseMoney,
  parseQuantity,
  unitLabel,
  usableUnits,
} from '../domain/model'
import {
  addCartItem,
  cartDetails,
  clearCart,
  completeSale,
  createProduct,
  discardParkedCart,
  parkCart,
  resumeCart,
  sortedBatches,
} from '../domain/operations'
import { type Dialog, useWorkspace } from './workspace'
import { Empty, Modal, Notice, ProductIcon } from './common'
import { expiryLevel, expiryColor } from '../domain/alerts'
import { StockDialogs } from './StockDialogs'
import { FinanceDialogs } from './FinanceDialogs'
import { requireOpenSession } from '../domain/cash'
import { PrintReceipt, Receipt } from './Receipt'

export default function Dialogs({
  dialog,
  onProductCreated,
  onSupplierCreated,
  onReset,
}: {
  dialog: Dialog
  onProductCreated: (productId: string, rowId?: string) => void
  onSupplierCreated: (supplierId: string) => void
  onReset: (role: Role) => void
}) {
  if (dialog.type === 'batch')
    return <BatchDialog key={dialog.productId} productId={dialog.productId} />
  if (dialog.type === 'product')
    return <ProductDialog onCreated={(id) => onProductCreated(id, dialog.selectForRow)} />
  if (dialog.type === 'checkout') return <CheckoutDialog />
  if (dialog.type === 'receipt') return <ReceiptDialog key={dialog.saleId} saleId={dialog.saleId} />
  if (dialog.type === 'purchase') return <PurchaseDialog purchaseId={dialog.purchaseId} />
  if (dialog.type === 'park') return <ParkDialog />
  if (dialog.type === 'clear') return <ClearDialog />
  if (dialog.type === 'reset') return <ResetDialog onReset={onReset} />
  if (
    [
      'sales-return',
      'link-return',
      'provisional-return',
      'return-record',
      'discount',
      'contact',
    ].includes(dialog.type)
  )
    return <FinanceDialogs key={JSON.stringify(dialog)} dialog={dialog} />
  if (
    [
      'supplier',
      'supplier-balance',
      'supplier-cash',
      'supplier-return',
      'supplier-return-record',
      'reorder-policy',
    ].includes(dialog.type)
  )
    return (
      <StockDialogs
        key={JSON.stringify(dialog)}
        dialog={dialog}
        onSupplierCreated={onSupplierCreated}
      />
    )
  return <RoadmapDialog />
}

function BatchDialog({ productId }: { productId: string }) {
  const { state, today, role, run, close, navigate } = useWorkspace()
  const product = state.products.find((p) => p.id === productId)!
  const batches = sortedBatches(state, productId, today)
  const earliest = sortedBatches(state, productId, today, true)[0]
  const [batchId, setBatchId] = useState(earliest?.id ?? '')
  const [unit, setUnit] = useState<PackUnit>(product ? defaultUnit(product) : 'loose')
  const [quantity, setQuantity] = useState('1')
  const batch = batches.find((b) => b.id === batchId)
  if (!product)
    return (
      <Modal title="Product unavailable" onClose={close}>
        <Notice tone="error">This product was removed by a workspace reset.</Notice>
      </Modal>
    )
  const reserved = batch
    ? state.cart
        .filter((l) => l.batchId === batch.id)
        .reduce((sum, l) => sum + l.quantity * factor(product, l.unit), 0)
    : 0
  const needed = Number(quantity) * factor(product, unit)
  const add = (event: FormEvent) => {
    event.preventDefault()
    try {
      if (!batch) return
      const result = run(
        (s) => addCartItem(s, product.id, batch.id, unit, parseQuantity(quantity), today),
        `${product.name} added to the current sale.`,
      )
      if (result) {
        navigate('counter')
        close()
      }
    } catch {
      /* Quantity is also constrained by the form; domain validation is surfaced by run. */
    }
  }
  return (
    <Modal
      title={product.name}
      subtitle="Choose a batch and pack size. Nearest expiry first."
      onClose={close}
      wide
    >
      <div className="product-detail-summary">
        <ProductIcon product={product} />
        <div>
          <strong>{product.description || product.category}</strong>
          <span>
            1 box = {product.stripsPerBox} inner packs = {factor(product, 'box')}{' '}
            {unitLabel(product, 'loose', true)}
          </span>
        </div>
        <span className="badge badge-demo">SAMPLE WORKSPACE</span>
      </div>
      <div className="dialog-section-label">
        <Layers size={16} />
        Available batches <span>{batches.length}</span>
      </div>
      <div className="batch-list">
        {batches.map((b) => {
          const blocked = isExpired(b, today) || usableUnits(b) === 0
          const expiryAlert = expiryLevel(b, today, state.settings.expiry)
          const bonus =
            state.purchases
              .find((p) => p.id === b.purchaseId)
              ?.lines.find((l) => l.batchId === b.id)?.stockKind === 'bonus'
          return (
            <button
              key={b.id}
              className={`batch-option ${b.id === batchId ? 'selected' : ''} ${blocked ? 'batch-blocked' : ''}`}
              disabled={blocked}
              onClick={() => setBatchId(b.id)}
              aria-pressed={b.id === batchId}
            >
              <span className="batch-radio">{b.id === batchId && <span />}</span>
              <div>
                <div className="batch-title">
                  <strong>{b.number}</strong>
                  {b.id === earliest?.id && (
                    <span className="badge badge-green">NEAREST EXPIRY</span>
                  )}
                  {bonus && <span className="badge badge-blue">BONUS / SAMPLE</span>}
                  {expiryAlert && (
                    <span className="batch-expiry-label">
                      <span
                        className="alert-color-dot"
                        style={{ background: expiryColor(expiryAlert, state.settings.expiry) }}
                      />
                      {expiryAlert === 'expired'
                        ? 'Expired'
                        : expiryAlert === 'near'
                          ? 'Near expiry'
                          : expiryAlert === 'middle'
                            ? 'Expiry warning'
                            : 'Expiry watch'}
                    </span>
                  )}
                  {blocked && (
                    <span className="badge badge-warning">
                      {isExpired(b, today)
                        ? 'EXPIRED · BLOCKED'
                        : b.quarantinedUnits
                          ? 'QUARANTINED · BLOCKED'
                          : 'NO STOCK'}
                    </span>
                  )}
                </div>
                <span className="batch-meta">
                  <CalendarDays size={13} />
                  {formatDate(b.expiresOn)}
                  <span>•</span>
                  {usableUnits(b).toLocaleString()}{' '}
                  {unitLabel(product, 'loose', usableUnits(b) !== 1)} saleable
                  {b.quarantinedUnits > 0 && <span> · {b.quarantinedUnits} quarantined</span>}
                </span>
              </div>
              <div className="batch-price">
                <strong>{formatMoney(b.pricePerBase)}</strong>
                <small>per {product.baseUnit}</small>
                {role !== 'cashier' && <small>Cost {formatMoney(b.costPerBase)}</small>}
              </div>
            </button>
          )
        })}
      </div>
      {!batches.length && (
        <Empty title="No stock received yet">
          {role === 'cashier'
            ? 'Ask a manager to receive this product.'
            : 'Receive a delivery to create its first stock batch.'}
        </Empty>
      )}
      {!earliest && (
        <Notice tone="warning">This product has no unexpired stock available for sale.</Notice>
      )}
      <form onSubmit={add}>
        <div className="pack-selection">
          <div>
            <label className="field-label">Sell as</label>
            <div className="unit-switch">
              {availableUnits(product).map((u) => (
                <button
                  type="button"
                  key={u}
                  className={unit === u ? 'active' : ''}
                  aria-pressed={unit === u}
                  onClick={() => setUnit(u)}
                >
                  {unitLabel(product, u)}
                </button>
              ))}
            </div>
          </div>
          <label>
            Quantity
            <input
              aria-label="Quantity to add"
              type="number"
              min={1}
              max={1000000}
              step={1}
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </label>
        </div>
        <div className="batch-conversion">
          <span>
            {Number.isFinite(needed) ? needed.toLocaleString() : 0}{' '}
            {unitLabel(product, 'loose', needed !== 1)} from this batch
            {reserved > 0 && ` · ${reserved} already in cart`}
          </span>
          <strong>
            {formatMoney(batch && Number.isFinite(needed) ? batch.pricePerBase * needed : 0)}
          </strong>
        </div>
        {batch && needed > usableUnits(batch) - reserved && (
          <Notice tone="warning">
            Only {usableUnits(batch) - reserved} base units remain outside the current cart. Choose
            a smaller quantity or another batch.
          </Notice>
        )}
        <div className="form-actions">
          <button className="button button-secondary" type="button" onClick={close}>
            Cancel
          </button>
          <button
            className="button button-primary"
            type="submit"
            disabled={!batch || isExpired(batch, today) || needed > usableUnits(batch) - reserved}
          >
            <Plus size={17} />
            Add to sale
          </button>
        </div>
      </form>
      {Object.values(product.barcodes).some(Boolean) && (
        <div className="barcode-reference">
          <span>Pack barcodes</span>
          {Object.entries(product.barcodes)
            .filter(([, code]) => code)
            .map(([u, code]) => (
              <div key={u}>
                <span>{unitLabel(product, u as PackUnit)}</span>
                <code>{code}</code>
              </div>
            ))}
        </div>
      )}
      {!batches.length && role !== 'cashier' && (
        <button
          className="button button-text"
          onClick={() => {
            close()
            navigate('purchases')
          }}
        >
          Receive stock
          <ArrowRight size={15} />
        </button>
      )}
    </Modal>
  )
}

function ProductDialog({ onCreated }: { onCreated: (id: string) => void }) {
  const { role, run, close, notify } = useWorkspace()
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: 'Tablets' as ProductInput['category'],
    baseUnit: 'tablet' as ProductInput['baseUnit'],
    unitsPerStrip: '10',
    stripsPerBox: '10',
    box: '',
    strip: '',
    loose: '',
  })
  const submit = (event: FormEvent) => {
    event.preventDefault()
    try {
      const input: ProductInput = {
        name: form.name,
        description: form.description,
        category: form.category,
        baseUnit: form.baseUnit,
        unitsPerStrip: parseQuantity(form.unitsPerStrip),
        stripsPerBox: parseQuantity(form.stripsPerBox),
        barcodes: { box: form.box, strip: form.strip, loose: form.loose },
      }
      const result = run(
        (s) => createProduct(s, input, role),
        'Product registered. Receive stock to make it available at the counter.',
      )
      if (result) {
        onCreated(result.products.at(-1)!.id)
        close()
      }
    } catch (error) {
      notify((error as Error).message, 'error')
    }
  }
  return (
    <Modal
      title="Register a product"
      subtitle="Define its smallest unit and pack ratio once."
      onClose={close}
      wide
    >
      <form onSubmit={submit}>
        <div className="form-grid two-cols">
          <label className="full-span">
            Product name <span className="required">*</span>
            <input
              autoFocus
              required
              minLength={2}
              maxLength={100}
              placeholder="e.g. Sample medicine 500 mg"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className="full-span">
            Description <span className="optional">optional</span>
            <input
              maxLength={120}
              placeholder="Ingredient, manufacturer or a short note"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>
          <label>
            Category
            <select
              value={form.category}
              onChange={(e) =>
                setForm({ ...form, category: e.target.value as ProductInput['category'] })
              }
            >
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Smallest stock unit
            <select
              value={form.baseUnit}
              onChange={(e) =>
                setForm({ ...form, baseUnit: e.target.value as ProductInput['baseUnit'] })
              }
            >
              {baseUnits.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="dialog-section-label">
          <PackagePlus size={16} />
          Packaging ratio
        </div>
        <div className="form-grid two-cols">
          <label>
            Strips / inner packs per box
            <input
              type="number"
              required
              min={1}
              max={1000}
              step={1}
              value={form.stripsPerBox}
              onChange={(e) => setForm({ ...form, stripsPerBox: e.target.value })}
            />
          </label>
          <label>
            Base units per strip / inner pack
            <input
              type="number"
              required
              min={1}
              max={1000}
              step={1}
              value={form.unitsPerStrip}
              onChange={(e) => setForm({ ...form, unitsPerStrip: e.target.value })}
            />
          </label>
        </div>
        <div className="ratio-preview">
          <PackagePlus size={19} />
          <span>
            1 box = <strong>{form.stripsPerBox || 0} inner packs</strong> ={' '}
            <strong>
              {Number(form.stripsPerBox) * Number(form.unitsPerStrip)}{' '}
              {form.baseUnit === 'ml' ? 'ml' : `${form.baseUnit}s`}
            </strong>
          </span>
        </div>
        <div className="dialog-section-label">
          Pack barcodes <span>optional · unique across products</span>
        </div>
        <div className="form-grid three-cols">
          <label>
            Box barcode
            <input
              maxLength={50}
              value={form.box}
              onChange={(e) => setForm({ ...form, box: e.target.value })}
            />
          </label>
          <label>
            Strip / inner pack barcode
            <input
              maxLength={50}
              value={form.strip}
              onChange={(e) => setForm({ ...form, strip: e.target.value })}
            />
          </label>
          <label>
            Loose / base unit barcode
            <input
              maxLength={50}
              value={form.loose}
              onChange={(e) => setForm({ ...form, loose: e.target.value })}
            />
          </label>
        </div>
        <p className="field-help">
          For a bottle or sachet sold whole, use “piece” as the base unit. A quantity is always a
          whole number of the configured base unit in this demo.
        </p>
        <div className="form-actions">
          <button className="button button-secondary" type="button" onClick={close}>
            Cancel
          </button>
          <button className="button button-primary" type="submit">
            <Plus size={17} />
            Register product
          </button>
        </div>
      </form>
    </Modal>
  )
}

function CheckoutDialog() {
  const { state, today, role, run, notify, close, open } = useWorkspace()
  let details: ReturnType<typeof cartDetails> | undefined
  let error = ''
  try {
    details = cartDetails(state, today, state.cart, role)
    requireOpenSession(state)
  } catch (e) {
    error = (e as Error).message
  }
  const [cash, setCash] = useState(((details?.total ?? 0) / 100).toFixed(2))
  let received = 0
  try {
    received = parseMoney(cash)
  } catch {
    /* Input is incomplete. */
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    try {
      const now = new Date()
      const result = run((s) =>
        completeSale(s, parseMoney(cash), role, businessDate(now), now.toISOString()),
      )
      if (result) {
        const sale = result.sales.at(-1)!
        notify(`${sale.number} completed. Stock updated.`, 'success')
        open({ type: 'receipt', saleId: sale.id })
      }
    } catch (e) {
      notify((e as Error).message, 'error')
    }
  }
  return (
    <Modal
      title="Complete this sale"
      subtitle={`${invoiceNumber('INV', state.nextSaleNumber)} · ${state.cart.length} cart lines`}
      onClose={close}
    >
      {error ? (
        <Notice tone="error">{error}</Notice>
      ) : (
        <form onSubmit={submit}>
          <div className="payment-amount">
            <span>Amount due · PKR</span>
            <strong>{formatMoney(details!.total)}</strong>
            {details!.roundingSkipped && (
              <span className="payment-protected">
                <ShieldCheck size={14} />
                Rounding skipped to protect cost
              </span>
            )}
          </div>
          <div className="payment-method">
            <span className="metric-icon green">
              <Banknote size={23} />
            </span>
            <div>
              <strong>Cash payment</strong>
              <small>Other payment methods arrive in Phase 4.</small>
            </div>
            <CheckCircle2 size={20} />
          </div>
          <label className="cash-label">
            Cash received (Rs.)
            <input
              autoFocus
              aria-label="Cash received"
              type="number"
              min={details!.total / 100}
              step="0.01"
              required
              value={cash}
              onChange={(e) => setCash(e.target.value)}
            />
          </label>
          <div className="cash-presets">
            <button type="button" onClick={() => setCash((details!.total / 100).toFixed(2))}>
              Exact amount
            </button>
            {[500, 1000, 2000].map((amount) => (
              <button
                type="button"
                key={amount}
                disabled={amount * 100 < details!.total}
                onClick={() => setCash(String(amount))}
              >
                Rs. {amount.toLocaleString()}
              </button>
            ))}
          </div>
          <div className="change-due">
            <span>Change to return</span>
            <strong>{formatMoney(Math.max(0, received - details!.total))}</strong>
          </div>
          <Notice>
            Completing this sale deducts stock from the selected batches and creates a final
            invoice. Printing does not create another sale.
          </Notice>
          <div className="form-actions">
            <button type="button" className="button button-secondary" onClick={close}>
              Back to cart
            </button>
            <button
              type="submit"
              className="button button-primary"
              disabled={received < details!.total || !state.cart.length}
            >
              <CheckCircle2 size={17} />
              Complete sale
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}

function ReceiptDialog({ saleId }: { saleId: string }) {
  const { state, close } = useWorkspace()
  const [width, setWidth] = useState<58 | 80>(state.settings.paperWidth)
  const sale = state.sales.find((s) => s.id === saleId)
  return (
    <Modal
      title="Sale receipt"
      subtitle={sale ? `${sale.number} · Paid in cash` : 'Receipt unavailable'}
      onClose={close}
    >
      {sale ? (
        <>
          <div className="receipt-toolbar">
            <span>
              <CheckCircle2 size={17} />
              Completed sale
            </span>
            <div className="unit-switch compact">
              {([58, 80] as const).map((w) => (
                <button
                  key={w}
                  className={width === w ? 'active' : ''}
                  aria-pressed={width === w}
                  onClick={() => setWidth(w)}
                >
                  {w}mm
                </button>
              ))}
            </div>
          </div>
          <div className="receipt-stage" tabIndex={0} role="region" aria-label="Receipt paper">
            <Receipt sale={sale} settings={state.settings} width={width} />
          </div>
          <p className="field-help">
            Use the browser print dialog with the matching roll size, or choose Save as PDF. Actual
            printer hardware is not yet verified.
          </p>
          <div className="form-actions">
            <button className="button button-secondary" onClick={close}>
              Done
            </button>
            <button className="button button-primary" onClick={() => window.print()}>
              <Printer size={17} />
              Print receipt
            </button>
          </div>
          <PrintReceipt sale={sale} settings={state.settings} width={width} />
        </>
      ) : (
        <Notice tone="error">This receipt was removed by a workspace reset.</Notice>
      )}
    </Modal>
  )
}

function PurchaseDialog({ purchaseId }: { purchaseId: string }) {
  const { state, close } = useWorkspace()
  const purchase = state.purchases.find((p) => p.id === purchaseId)
  return (
    <Modal
      title={purchase?.number ?? 'Purchase unavailable'}
      subtitle={
        purchase ? `${purchase.supplier} · ${formatDate(purchase.createdAt, true)}` : undefined
      }
      onClose={close}
      wide
    >
      {purchase ? (
        <>
          <div className="purchase-confirmed">
            <CheckCircle2 size={21} />
            <div>
              <strong>Purchase recorded · stock added</strong>
              <span>Supplier reference: {purchase.reference || 'None'}</span>
            </div>
            <strong>{formatMoney(purchase.totalCost)}</strong>
          </div>
          <div className="table-scroll">
            <table className="purchase-detail-table">
              <thead>
                <tr>
                  <th>Product / batch</th>
                  <th>Quantity</th>
                  <th>Base units</th>
                  <th>Cost</th>
                </tr>
              </thead>
              <tbody>
                {purchase.lines.map((line) => (
                  <tr key={line.batchId}>
                    <td>
                      <strong>{line.productName}</strong>
                      <small>
                        {line.batchNumber} · Exp {line.expiresOn}
                        {line.stockKind === 'bonus' ? ' · BONUS / SAMPLE · ZERO COST' : ''}
                      </small>
                      <small>
                        Retail {formatMoney(line.pricePerBase)} / {line.baseUnit}
                      </small>
                    </td>
                    <td>
                      {line.quantity} {unitLabel(line, line.unit, line.quantity !== 1)}
                    </td>
                    <td>
                      {line.baseQuantity.toLocaleString()}{' '}
                      {unitLabel(line, 'loose', line.baseQuantity !== 1)}
                    </td>
                    <td>
                      <strong>{formatMoney(line.totalCost)}</strong>
                      <small>
                        {formatMoney(line.costPerBase)} / {line.baseUnit}
                      </small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Notice>
            This invoice links each received batch to its original delivery.{' '}
            {purchase.ledgerTreatment === 'account'
              ? 'Its purchase cost is posted to the supplier account, not paid from drawer cash.'
              : 'This historical invoice is reference-only until the supplier carried-forward balance is verified.'}
          </Notice>
          <div className="form-actions">
            <button className="button button-primary" onClick={close}>
              Done
              <CheckCircle2 size={16} />
            </button>
          </div>
        </>
      ) : (
        <Notice tone="error">This purchase was removed by a workspace reset.</Notice>
      )}
    </Modal>
  )
}

function ParkDialog() {
  const { state, run, close, navigate } = useWorkspace()
  const [name, setName] = useState('')
  const [discardId, setDiscardId] = useState<string | null>(null)
  return (
    <Modal
      title="Parked carts"
      subtitle="Pause one sale and serve the next customer."
      onClose={close}
    >
      {state.cart.length > 0 && (
        <form
          className="park-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (
              run(
                (s) => parkCart(s, name, new Date().toISOString()),
                'Cart parked. You can start another sale.',
              )
            )
              close()
          }}
        >
          <label>
            Label for current cart <span className="optional">optional</span>
            <input
              autoFocus
              maxLength={60}
              placeholder="Customer name or a short note"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <button className="button button-primary" type="submit">
            <Pause size={17} />
            Park this sale<span className="button-count">{state.cart.length}</span>
          </button>
        </form>
      )}
      {state.parkedCarts.length ? (
        <>
          <div className="dialog-section-label">
            Waiting carts <span>{state.parkedCarts.length}</span>
          </div>
          {state.cart.length > 0 && (
            <p className="field-help">
              Park or clear the current sale before resuming a waiting cart.
            </p>
          )}
          <div className="parked-list">
            {state.parkedCarts.map((cart) => (
              <div className="parked-item" key={cart.id}>
                <span className="metric-icon amber">
                  <Pause size={20} />
                </span>
                <div>
                  <strong>{cart.name}</strong>
                  <span>
                    {cart.lines.length} lines · {formatDate(cart.createdAt, true)}
                  </span>
                </div>
                <button
                  className="icon-button"
                  aria-label={`Discard ${cart.name}`}
                  onClick={() => setDiscardId(cart.id)}
                >
                  <Trash2 size={16} />
                </button>
                {discardId === cart.id ? (
                  <button
                    className="button button-danger-outline"
                    onClick={() => {
                      run((s) => discardParkedCart(s, cart.id), 'Parked cart removed.')
                      setDiscardId(null)
                    }}
                  >
                    Confirm removal
                  </button>
                ) : (
                  <button
                    className="button button-secondary"
                    disabled={state.cart.length > 0}
                    onClick={() => {
                      if (
                        run(
                          (s) => resumeCart(s, cart.id),
                          'Cart resumed. Stock will be checked again at checkout.',
                        )
                      ) {
                        navigate('counter')
                        close()
                      }
                    }}
                  >
                    <Play size={14} />
                    Resume
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        <Empty icon={<Pause size={30} strokeWidth={1.5} />} title="No waiting carts">
          Park an unfinished sale and pick it up here when the customer is ready.
        </Empty>
      )}
      <p className="field-help">
        Parked carts do not reserve stock. Prices and availability are checked again before payment.
      </p>
    </Modal>
  )
}
function ClearDialog() {
  const { run, close } = useWorkspace()
  return (
    <Modal
      title="Clear the current cart?"
      subtitle="This only removes an unfinished sale."
      onClose={close}
    >
      <Notice>
        No completed invoice or stock record will be deleted. You can park the cart instead if you
        want to return to it.
      </Notice>
      <div className="form-actions">
        <button className="button button-secondary" onClick={close}>
          Keep cart
        </button>
        <button
          className="button button-danger"
          onClick={() => {
            if (run(clearCart, 'Current cart cleared.')) close()
          }}
        >
          <Trash2 size={16} />
          Clear cart
        </button>
      </div>
    </Modal>
  )
}
function ResetDialog({ onReset }: { onReset: (role: Role) => void }) {
  const { role, close } = useWorkspace()
  const [confirmation, setConfirmation] = useState('')
  return (
    <Modal title="Reset this demo workspace?" subtitle="This cannot be undone." onClose={close}>
      <Notice tone="warning">
        All current products, stock entries, supplier accounts, returns, cash/account records,
        settings and parked carts in this browser will be replaced by the original sample data. This
        does not affect another device.
      </Notice>
      <label className="reset-confirmation">
        Type RESET to confirm
        <input
          autoFocus
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          autoComplete="off"
        />
      </label>
      <div className="form-actions">
        <button className="button button-secondary" onClick={close}>
          Cancel
        </button>
        <button
          className="button button-danger"
          disabled={confirmation !== 'RESET' || role !== 'owner'}
          onClick={() => onReset(role)}
        >
          <RotateCcw size={17} />
          Reset sample workspace
        </button>
      </div>
    </Modal>
  )
}
function RoadmapDialog() {
  const { close } = useWorkspace()
  const phases = [
    ['Core lifeline', 'Stock in, packaging, batches, counter billing, receipts and parked carts.'],
    [
      'Returns, cash & accounts',
      'Linked and provisional returns, shift reconciliation, drawings and expenses.',
    ],
    [
      'Smart stock & suppliers',
      'Supplier profiles/ledgers, accepted returns, configurable expiry/reorder alerts, free WhatsApp requests and zero-cost bonus stock.',
    ],
    [
      'Customers & advanced billing',
      'Credit limits, loyalty, price tiers, split payments and custom fields.',
    ],
    [
      'Intelligence & hybrid sync',
      'Audit trail, reports, stock counts, full offline sync and backups.',
    ],
  ]
  return (
    <Modal
      title="Built in the right order"
      subtitle="One phase at a time, following your master blueprint."
      onClose={close}
    >
      <div className="roadmap-list">
        {phases.map(([title, text], index) => (
          <div key={title} className={`roadmap-step ${index === 2 ? 'current' : ''}`}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <div>
              <h3>
                {title}
                {index < 2 && <span className="badge badge-green">COMPLETE</span>}
                {index === 2 && <span className="badge badge-green">CURRENT BUILD</span>}
              </h3>
              <p>{text}</p>
            </div>
          </div>
        ))}
      </div>
      <Notice>
        This is a sample-data Phase 3 demo. The role switcher is not authentication; full offline
        operation, multi-device sync and production security are not implemented yet.
      </Notice>
      <div className="form-actions">
        <button className="button button-primary" onClick={close}>
          Back to workspace
          <ArrowRight size={16} />
        </button>
      </div>
    </Modal>
  )
}
