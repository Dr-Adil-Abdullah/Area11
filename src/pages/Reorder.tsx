import { useEffect, useState } from 'react'
import { PackageSearch, SlidersHorizontal, Copy, ExternalLink, CheckCircle2 } from 'lucide-react'
import { reorderRows, buildPurchaseOrder, type ReorderLevel } from '../domain/alerts'
import { useWorkspace } from '../ui/workspace'
import { Empty, Notice, PageHeading } from '../ui/common'

export default function ReorderPage() {
  const { state, today, role, open, notify } = useWorkspace()
  const [supplierId, setSupplierId] = useState('')
  const [stage, setStage] = useState<'all' | Exclude<ReorderLevel, null>>('all')
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [reviewed, setReviewed] = useState(false)
  const allRows = reorderRows(state, today, supplierId)
  const rows = allRows.filter((r) => stage === 'all' || r.level === stage)
  useEffect(() => {
    setQuantities({})
    setReviewed(false)
  }, [supplierId])
  const selectedLines = Object.entries(quantities).map(([productId, qty]) => ({
    productId,
    baseQuantity: Number(qty),
  }))
  let prepared: ReturnType<typeof buildPurchaseOrder> | undefined
  let error = ''
  if (supplierId && selectedLines.length) {
    try {
      prepared = buildPurchaseOrder(state, supplierId, selectedLines, role, today)
    } catch (e) {
      error = (e as Error).message
    }
  }
  const copy = async () => {
    if (!prepared) return
    try {
      await navigator.clipboard.writeText(prepared.text)
      notify(
        'Purchase request copied. Review it and send manually; no purchase was posted.',
        'success',
      )
    } catch {
      notify('Clipboard is unavailable. Select and copy the request text manually.', 'error')
    }
  }
  return (
    <div className="page-content">
      <PageHeading
        eyebrow="STOCK REPLENISHMENT"
        title="Reorder desk"
        description="Three stock stages based on saleable units, not expired or quarantined stock."
      >
        <button
          className="button button-secondary"
          onClick={() => open({ type: 'reorder-policy' })}
        >
          <SlidersHorizontal size={16} />
          Configure product thresholds
        </button>
      </PageHeading>
      <div className="overview-grid">
        {(['warning', 'critical', 'out'] as const).map((l) => (
          <div className="overview-card" key={l}>
            <span
              className={`metric-icon ${l === 'warning' ? 'blue' : l === 'critical' ? 'amber' : 'red'}`}
            >
              <PackageSearch size={21} />
            </span>
            <div>
              <span>
                {l === 'warning'
                  ? 'Reorder warning'
                  : l === 'critical'
                    ? 'Critical · order now'
                    : 'Out of stock'}
              </span>
              <strong>{allRows.filter((r) => r.level === l).length}</strong>
              <small>
                {l === 'out' ? 'Zero saleable units' : 'Per-product limits, in base units'}
              </small>
            </div>
          </div>
        ))}
      </div>
      <section className="surface">
        <div className="surface-heading">
          <div>
            <h2>Low-stock products</h2>
            <p>
              Prefer one supplier per product; unassigned multi-supplier goods require a supplier
              choice.
            </p>
          </div>
          <label className="sr-select-label">
            <span className="sr-only">Reorder supplier filter</span>
            <select
              aria-label="Reorder supplier filter"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
            >
              <option value="">All suppliers · choose one to prepare order</option>
              {state.suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="page-tabs reorder-stage-tabs">
          {(['all', 'warning', 'critical', 'out'] as const).map((s) => (
            <button key={s} className={stage === s ? 'active' : ''} onClick={() => setStage(s)}>
              {s === 'all'
                ? 'All stages'
                : s === 'warning'
                  ? 'Warning'
                  : s === 'critical'
                    ? 'Critical'
                    : 'Out of stock'}
            </button>
          ))}
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Stage</th>
                <th>Saleable</th>
                <th>Critical / warning / target</th>
                <th>Order base units</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.product.id}>
                  <td>
                    <strong>{r.product.name}</strong>
                    <small>
                      {r.supplierIds
                        .map((id) => state.suppliers.find((s) => s.id === id)?.name)
                        .join(', ') || 'No preferred supplier or receipt history'}
                    </small>
                  </td>
                  <td>
                    <span className={`reorder-status reorder-${r.level}`}>
                      {r.level === 'out'
                        ? 'OUT OF STOCK'
                        : r.level === 'critical'
                          ? 'CRITICAL'
                          : 'WARNING'}
                    </span>
                  </td>
                  <td>
                    {r.available} {r.product.baseUnit}
                    {r.product.baseUnit === 'ml' || r.available === 1 ? '' : 's'}
                  </td>
                  <td>
                    {r.product.reorder.criticalUnits} / {r.product.reorder.warningUnits} /{' '}
                    {r.product.reorder.targetUnits}
                  </td>
                  <td>
                    <div className="order-quantity">
                      <input
                        type="checkbox"
                        aria-label={`Order ${r.product.name}`}
                        disabled={!supplierId}
                        checked={r.product.id in quantities}
                        onChange={(e) => {
                          const next = { ...quantities }
                          if (e.target.checked) next[r.product.id] = String(r.suggested)
                          else delete next[r.product.id]
                          setQuantities(next)
                          setReviewed(false)
                        }}
                      />
                      <input
                        aria-label={`Order base units for ${r.product.name}`}
                        type="number"
                        min={1}
                        max={1000000000000}
                        step={1}
                        disabled={!(r.product.id in quantities)}
                        value={quantities[r.product.id] ?? String(r.suggested)}
                        onChange={(e) => {
                          setQuantities({ ...quantities, [r.product.id]: e.target.value })
                          setReviewed(false)
                        }}
                      />
                    </div>
                  </td>
                  <td>
                    <button
                      className="icon-button"
                      aria-label={`Configure ${r.product.name} reorder`}
                      onClick={() => open({ type: 'reorder-policy', productId: r.product.id })}
                    >
                      <SlidersHorizontal size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <Empty title="No low-stock products in this filter">
            Adjust a product's sample thresholds or complete a sample sale to test the alert stages.
          </Empty>
        )}
      </section>
      <section className="surface finance-history finance-padding">
        <div className="section-title">
          <span className="metric-icon green">
            <Copy size={20} />
          </span>
          <div>
            <h2>Free WhatsApp Web purchase request</h2>
            <p>A draft message, not a paid API integration or a posted purchase.</p>
          </div>
        </div>
        {!supplierId && (
          <Notice>
            Select one supplier above, then check the products to include. Each order is kept
            supplier-specific.
          </Notice>
        )}
        {error && <Notice tone="error">{error}</Notice>}
        {prepared && (
          <>
            <label>
              Review the exact request
              <textarea
                aria-label="Purchase request preview"
                rows={9}
                readOnly
                value={prepared.text}
              />
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={reviewed}
                onChange={(e) => setReviewed(e.target.checked)}
              />
              I reviewed the supplier, base-unit quantities and message before opening WhatsApp.
            </label>
            <div className="supplier-actions">
              <button className="button button-secondary" onClick={copy}>
                <Copy size={16} />
                Copy purchase request
              </button>
              {prepared.whatsappWebUrl ? (
                <a
                  className={`button button-primary ${!reviewed ? 'link-disabled' : ''}`}
                  aria-disabled={!reviewed}
                  href={reviewed ? prepared.whatsappWebUrl : undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink size={16} />
                  Open WhatsApp Web
                </a>
              ) : (
                <Notice tone="warning">
                  Add a valid international/mobile phone number to this supplier profile to enable
                  the WhatsApp link. You can still copy the text.
                </Notice>
              )}
            </div>
          </>
        )}
        {supplierId && !prepared && !error && (
          <Empty icon={<CheckCircle2 size={29} />} title="Select products for this supplier">
            Quantities default to target minus saleable stock, in smallest units. You can change
            them before preparing the message.
          </Empty>
        )}
        <p className="field-help">
          The link opens WhatsApp Web; login may be required and you decide whether to send. We do
          not claim the message was delivered. Preparing/copying/opening a request does not change
          cash, supplier balance, stock or invoices.
        </p>
      </section>
    </div>
  )
}
