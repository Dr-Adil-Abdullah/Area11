import { useState } from 'react'
import {
  Plus,
  ArrowDownToLine,
  Search,
  ChevronRight,
  Boxes,
  Layers,
  CalendarClock,
} from 'lucide-react'
import { factor, formatDate, formatMoney, isExpired, unitLabel, usableUnits } from '../domain/model'
import { expiryLevel, expiryColor, reorderLevel } from '../domain/alerts'
import { saleableStock, sortedBatches } from '../domain/operations'
import { useWorkspace } from '../ui/workspace'
import { Empty, PageHeading, ProductIcon } from '../ui/common'

export default function Inventory() {
  const { state, today, open, navigate } = useWorkspace()
  const [query, setQuery] = useState('')
  const products = state.products.filter(
    (p) =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      Object.values(p.barcodes).some((b) => query && b.includes(query)),
  )
  const expired = state.batches.filter((b) => isExpired(b, today) && b.stockUnits > 0)
  return (
    <div className="page-content">
      <PageHeading
        eyebrow="STOCK ROOM"
        title="Inventory"
        description="Every product, pack size and batch, in one place."
      >
        <button className="button button-secondary" onClick={() => open({ type: 'product' })}>
          <Plus size={17} />
          New product
        </button>
        <button className="button button-primary" onClick={() => navigate('purchases')}>
          <ArrowDownToLine size={17} />
          Receive stock
        </button>
      </PageHeading>
      <div className="overview-grid">
        <div className="overview-card">
          <span className="metric-icon green">
            <Boxes size={22} />
          </span>
          <div>
            <span>Registered products</span>
            <strong>{state.products.length}</strong>
            <small>Whole packs and loose units</small>
          </div>
        </div>
        <div className="overview-card">
          <span className="metric-icon blue">
            <Layers size={22} />
          </span>
          <div>
            <span>Saleable batches</span>
            <strong>
              {state.batches.filter((b) => usableUnits(b) > 0 && !isExpired(b, today)).length}
            </strong>
            <small>Nearest expiry first at the counter</small>
          </div>
        </div>
        <div className="overview-card">
          <span className="metric-icon amber">
            <CalendarClock size={22} />
          </span>
          <div>
            <span>Expired batches</span>
            <strong>{expired.length}</strong>
            <small>Blocked from counter sales</small>
          </div>
        </div>
      </div>
      {(state.batches.some((b) => b.quarantinedUnits > 0) ||
        state.provisionalReturns.some((p) => !p.linkedReturnId)) && (
        <div className="inventory-hold-note">
          <strong>
            {state.batches.reduce((n, b) => n + b.quarantinedUnits, 0)} quarantined base units
          </strong>
          <span>
            {' '}
            ·{' '}
            {state.provisionalReturns
              .filter((p) => !p.linkedReturnId)
              .reduce((n, p) => n + p.items.reduce((a, i) => a + i.baseQuantity, 0), 0)}{' '}
            unmatched base units held outside batch stock. None are saleable.
          </span>
        </div>
      )}
      <div className="surface">
        <div className="surface-heading">
          <div>
            <h2>Product catalog</h2>
            <p>Inventory is stored in the smallest configured unit.</p>
          </div>
          <div className="search-field small-search">
            <Search size={17} />
            <input
              aria-label="Search inventory"
              placeholder="Find a product…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Packaging</th>
                <th>Saleable stock</th>
                <th>Next expiry</th>
                <th>Retail / base unit</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const batches = sortedBatches(state, p.id, today, true)
                const count = saleableStock(state, p.id, today)
                const stockAlert = reorderLevel(p, count)
                const expiryAlert = batches[0]
                  ? expiryLevel(batches[0], today, state.settings.expiry)
                  : null
                return (
                  <tr key={p.id}>
                    <td>
                      <div className="table-product">
                        <ProductIcon product={p} small />
                        <div>
                          <strong>{p.name}</strong>
                          <small>
                            {p.category} · {sortedBatches(state, p.id, today).length} batches
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <strong>
                        1 box = {factor(p, 'box')} {unitLabel(p, 'loose', true)}
                      </strong>
                      <small>
                        {p.stripsPerBox} inner packs × {p.unitsPerStrip} units
                      </small>
                    </td>
                    <td>
                      <span className={`stock-pill ${count ? '' : 'stock-empty'}`}>
                        {count.toLocaleString()} {unitLabel(p, 'loose', count !== 1)}
                      </span>
                      {stockAlert && (
                        <small>
                          <span className={`reorder-status reorder-${stockAlert}`}>
                            {stockAlert === 'out'
                              ? 'OUT OF STOCK'
                              : stockAlert === 'critical'
                                ? 'CRITICAL'
                                : 'REORDER WARNING'}
                          </span>
                        </small>
                      )}
                      {state.batches.some(
                        (b) => b.productId === p.id && b.quarantinedUnits > 0,
                      ) && (
                        <small>
                          {state.batches
                            .filter((b) => b.productId === p.id)
                            .reduce((n, b) => n + b.quarantinedUnits, 0)}{' '}
                          quarantined
                        </small>
                      )}
                    </td>
                    <td>
                      {batches[0] ? formatDate(batches[0].expiresOn) : '—'}
                      {expiryAlert && (
                        <small className="expiry-date">
                          <span
                            className="alert-color-dot"
                            style={{ background: expiryColor(expiryAlert, state.settings.expiry) }}
                          />
                          {expiryAlert === 'near'
                            ? 'Near expiry'
                            : expiryAlert === 'middle'
                              ? 'Expiry warning'
                              : 'Expiry watch'}
                        </small>
                      )}
                    </td>
                    <td>{batches[0] ? formatMoney(batches[0].pricePerBase) : '—'}</td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`View ${p.name} batches`}
                        onClick={() => open({ type: 'batch', productId: p.id })}
                      >
                        <ChevronRight size={18} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {!products.length && (
          <Empty title="No matching products">Try another name or register a new product.</Empty>
        )}
      </div>
      <p className="page-footnote">
        Expired and quarantined units remain in inventory but are excluded from saleable stock. Use
        Expiry to review alert bands and original-supplier returns; Reorder prepares
        supplier-specific purchase requests.
      </p>
    </div>
  )
}
