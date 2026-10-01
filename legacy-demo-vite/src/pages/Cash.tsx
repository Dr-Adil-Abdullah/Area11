import { useEffect, useState, type FormEvent } from 'react'
import { Banknote, ArrowRight, LockKeyhole, Users, CheckCircle2 } from 'lucide-react'
import { formatDate, formatMoney, parseMoney, type CashEntry } from '../domain/model'
import {
  closeCashSession,
  expectedCash,
  handoverCashSession,
  openCashSession,
  openSession,
} from '../domain/cash'
import { useWorkspace } from '../ui/workspace'
import { Empty, Notice, PageHeading } from '../ui/common'

const kindLabels: Record<CashEntry['kind'], string> = {
  sale: 'Cash sale',
  return: 'Sales refund',
  'provisional-refund': 'Provisional refund',
  'return-settlement': 'Refund difference settlement',
  expense: 'Shop expense',
  'owner-withdrawal': 'Owner withdrawal',
  'owner-deposit': 'Owner deposit',
  'supplier-payment': 'Supplier cash payment',
  'supplier-refund': 'Supplier cash refund',
}
export default function CashPage() {
  const { state, role, run, notify } = useWorkspace()
  const active = openSession(state)
  const [opening, setOpening] = useState('')
  const [operator, setOperator] = useState('')
  const [counted, setCounted] = useState('')
  const [note, setNote] = useState('')
  const [mode, setMode] = useState<'close' | 'handover'>('close')
  const [nextOperator, setNextOperator] = useState('')
  const [viewId, setViewId] = useState('')
  useEffect(() => {
    // Never prefill an actual count from the calculated balance.
    setCounted('')
    setNote('')
    setNextOperator('')
  }, [active?.id])
  const expected = active ? expectedCash(state, active.id) : 0
  let difference: number | null = null
  try {
    difference = parseMoney(counted) - expected
  } catch {
    /* Unfinished input. */
  }
  const selected =
    state.cashSessions.find((s) => s.id === viewId) ?? active ?? state.cashSessions.at(-1)
  const entries = state.cashEntries.filter((e) => e.sessionId === selected?.id)
  const submitOpen = (e: FormEvent) => {
    e.preventDefault()
    try {
      run(
        (s) => openCashSession(s, parseMoney(opening), operator, role, new Date().toISOString()),
        'Cash shift opened. New cash transactions will be recorded here.',
      )
    } catch (error) {
      notify((error as Error).message, 'error')
    }
  }
  const submitClose = (e: FormEvent) => {
    e.preventDefault()
    try {
      const now = new Date().toISOString()
      const actual = parseMoney(counted)
      const result = run(
        (s) =>
          mode === 'close'
            ? closeCashSession(s, actual, note, role, now)
            : handoverCashSession(s, actual, note, nextOperator, role, now),
        mode === 'close'
          ? 'Shift closed with its actual count and variance recorded.'
          : 'Handover saved. The new shift opens with the cash actually counted.',
      )
      if (result) setViewId('')
    } catch (error) {
      notify((error as Error).message, 'error')
    }
  }
  const reference = (entry: CashEntry) =>
    entry.kind === 'sale'
      ? state.sales.find((r) => r.id === entry.refId)?.number
      : entry.kind === 'return' || entry.kind === 'return-settlement'
        ? state.salesReturns.find((r) => r.id === entry.refId)?.number
        : entry.kind === 'provisional-refund'
          ? state.provisionalReturns.find((r) => r.id === entry.refId)?.number
          : entry.kind === 'expense'
            ? state.expenses.find((r) => r.id === entry.refId)?.number
            : entry.kind === 'supplier-payment' || entry.kind === 'supplier-refund'
              ? state.supplierSettlements.find((r) => r.id === entry.refId)?.number
              : state.ownerEntries.find((r) => r.id === entry.refId)?.number
  return (
    <div className="page-content">
      <PageHeading
        eyebrow="CASH CONTROL"
        title="Cash drawer"
        description="Opening float, shift handover and the final counted cash — all traceable."
      />
      <div className="overview-grid">
        <div className="overview-card">
          <span className="metric-icon green">
            <Banknote size={21} />
          </span>
          <div>
            <span>Expected in current drawer</span>
            <strong data-testid="drawer-expected">
              {active ? formatMoney(expected) : 'Not open'}
            </strong>
            <small>{active ? active.number : 'Enter the actual opening float first'}</small>
          </div>
        </div>
        <div className="overview-card">
          <span className="metric-icon blue">
            <Users size={21} />
          </span>
          <div>
            <span>Current operator</span>
            <strong className="operator-name">{active?.operator ?? '—'}</strong>
            <small>{active ? formatDate(active.openedAt, true) : 'No active shift'}</small>
          </div>
        </div>
        <div className="overview-card">
          <span className="metric-icon amber">
            <LockKeyhole size={21} />
          </span>
          <div>
            <span>Closed shifts</span>
            <strong>{state.cashSessions.filter((s) => s.status === 'closed').length}</strong>
            <small>Counts and differences retained</small>
          </div>
        </div>
      </div>
      <div className="finance-grid">
        <section className="surface finance-padding">
          <div className="section-title">
            <span className="metric-icon green">
              <Banknote size={21} />
            </span>
            <div>
              <h2>{active ? 'Count & reconcile this shift' : 'Open a cash shift'}</h2>
              <p>
                {active
                  ? 'Count physical cash. Do not substitute expected cash for an actual count.'
                  : 'Float includes all cash physically present now, including change.'}
              </p>
            </div>
          </div>
          {!active ? (
            <form onSubmit={submitOpen}>
              <div className="form-grid two-cols">
                <label>
                  Operator label
                  <input
                    aria-label="Cash operator label"
                    required
                    minLength={2}
                    maxLength={60}
                    placeholder="Sample cashier / shift label"
                    value={operator}
                    onChange={(e) => setOperator(e.target.value)}
                  />
                </label>
                <label>
                  Opening float (Rs.)
                  <input
                    aria-label="Opening float"
                    type="number"
                    required
                    min={0}
                    step="0.01"
                    value={opening}
                    onChange={(e) => setOpening(e.target.value)}
                  />
                </label>
              </div>
              <p className="field-help">
                No cash balance is invented or imported from old Phase 1 bills. Enter the actual
                sample float you want to test with.
              </p>
              <div className="form-actions">
                <button className="button button-primary" type="submit">
                  Open cash shift
                  <ArrowRight size={17} />
                </button>
              </div>
            </form>
          ) : (
            <form key={active.id} onSubmit={submitClose}>
              <div className="unit-switch close-mode">
                <button
                  type="button"
                  className={mode === 'close' ? 'active' : ''}
                  onClick={() => setMode('close')}
                >
                  Final closing
                </button>
                <button
                  type="button"
                  className={mode === 'handover' ? 'active' : ''}
                  onClick={() => setMode('handover')}
                >
                  Shift handover
                </button>
              </div>
              <div className="form-grid two-cols">
                <label>
                  Actual cash counted (Rs.)
                  <input
                    aria-label="Actual cash counted"
                    type="number"
                    required
                    min={0}
                    step="0.01"
                    placeholder="Enter physical cash count"
                    value={counted}
                    onChange={(e) => setCounted(e.target.value)}
                  />
                </label>
                <div className="cash-count-summary">
                  <span>Difference from expected</span>
                  <strong
                    className={
                      difference === null ? '' : difference ? 'variance-warning' : 'text-green'
                    }
                  >
                    {difference === null ? 'Enter count' : formatMoney(difference)}
                  </strong>
                </div>
                {mode === 'handover' && (
                  <label className="full-span">
                    Next operator
                    <input
                      aria-label="Next cash operator"
                      required
                      minLength={2}
                      maxLength={60}
                      value={nextOperator}
                      onChange={(e) => setNextOperator(e.target.value)}
                    />
                  </label>
                )}
                <label className="full-span">
                  Closing / difference note
                  {difference !== null && difference !== 0 && (
                    <span className="required">required for a variance</span>
                  )}
                  <textarea
                    aria-label="Cash closing note"
                    required={difference !== null && difference !== 0}
                    minLength={difference !== null && difference !== 0 ? 2 : undefined}
                    maxLength={300}
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </label>
              </div>
              <label className="check-label">
                <input type="checkbox" required />I counted the physical drawer and confirmed this{' '}
                {mode === 'handover' ? 'handover' : 'closing'}.
              </label>
              <div className="form-actions">
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={difference === null}
                >
                  <CheckCircle2 size={17} />
                  {mode === 'close' ? 'Close cash shift' : 'Complete handover'}
                </button>
              </div>
            </form>
          )}
        </section>
        <section className="surface finance-padding">
          <h2 className="finance-title">What belongs to a shift?</h2>
          <div className="cash-rules">
            <p>
              <span>+</span> Net cash sales, owner deposits and received supplier cash refunds.
            </p>
            <p>
              <span>−</span> Refunds, expenses, owner withdrawals and cash paid to suppliers.
            </p>
            <p>
              <span>↔</span> Confirmed cash differences when linking a provisional return.
            </p>
            <p>
              <span>0</span> Owner medicine use and absorbed overpayment accounting entries do not
              move cash again.
            </p>
          </div>
          <Notice>
            A handover transfers the amount actually counted, not the expected amount. Any shortage
            or excess remains recorded on the closed shift.
          </Notice>
          <Notice>
            These are local demo records and test roles, not server-backed accounts or production
            cash security.
          </Notice>
        </section>
      </div>
      <section className="surface finance-history">
        <div className="surface-heading">
          <div>
            <h2>Cash movement journal</h2>
            <p>
              {selected
                ? `${selected.number} · ${selected.operator} · ${selected.status}`
                : 'Open a shift to start the cash journal.'}
            </p>
          </div>
          {state.cashSessions.length > 0 && (
            <label className="sr-select-label">
              <span className="sr-only">View cash shift</span>
              <select
                aria-label="View cash shift"
                value={selected?.id ?? ''}
                onChange={(e) => setViewId(e.target.value)}
              >
                {[...state.cashSessions].reverse().map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.number} · {s.operator} · {s.status}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Time (PKT)</th>
                <th>Movement</th>
                <th>Reference</th>
                <th>Cash in</th>
                <th>Cash out</th>
              </tr>
            </thead>
            <tbody>
              {[...entries].reverse().map((e) => (
                <tr key={e.id}>
                  <td>{formatDate(e.createdAt, true)}</td>
                  <td>
                    <strong>{kindLabels[e.kind]}</strong>
                    <small>{e.role}</small>
                  </td>
                  <td>{reference(e)}</td>
                  <td>{e.amount >= 0 ? formatMoney(e.amount) : '—'}</td>
                  <td>{e.amount < 0 ? formatMoney(-e.amount) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!entries.length && (
          <Empty title="No movements in this shift">
            Opening float is stored separately. Sales and payments create journal entries
            automatically.
          </Empty>
        )}
      </section>
      <section className="surface finance-history">
        <div className="surface-heading">
          <div>
            <h2>Shift closing history</h2>
            <p>Expected, counted, variance and handover provenance.</p>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Shift / operator</th>
                <th>Expected</th>
                <th>Counted</th>
                <th>Variance</th>
                <th>Closing note</th>
              </tr>
            </thead>
            <tbody>
              {[...state.cashSessions]
                .filter((s) => s.status === 'closed')
                .reverse()
                .map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong>
                        {s.number} · {s.operator}
                      </strong>
                      <small>
                        {formatDate(s.closedAt!, true)}
                        {s.handoverTo ? ' · handed over' : ' · final close'}
                      </small>
                    </td>
                    <td>{formatMoney(s.expectedAtClose!)}</td>
                    <td>{formatMoney(s.counted!)}</td>
                    <td className={s.variance ? 'variance-warning' : ''}>
                      {formatMoney(s.variance!)}
                    </td>
                    <td className="notes-cell">{s.closeNote || 'Matched physical count'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
