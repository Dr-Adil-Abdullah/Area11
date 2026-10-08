import { useState } from 'react'
import {
  Truck,
  Plus,
  Search,
  Banknote,
  RotateCcw,
  Pencil,
  FileCheck2,
  ArrowUpRight,
} from 'lucide-react'
import { formatMoney, formatDate } from '../domain/model'
import { supplierBalance, supplierLedger } from '../domain/suppliers'
import { useWorkspace } from '../ui/workspace'
import { Empty, Notice, PageHeading } from '../ui/common'

export default function SuppliersPage() {
  const { state, open, navigate } = useWorkspace()
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const suppliers = state.suppliers.filter((s) =>
    `${s.name} ${s.agency} ${s.phone}`.toLowerCase().includes(query.toLowerCase()),
  )
  const selected = state.suppliers.find((s) => s.id === selectedId) ?? suppliers[0]
  const ledger = selected ? supplierLedger(state, selected.id) : []
  const balance = selected?.openingConfirmed ? supplierBalance(state, selected.id) : null
  const legacy = state.purchases.filter(
    (p) => p.supplierId === selected?.id && p.ledgerTreatment === 'legacy-reference',
  )
  const returns = state.supplierReturns.filter((r) => r.supplierId === selected?.id)
  return (
    <div className="page-content">
      <PageHeading
        eyebrow="PURCHASING RELATIONSHIPS"
        title="Suppliers & ledgers"
        description="Profiles, original deliveries, accepted credits and actual cash settlements."
      >
        <button className="button button-primary" onClick={() => open({ type: 'supplier' })}>
          <Plus size={17} />
          New supplier
        </button>
      </PageHeading>
      <div className="overview-grid">
        <div className="overview-card">
          <span className="metric-icon blue">
            <Truck size={21} />
          </span>
          <div>
            <span>Supplier profiles</span>
            <strong>{state.suppliers.length}</strong>
            <small>Contact details and linked stock deliveries</small>
          </div>
        </div>
        <div className="overview-card">
          <span className="metric-icon amber">
            <FileCheck2 size={21} />
          </span>
          <div>
            <span>Balances to verify</span>
            <strong>{state.suppliers.filter((s) => !s.openingConfirmed).length}</strong>
            <small>Old payments are not assumed unpaid</small>
          </div>
        </div>
        <div className="overview-card">
          <span className="metric-icon green">
            <RotateCcw size={21} />
          </span>
          <div>
            <span>Accepted supplier returns</span>
            <strong>{state.supplierReturns.length}</strong>
            <small>Credit notes, not a second cash refund</small>
          </div>
        </div>
      </div>
      <div className="supplier-workspace">
        <section className="surface supplier-directory">
          <div className="surface-heading">
            <div>
              <h2>Supplier directory</h2>
              <p>Select an account to inspect its records.</p>
            </div>
          </div>
          <div className="finance-padding search-field">
            <Search size={17} />
            <input
              aria-label="Search suppliers"
              placeholder="Name, agency or phone…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="supplier-list">
            {suppliers.map((s) => {
              const amount = s.openingConfirmed ? supplierBalance(state, s.id) : null
              return (
                <button
                  key={s.id}
                  className={`supplier-list-item ${selected?.id === s.id ? 'selected' : ''}`}
                  aria-pressed={selected?.id === s.id}
                  onClick={() => setSelectedId(s.id)}
                >
                  <span className="supplier-initial">{s.name.slice(0, 1).toUpperCase()}</span>
                  <span>
                    <strong>{s.name}</strong>
                    <small>{s.agency || 'Agency not supplied'}</small>
                    <small>{s.phone || 'Phone not supplied'}</small>
                  </span>
                  <span className="supplier-mini-balance">
                    {amount === null ? 'Verify' : formatMoney(Math.abs(amount))}
                    <small>
                      {amount === null
                        ? 'Unknown carry-forward'
                        : amount < 0
                          ? 'Supplier credit'
                          : 'Payable'}
                    </small>
                  </span>
                </button>
              )
            })}
          </div>
          {!suppliers.length && (
            <Empty title="No matching suppliers">Create a demo supplier or clear the search.</Empty>
          )}
        </section>
        {selected ? (
          <div className="supplier-detail">
            <section className="surface finance-padding">
              <div className="supplier-detail-heading">
                <div>
                  <span className="eyebrow">SUPPLIER ACCOUNT</span>
                  <h2>{selected.name}</h2>
                  <p>
                    {selected.agency || 'No agency'} · {selected.phone || 'No phone'}
                  </p>
                  {selected.address && <p>{selected.address}</p>}
                </div>
                <button
                  className="icon-button"
                  aria-label="Edit selected supplier"
                  onClick={() => open({ type: 'supplier', supplierId: selected.id })}
                >
                  <Pencil size={17} />
                </button>
              </div>
              <div className="supplier-balance-box">
                <span>
                  {balance === null
                    ? 'Carried-forward balance not confirmed'
                    : balance < 0
                      ? 'Credit held by supplier'
                      : 'Amount payable'}
                </span>
                <strong data-testid="supplier-balance">
                  {balance === null ? 'Needs reconciliation' : formatMoney(Math.abs(balance))}
                </strong>
                <small>
                  {balance === null
                    ? 'Existing purchase costs are reference records, not evidence of unpaid balances.'
                    : 'Purchase charges + received cash refunds − payments − return credits; credit offsets the next purchase automatically.'}
                </small>
              </div>
              {!selected.openingConfirmed && (
                <Notice tone="warning">
                  Phase 1/2 did not record supplier payments. We have not invented a debt from those
                  old invoices.{' '}
                  <button
                    className="button button-text"
                    onClick={() => open({ type: 'supplier-balance', supplierId: selected.id })}
                  >
                    Confirm current statement balance
                  </button>
                </Notice>
              )}
              <div className="supplier-actions">
                <button
                  className="button button-secondary"
                  disabled={!selected.openingConfirmed}
                  onClick={() => open({ type: 'supplier-cash', supplierId: selected.id })}
                >
                  <Banknote size={16} />
                  Record cash settlement
                </button>
                <button
                  className="button button-secondary"
                  onClick={() => open({ type: 'supplier-return', supplierId: selected.id })}
                >
                  <RotateCcw size={16} />
                  Return goods to supplier
                </button>
                <button className="button button-text" onClick={() => navigate('purchases')}>
                  Receive a delivery
                  <ArrowUpRight size={15} />
                </button>
              </div>
            </section>
            <section className="surface finance-history">
              <div className="surface-heading">
                <div>
                  <h2>Account movement journal</h2>
                  <p>
                    {selected.openingConfirmed
                      ? `Carried forward: ${formatMoney(selected.openingBalance)} · ${selected.openingNote}`
                      : 'New posted movements only; full balance remains unconfirmed.'}
                  </p>
                </div>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Reference / date</th>
                      <th>Movement</th>
                      <th>Charge / cash refund</th>
                      <th>Payment / credit</th>
                      <th>
                        {selected.openingConfirmed ? 'Running balance' : 'New movements only'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <button
                            className="button button-text ledger-reference"
                            disabled={r.kind === 'payment' || r.kind === 'refund'}
                            onClick={() =>
                              r.kind === 'purchase'
                                ? open({ type: 'purchase', purchaseId: r.id })
                                : open({ type: 'supplier-return-record', returnId: r.id })
                            }
                          >
                            {r.number}
                          </button>
                          <small>
                            {formatDate(r.createdAt, true)} · {r.role}
                          </small>
                          {(r.kind === 'payment' || r.kind === 'refund') && (
                            <small>
                              {state.supplierSettlements.find((s) => s.id === r.id)?.reference}
                              {state.supplierSettlements.find((s) => s.id === r.id)?.notes &&
                                ` · ${state.supplierSettlements.find((s) => s.id === r.id)!.notes}`}
                            </small>
                          )}
                        </td>
                        <td>
                          {r.kind === 'purchase'
                            ? 'Purchase on account'
                            : r.kind === 'credit'
                              ? 'Accepted return credit'
                              : r.kind === 'payment'
                                ? 'Cash paid to supplier'
                                : 'Cash received from supplier'}
                        </td>
                        <td>
                          {r.kind === 'purchase' || r.kind === 'refund'
                            ? formatMoney(r.amount)
                            : '—'}
                        </td>
                        <td>
                          {r.kind === 'credit' || r.kind === 'payment'
                            ? formatMoney(-r.amount)
                            : '—'}
                        </td>
                        <td>{formatMoney(r.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!ledger.length && (
                <Empty title="No new account movements">
                  Receiving new stock posts its cost; accepted returns reduce the account balance.
                </Empty>
              )}
            </section>
            {legacy.length > 0 && (
              <section className="surface finance-history">
                <div className="surface-heading">
                  <div>
                    <h2>Historical invoices · reference only</h2>
                    <p>Preserved from the previous version. Not silently treated as unpaid.</p>
                  </div>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Original invoice</th>
                        <th>Date</th>
                        <th>Recorded purchase cost</th>
                        <th>
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {legacy.map((p) => (
                        <tr key={p.id}>
                          <td>{p.number}</td>
                          <td>{formatDate(p.createdAt)}</td>
                          <td>{formatMoney(p.totalCost)}</td>
                          <td>
                            <button
                              className="button button-text"
                              onClick={() => open({ type: 'purchase', purchaseId: p.id })}
                            >
                              View original
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
            {returns.length > 0 && (
              <section className="surface finance-history">
                <div className="surface-heading">
                  <div>
                    <h2>Accepted supplier credit notes</h2>
                    <p>Goods and original-lot cost remain traceable.</p>
                  </div>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Return</th>
                        <th>Credit note</th>
                        <th>Reason</th>
                        <th>Credit</th>
                        <th>
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...returns].reverse().map((r) => (
                        <tr key={r.id}>
                          <td>
                            {r.number}
                            <small>{formatDate(r.createdAt)}</small>
                          </td>
                          <td>{r.creditReference}</td>
                          <td>{r.reason}</td>
                          <td>{formatMoney(r.totalCredit)}</td>
                          <td>
                            <button
                              className="button button-text"
                              onClick={() =>
                                open({ type: 'supplier-return-record', returnId: r.id })
                              }
                            >
                              Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
        ) : (
          <section className="surface">
            <Empty title="Create a supplier account">Use sample contacts and balances only.</Empty>
          </section>
        )}
      </div>
      <p className="page-footnote">
        A negative balance is supplier credit, not negative drawer cash. Supplier invoices and
        credit notes never move cash by themselves. Client-side roles remain demo-only.
      </p>
    </div>
  )
}
