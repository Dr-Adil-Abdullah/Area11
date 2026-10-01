import { useState } from 'react'
import { Search, RotateCcw, AlertCircle, Link2, ArrowUpRight, ShieldCheck } from 'lucide-react'
import { formatDate, formatMoney } from '../domain/model'
import { lookupSales } from '../domain/returns'
import { useWorkspace } from '../ui/workspace'
import { Empty, Notice, PageHeading } from '../ui/common'

export default function ReturnsPage() {
  const { state, role, open } = useWorkspace()
  const [query, setQuery] = useState('')
  const [phone, setPhone] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  let error = ''
  let sales: ReturnType<typeof lookupSales> = []
  try {
    sales = lookupSales(state, query, phone, from, to)
  } catch (e) {
    error = (e as Error).message
  }
  const pending = state.provisionalReturns.filter((p) => !p.linkedReturnId)
  return (
    <div className="page-content">
      <PageHeading
        eyebrow="COUNTER FOLLOW-UP"
        title="Returns & refunds"
        description="Find the original bill. Keep cash and batch stock in agreement."
      >
        <button
          className="button button-secondary"
          onClick={() => open({ type: 'provisional-return' })}
        >
          <AlertCircle size={16} />
          Provisional return
        </button>
      </PageHeading>
      <div className="finance-grid">
        <section className="surface">
          <div className="surface-heading">
            <div>
              <h2>Find the original invoice</h2>
              <p>Search an invoice, medicine name, phone or approximate date.</p>
            </div>
            <Search size={20} />
          </div>
          <div className="finance-filters form-grid two-cols">
            <label>
              Invoice or medicine
              <input
                aria-label="Invoice or medicine search"
                placeholder="INV-0001 or product name"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <label>
              Receipt phone
              <input
                type="tel"
                aria-label="Receipt phone search"
                placeholder="Optional phone digits"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </label>
            <label>
              From date
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label>
              To date
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
          </div>
          {error && (
            <div className="finance-padding">
              <Notice tone="error">{error}</Notice>
            </div>
          )}
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Original bill</th>
                  <th>Collected</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale) => (
                  <tr key={sale.id}>
                    <td>
                      <strong>{sale.number}</strong>
                      <small>{formatDate(sale.createdAt, true)}</small>
                      <small>{sale.customerPhone || 'Walk-in · no phone recorded'}</small>
                    </td>
                    <td>
                      <strong>{formatMoney(sale.total)}</strong>
                      <small>{sale.lines.length} lines</small>
                    </td>
                    <td>
                      <button
                        className="button button-text"
                        onClick={() => open({ type: 'sales-return', saleId: sale.id })}
                      >
                        <RotateCcw size={14} />
                        Return items
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!sales.length && !error && (
            <Empty title="No matching invoices">
              Complete a sample sale first, or widen the search and date range.
            </Empty>
          )}
        </section>
        <section className="surface pending-queue" aria-label="Pending provisional returns">
          <div className="surface-heading">
            <div>
              <h2>
                Pending bill links <span className="heading-count">{pending.length}</span>
              </h2>
              <p>Alerts remain until the original invoice is verified.</p>
            </div>
            <AlertCircle size={20} />
          </div>
          {pending.length ? (
            <div className="pending-cards">
              {pending.map((p) => (
                <article className="pending-card" key={p.id}>
                  <div>
                    <strong>{p.number}</strong>
                    <span className="badge badge-warning">PENDING</span>
                  </div>
                  <p>
                    {p.items
                      .map((i) => `${i.productName} × ${i.baseQuantity} base units`)
                      .join(', ')}
                  </p>
                  <span>{formatDate(p.createdAt, true)}</span>
                  <div className="pending-refund">
                    <span>Already refunded</span>
                    <strong>{formatMoney(p.refundPaid)}</strong>
                  </div>
                  <p>
                    {p.phone || 'No phone'} · {p.reason}
                  </p>
                  <button
                    className="button button-secondary"
                    disabled={role === 'cashier'}
                    onClick={() => open({ type: 'link-return', provisionalId: p.id })}
                  >
                    <Link2 size={14} />
                    Verify & link bill
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <Empty icon={<ShieldCheck size={31} />} title="All bill links clear">
              Unmatched returns will stay visible here. Nothing is silently dismissed.
            </Empty>
          )}
          <div className="finance-padding">
            <Notice tone="warning">
              Unknown-batch goods are held outside saleable inventory. Only Owner/Manager can link a
              pending case. Cashier returns are quarantined.
            </Notice>
          </div>
        </section>
      </div>
      <section className="surface finance-history">
        <div className="surface-heading">
          <div>
            <h2>Linked return history</h2>
            <p>Refunds use actual collected prices, including discounts and rounding.</p>
          </div>
          <RotateCcw size={20} />
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Return</th>
                <th>Original invoice</th>
                <th>Reason</th>
                <th>Allocated refund</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {[...state.salesReturns].reverse().map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.number}</strong>
                    <small>{formatDate(r.createdAt, true)}</small>
                  </td>
                  <td>
                    <strong>{state.sales.find((sale) => sale.id === r.saleId)?.number}</strong>
                    <small>{r.provisionalId ? 'Provisional case resolved' : 'Direct return'}</small>
                  </td>
                  <td>{r.reason}</td>
                  <td>
                    <strong>{formatMoney(r.refund)}</strong>
                  </td>
                  <td>
                    <button
                      className="button button-text"
                      onClick={() => open({ type: 'return-record', returnId: r.id })}
                    >
                      Details
                      <ArrowUpRight size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!state.salesReturns.length && (
          <Empty title="No linked returns yet">
            Return a specific quantity against its original invoice to create a traceable record.
          </Empty>
        )}
      </section>
    </div>
  )
}
