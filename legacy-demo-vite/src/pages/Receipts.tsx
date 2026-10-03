import { useState } from 'react'
import { Search, ReceiptText, ArrowUpRight, RotateCcw } from 'lucide-react'
import { formatMoney, formatDate } from '../domain/model'
import { useWorkspace } from '../ui/workspace'
import { Empty, PageHeading } from '../ui/common'

export default function Receipts() {
  const { state, open, navigate } = useWorkspace()
  const [query, setQuery] = useState('')
  const sales = [...state.sales]
    .reverse()
    .filter((s) => s.number.toLowerCase().includes(query.toLowerCase()))
  return (
    <div className="page-content">
      <PageHeading
        eyebrow="COUNTER RECORDS"
        title="Sale receipts"
        description="Completed bills, ready to view or print again."
      >
        <button className="button button-primary" onClick={() => navigate('counter')}>
          New sale
          <ArrowUpRight size={17} />
        </button>
      </PageHeading>
      <div className="surface">
        <div className="surface-heading">
          <div>
            <h2>
              Completed sales <span className="heading-count">{state.sales.length}</span>
            </h2>
            <p>
              Invoices remain final snapshots. Linked refunds are tracked separately under Returns.
            </p>
          </div>
          <div className="search-field small-search">
            <Search size={17} />
            <input
              aria-label="Search sale receipts"
              placeholder="Search invoice number…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        {sales.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Date & time (PKT)</th>
                  <th>Items</th>
                  <th>Payment</th>
                  <th>Total</th>
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
                      <small>
                        {sale.customerPhone || 'Walk-in'} · {sale.role}
                      </small>
                    </td>
                    <td>{formatDate(sale.createdAt, true)}</td>
                    <td>{sale.lines.length} lines</td>
                    <td>
                      <span className="stock-pill">Cash</span>
                    </td>
                    <td>
                      <strong>{formatMoney(sale.total)}</strong>
                    </td>
                    <td>
                      <button
                        className="button button-text"
                        onClick={() => open({ type: 'receipt', saleId: sale.id })}
                      >
                        View receipt
                        <ArrowUpRight size={14} />
                      </button>
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
        ) : (
          <Empty
            icon={<ReceiptText size={33} strokeWidth={1.5} />}
            title={state.sales.length ? 'No matching receipts' : 'Your first sale starts here'}
          >
            {state.sales.length
              ? 'Try another invoice number.'
              : 'Complete a cash sale at the counter. Its invoice will appear here automatically.'}
          </Empty>
        )}
      </div>
    </div>
  )
}
