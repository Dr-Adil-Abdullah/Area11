import { useState, type FormEvent } from 'react'
import {
  Plus,
  Trash2,
  ArrowDownToLine,
  ArrowRight,
  PackagePlus,
  Search,
  CheckCircle2,
} from 'lucide-react'
import {
  type PackUnit,
  type AppState,
  uid,
  invoiceNumber,
  availableUnits,
  factor,
  formatMoney,
  formatDate,
  parseMoney,
  parseQuantity,
  unitLabel,
} from '../domain/model'
import { receiveStock, sortedBatches } from '../domain/operations'
import { useWorkspace } from '../ui/workspace'
import { Empty, Notice, PageHeading } from '../ui/common'

export interface DraftLine {
  id: string
  productId: string
  unit: PackUnit
  quantity: string
  batchNumber: string
  expiresOn: string
  cost: string
  price: string
  stockKind: 'standard' | 'bonus'
}
export interface StockDraft {
  supplierId: string
  supplier: string
  reference: string
  lines: DraftLine[]
}
export const blankDraftLine = (): DraftLine => ({
  id: uid(),
  productId: '',
  unit: 'box',
  quantity: '1',
  batchNumber: '',
  expiresOn: '',
  cost: '',
  price: '',
  stockKind: 'standard',
})
export const blankStockDraft = (): StockDraft => ({
  supplier: '',
  supplierId: '',
  reference: '',
  lines: [blankDraftLine()],
})
export function selectDraftProduct(
  state: AppState,
  line: DraftLine,
  productId: string,
  today: string,
): DraftLine {
  const product = state.products.find((p) => p.id === productId)
  const batch = sortedBatches(state, productId, today, true)[0]
  return {
    ...line,
    productId,
    unit: product && availableUnits(product).includes('box') ? 'box' : 'loose',
    cost: line.stockKind === 'bonus' ? '0.00' : batch ? (batch.costPerBase / 100).toFixed(2) : '',
    price: batch ? (batch.pricePerBase / 100).toFixed(2) : '',
    batchNumber: '',
    expiresOn: '',
  }
}

export default function Purchases({
  draft,
  onChange,
}: {
  draft: StockDraft
  onChange: (draft: StockDraft) => void
}) {
  const { state, role, today, run, notify, open } = useWorkspace()
  const [tab, setTab] = useState<'receive' | 'history'>('receive')
  const [query, setQuery] = useState('')
  const updateLine = (id: string, patch: Partial<DraftLine>) =>
    onChange({ ...draft, lines: draft.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) })
  const lineValue = (line: DraftLine) => {
    try {
      const p = state.products.find((p) => p.id === line.productId)
      return p ? parseQuantity(line.quantity) * factor(p, line.unit) * parseMoney(line.cost) : 0
    } catch {
      return 0
    }
  }
  const total = draft.lines.reduce((sum, line) => sum + lineValue(line), 0)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    try {
      const input = {
        supplier: draft.supplier,
        supplierId: draft.supplierId,
        reference: draft.reference,
        lines: draft.lines.map((line) => ({
          productId: line.productId,
          unit: line.unit,
          quantity: parseQuantity(line.quantity),
          batchNumber: line.batchNumber,
          expiresOn: line.expiresOn,
          costPerBase: parseMoney(line.cost),
          pricePerBase: parseMoney(line.price),
          stockKind: line.stockKind,
        })),
      }
      const result = run(
        (s) => receiveStock(s, input, role, new Date().toISOString()),
        'Stock received. The purchase invoice and batches have been saved.',
      )
      if (result) {
        onChange(blankStockDraft())
        open({ type: 'purchase', purchaseId: result.purchases.at(-1)!.id })
      }
    } catch (error) {
      notify((error as Error).message, 'error')
    }
  }
  const purchases = [...state.purchases]
    .reverse()
    .filter((p) => `${p.number} ${p.supplier}`.toLowerCase().includes(query.toLowerCase()))
  return (
    <div className="page-content">
      <PageHeading
        eyebrow="PURCHASING"
        title="Stock in"
        description="Receive a delivery. Let the pack math take care of itself."
      >
        <div className="next-invoice">
          <span>Next purchase invoice</span>
          <strong>{invoiceNumber('PINV', state.nextPurchaseNumber)}</strong>
        </div>
      </PageHeading>
      <div className="page-tabs">
        <button className={tab === 'receive' ? 'active' : ''} onClick={() => setTab('receive')}>
          <PackagePlus size={16} />
          Receive stock
        </button>
        <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>
          Purchase history<span>{state.purchases.length}</span>
        </button>
      </div>
      {tab === 'receive' ? (
        <form onSubmit={submit}>
          <div className="surface delivery-details">
            <div className="section-title">
              <span className="step-number">1</span>
              <div>
                <h2>Delivery details</h2>
                <p>
                  Select a linked supplier account. Costs post automatically; cash payment is
                  separate.
                </p>
              </div>
            </div>
            <div className="form-grid two-cols">
              <div className="supplier-select-with-create">
                <label>
                  Supplier profile <span className="required">*</span>
                  <select
                    aria-label="Supplier profile"
                    required
                    value={draft.supplierId}
                    onChange={(e) => {
                      const supplier = state.suppliers.find((s) => s.id === e.target.value)
                      onChange({
                        ...draft,
                        supplierId: e.target.value,
                        supplier: supplier?.name ?? '',
                      })
                    }}
                  >
                    <option value="">Select a supplier…</option>
                    {state.suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                        {s.openingConfirmed ? '' : ' · balance verification pending'}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => open({ type: 'supplier', selectForPurchase: true })}
                >
                  <Plus size={16} />
                  New supplier
                </button>
              </div>
              <label>
                Supplier reference <span className="optional">optional</span>
                <input
                  maxLength={80}
                  placeholder="Delivery note or supplier bill number"
                  value={draft.reference}
                  onChange={(e) => onChange({ ...draft, reference: e.target.value })}
                />
              </label>
            </div>
          </div>
          <div className="surface stock-lines">
            <div className="section-title">
              <span className="step-number">2</span>
              <div>
                <h2>Items in this delivery</h2>
                <p>Enter prices per smallest unit, not per box.</p>
              </div>
            </div>
            {draft.lines.map((line, index) => {
              const p = state.products.find((p) => p.id === line.productId)
              const units = p
                ? availableUnits(p)
                : ['box' as const, 'strip' as const, 'loose' as const]
              const count = p ? Number(line.quantity) * factor(p, line.unit) : 0
              return (
                <div className="stock-entry" key={line.id}>
                  <div className="stock-entry-heading">
                    <strong>Item {String(index + 1).padStart(2, '0')}</strong>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Remove stock item ${index + 1}`}
                      disabled={draft.lines.length === 1}
                      onClick={() =>
                        onChange({ ...draft, lines: draft.lines.filter((l) => l.id !== line.id) })
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="form-grid stock-product-row">
                    <label>
                      Product <span className="required">*</span>
                      <select
                        required
                        aria-label={`Product for stock item ${index + 1}`}
                        value={line.productId}
                        onChange={(e) =>
                          updateLine(
                            line.id,
                            selectDraftProduct(state, line, e.target.value, today),
                          )
                        }
                      >
                        <option value="">Select a product…</option>
                        {state.products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="button button-secondary new-product-inline"
                      onClick={() => open({ type: 'product', selectForRow: line.id })}
                    >
                      <Plus size={16} />
                      New product
                    </button>
                  </div>
                  <div className="bonus-stock-control">
                    <label>
                      Stock type
                      <select
                        aria-label={`Stock type for item ${index + 1}`}
                        value={line.stockKind}
                        onChange={(e) =>
                          updateLine(line.id, {
                            stockKind: e.target.value as DraftLine['stockKind'],
                            cost: e.target.value === 'bonus' ? '0.00' : line.cost,
                          })
                        }
                      >
                        <option value="standard">Standard purchased stock</option>
                        <option value="bonus">Sample / bonus · zero purchase cost</option>
                      </select>
                    </label>
                    {line.stockKind === 'bonus' && (
                      <span className="badge badge-green">ZERO COST · STOCK ONLY</span>
                    )}
                  </div>
                  <div className="form-grid three-cols">
                    <label>
                      Purchase unit
                      <select
                        aria-label={`Purchase unit for stock item ${index + 1}`}
                        value={line.unit}
                        onChange={(e) => updateLine(line.id, { unit: e.target.value as PackUnit })}
                      >
                        {units.map((unit) => (
                          <option key={unit} value={unit}>
                            {p ? unitLabel(p, unit) : unit}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Quantity <span className="required">*</span>
                      <input
                        aria-label={`Quantity for stock item ${index + 1}`}
                        type="number"
                        min={1}
                        max={1000000}
                        step={1}
                        required
                        value={line.quantity}
                        onChange={(e) => updateLine(line.id, { quantity: e.target.value })}
                      />
                    </label>
                    <label>
                      Batch number <span className="required">*</span>
                      <input
                        aria-label={`Batch number for stock item ${index + 1}`}
                        required
                        maxLength={50}
                        placeholder="e.g. BT-2409"
                        value={line.batchNumber}
                        onChange={(e) => updateLine(line.id, { batchNumber: e.target.value })}
                      />
                    </label>
                  </div>
                  <div className="form-grid three-cols">
                    <label>
                      Expiry date <span className="required">*</span>
                      <input
                        aria-label={`Expiry date for stock item ${index + 1}`}
                        type="date"
                        required
                        value={line.expiresOn}
                        onChange={(e) => updateLine(line.id, { expiresOn: e.target.value })}
                      />
                    </label>
                    <label>
                      Cost / {p?.baseUnit ?? 'base unit'} (Rs.) <span className="required">*</span>
                      <input
                        aria-label={`Cost per base unit for stock item ${index + 1}`}
                        type="number"
                        required
                        min={0}
                        step="0.01"
                        placeholder="0.00"
                        readOnly={line.stockKind === 'bonus'}
                        value={line.stockKind === 'bonus' ? '0.00' : line.cost}
                        onChange={(e) => updateLine(line.id, { cost: e.target.value })}
                      />
                    </label>
                    <label>
                      Retail / {p?.baseUnit ?? 'base unit'} (Rs.){' '}
                      <span className="required">*</span>
                      <input
                        aria-label={`Retail per base unit for stock item ${index + 1}`}
                        type="number"
                        required
                        min={0}
                        step="0.01"
                        placeholder="0.00"
                        value={line.price}
                        onChange={(e) => updateLine(line.id, { price: e.target.value })}
                      />
                    </label>
                  </div>
                  <div className="conversion-note">
                    <CheckCircle2 size={16} />
                    <span>
                      {p ? (
                        <>
                          {line.quantity || '0'}{' '}
                          {unitLabel(p, line.unit, Number(line.quantity) !== 1)} ={' '}
                          <strong>
                            {Number.isFinite(count) ? count.toLocaleString() : 0}{' '}
                            {unitLabel(p, 'loose', count !== 1)}
                          </strong>{' '}
                          added to this batch
                        </>
                      ) : (
                        'Select a product to preview the pack conversion.'
                      )}
                    </span>
                    <strong>{formatMoney(lineValue(line))}</strong>
                  </div>
                </div>
              )
            })}
            <button
              type="button"
              className="button button-dashed"
              onClick={() => onChange({ ...draft, lines: [...draft.lines, blankDraftLine()] })}
            >
              <Plus size={17} />
              Add another item
            </button>
          </div>
          <div className="stock-submit-bar">
            <div>
              <span>Purchase total</span>
              <strong>{formatMoney(total)}</strong>
              <small>
                {draft.lines.length} delivery {draft.lines.length === 1 ? 'item' : 'items'} · PKR
              </small>
            </div>
            <button className="button button-primary" type="submit">
              <ArrowDownToLine size={18} />
              Receive & save stock
              <ArrowRight size={17} />
            </button>
          </div>
          <Notice>
            Stock, purchase invoice and supplier account charge are saved together in this browser.
            Bonus quantities have zero purchase cost. No cash payment is made by receiving a
            delivery, and no cloud server is connected.
          </Notice>
        </form>
      ) : (
        <div className="surface">
          <div className="surface-heading">
            <div>
              <h2>Purchase invoices</h2>
              <p>Includes the initial sample deliveries.</p>
            </div>
            <div className="search-field small-search">
              <Search size={17} />
              <input
                aria-label="Search purchase invoices"
                placeholder="Invoice or supplier…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Supplier</th>
                  <th>Received</th>
                  <th>Items</th>
                  <th>Purchase total</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.number}</strong>
                      <small>{p.reference || 'No supplier reference'}</small>
                    </td>
                    <td>{p.supplier}</td>
                    <td>{formatDate(p.createdAt, true)}</td>
                    <td>{p.lines.length}</td>
                    <td>
                      <strong>{formatMoney(p.totalCost)}</strong>
                    </td>
                    <td>
                      <button
                        className="button button-text"
                        onClick={() => open({ type: 'purchase', purchaseId: p.id })}
                      >
                        View
                        <ArrowRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!purchases.length && (
            <Empty title="No purchases found">Receive a delivery or try a different search.</Empty>
          )}
        </div>
      )}
    </div>
  )
}
