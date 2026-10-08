import { useEffect, useState, type FormEvent } from 'react'
import { Wallet, ReceiptText, ArrowDownToLine, ShieldCheck } from 'lucide-react'
import {
  formatDate,
  formatMoney,
  parseMoney,
  parseQuantity,
  usableUnits,
  isExpired,
  unitLabel,
} from '../domain/model'
import {
  ownerBalance,
  recordExpense,
  recordOwnerCash,
  recordOwnerMedicine,
} from '../domain/accounts'
import { useWorkspace } from '../ui/workspace'
import { Empty, Notice, PageHeading } from '../ui/common'

export default function AccountsPage() {
  const { state, today, role, run, notify } = useWorkspace()
  const [tab, setTab] = useState<'owner' | 'expenses'>(role === 'owner' ? 'owner' : 'expenses')
  useEffect(() => {
    if (role !== 'owner') setTab('expenses')
  }, [role])
  const [ownerKind, setOwnerKind] = useState<'cash-withdrawal' | 'cash-deposit' | 'medicine-use'>(
    'cash-withdrawal',
  )
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [batchId, setBatchId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [period, setPeriod] = useState<'daily' | 'monthly'>('daily')
  const [category, setCategory] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseNote, setExpenseNote] = useState('')
  const eligible = state.batches.filter((b) => usableUnits(b) > 0 && !isExpired(b, today))
  const batch = state.batches.find((b) => b.id === batchId)
  const debit = state.ownerEntries
    .filter((e) => e.kind !== 'cash-deposit')
    .reduce((n, e) => n + e.amount, 0)
  const credit = state.ownerEntries
    .filter((e) => e.kind === 'cash-deposit')
    .reduce((n, e) => n + e.amount, 0)
  const ownerSubmit = (e: FormEvent) => {
    e.preventDefault()
    try {
      const now = new Date().toISOString()
      const result = run(
        (s) =>
          ownerKind === 'medicine-use'
            ? recordOwnerMedicine(s, batchId, parseQuantity(quantity), description, role, now)
            : recordOwnerCash(s, ownerKind, parseMoney(amount), description, role, now),
        'Owner drawing account updated.',
      )
      if (result) {
        setAmount('')
        setDescription('')
        setQuantity('1')
      }
    } catch (error) {
      notify((error as Error).message, 'error')
    }
  }
  const expenseSubmit = (e: FormEvent) => {
    e.preventDefault()
    try {
      const result = run(
        (s) =>
          recordExpense(
            s,
            { kind: period, category, amount: parseMoney(expenseAmount), notes: expenseNote },
            role,
            new Date().toISOString(),
          ),
        'Shop expense recorded and deducted from the current cash drawer.',
      )
      if (result) {
        setExpenseAmount('')
        setExpenseNote('')
        setCategory('')
      }
    } catch (error) {
      notify((error as Error).message, 'error')
    }
  }
  return (
    <div className="page-content">
      <PageHeading
        eyebrow="ACCOUNTS FOUNDATION"
        title="Drawings & expenses"
        description="Keep owner use separate from the cost of running the shop."
      />
      <div className="page-tabs">
        {role === 'owner' && (
          <button className={tab === 'owner' ? 'active' : ''} onClick={() => setTab('owner')}>
            <Wallet size={16} />
            Owner drawing account
          </button>
        )}
        <button className={tab === 'expenses' ? 'active' : ''} onClick={() => setTab('expenses')}>
          <ReceiptText size={16} />
          Shop expenses
        </button>
      </div>
      {tab === 'owner' && role === 'owner' ? (
        <>
          <div className="overview-grid">
            <div className="overview-card">
              <div>
                <span>Debits · cash and medicine use</span>
                <strong>{formatMoney(debit)}</strong>
                <small>Medicine use is valued at purchase cost.</small>
              </div>
            </div>
            <div className="overview-card">
              <div>
                <span>Credits · cash returned by owner</span>
                <strong>{formatMoney(credit)}</strong>
                <small>Deposits also increase the cash drawer.</small>
              </div>
            </div>
            <div className="overview-card">
              <div>
                <span>Net drawings · debits minus credits</span>
                <strong data-testid="owner-balance">{formatMoney(ownerBalance(state))}</strong>
                <small>A negative amount is an owner credit balance.</small>
              </div>
            </div>
          </div>
          <section className="surface finance-padding">
            <div className="section-title">
              <span className="metric-icon green">
                <Wallet size={21} />
              </span>
              <div>
                <h2>Record owner use or repayment</h2>
                <p>Owner-only test permissions. Not a shop operating expense.</p>
              </div>
            </div>
            <form onSubmit={ownerSubmit}>
              <div className="form-grid two-cols">
                <label>
                  Entry type
                  <select
                    aria-label="Owner entry type"
                    value={ownerKind}
                    onChange={(e) => setOwnerKind(e.target.value as typeof ownerKind)}
                  >
                    <option value="cash-withdrawal">Cash withdrawal · debit</option>
                    <option value="cash-deposit">Cash returned · credit</option>
                    <option value="medicine-use">Medicine for owner use · debit at cost</option>
                  </select>
                </label>
                {ownerKind === 'medicine-use' ? (
                  <label>
                    Base-unit quantity
                    <input
                      aria-label="Owner medicine quantity"
                      type="number"
                      required
                      min={1}
                      max={1000000}
                      step={1}
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                    />
                  </label>
                ) : (
                  <label>
                    Amount (Rs.)
                    <input
                      aria-label="Owner cash amount"
                      type="number"
                      required
                      min="0.01"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </label>
                )}
                {ownerKind === 'medicine-use' && (
                  <label className="full-span">
                    Product / batch
                    <select
                      aria-label="Owner medicine batch"
                      required
                      value={batchId}
                      onChange={(e) => setBatchId(e.target.value)}
                    >
                      <option value="">Choose an unexpired batch…</option>
                      {eligible.map((b) => (
                        <option key={b.id} value={b.id}>
                          {state.products.find((p) => p.id === b.productId)?.name} · {b.number} ·{' '}
                          {usableUnits(b)} base units
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="full-span">
                  Purpose / description
                  <textarea
                    aria-label="Owner entry description"
                    required
                    minLength={2}
                    maxLength={300}
                    rows={2}
                    placeholder="Personal cash use, medicine use or repayment note"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </label>
              </div>
              {ownerKind === 'medicine-use' && (
                <Notice>
                  {batch
                    ? `${quantity} ${unitLabel(
                        state.products.find((p) => p.id === batch.productId)!,
                        'loose',
                        Number(quantity) !== 1,
                      )} = ${formatMoney(batch.costPerBase * Number(quantity || 0))} at purchase cost. `
                    : ''}
                  Medicine use deducts unquarantined stock only. It does not create a sale or move
                  drawer cash.
                </Notice>
              )}
              <div className="form-actions">
                <button className="button button-primary" type="submit">
                  <ArrowDownToLine size={17} />
                  Record owner entry
                </button>
              </div>
            </form>
          </section>
          <section className="surface finance-history">
            <div className="surface-heading">
              <div>
                <h2>Owner account journal</h2>
                <p>Debits and credits are retained; there is no delete/edit action.</p>
              </div>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Entry</th>
                    <th>Purpose</th>
                    <th>Debit</th>
                    <th>Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {[...state.ownerEntries].reverse().map((e) => (
                    <tr key={e.id}>
                      <td>
                        <strong>{e.number}</strong>
                        <small>{formatDate(e.createdAt, true)}</small>
                      </td>
                      <td className="notes-cell">
                        <strong>{e.kind.replaceAll('-', ' ')}</strong>
                        {e.kind === 'medicine-use' && (
                          <small>
                            {state.products.find((p) => p.id === e.productId)?.name} ×{' '}
                            {e.baseQuantity} base units ·{' '}
                            {state.batches.find((b) => b.id === e.batchId)?.number}
                          </small>
                        )}
                        <small>{e.notes}</small>
                      </td>
                      <td>{e.kind !== 'cash-deposit' ? formatMoney(e.amount) : '—'}</td>
                      <td>{e.kind === 'cash-deposit' ? formatMoney(e.amount) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!state.ownerEntries.length && (
              <Empty title="No owner drawings recorded">
                Record personal cash or medicine use separately from shop expenses.
              </Empty>
            )}
          </section>
        </>
      ) : (
        <>
          <div className="overview-grid">
            {(['daily', 'monthly', 'return-adjustment'] as const).map((kind) => (
              <div className="overview-card" key={kind}>
                <div>
                  <span>
                    {kind === 'return-adjustment'
                      ? 'Absorbed refund overpayments'
                      : `${kind === 'daily' ? 'Daily' : 'Monthly'} expenses`}
                  </span>
                  <strong>
                    {formatMoney(
                      state.expenses
                        .filter((e) => e.kind === kind)
                        .reduce((n, e) => n + e.amount, 0),
                    )}
                  </strong>
                  <small>
                    {kind === 'return-adjustment'
                      ? 'Accounting only; cash already refunded.'
                      : 'Payments from the cash drawer.'}
                  </small>
                </div>
              </div>
            ))}
          </div>
          <section className="surface finance-padding">
            <div className="section-title">
              <span className="metric-icon green">
                <ReceiptText size={21} />
              </span>
              <div>
                <h2>Record a shop payment</h2>
                <p>Daily or monthly expense, paid from the current drawer now.</p>
              </div>
            </div>
            <form onSubmit={expenseSubmit}>
              <div className="form-grid two-cols">
                <label>
                  Expense period
                  <select
                    aria-label="Expense period"
                    value={period}
                    onChange={(e) => setPeriod(e.target.value as typeof period)}
                  >
                    <option value="daily">Daily expense</option>
                    <option value="monthly">Monthly expense</option>
                  </select>
                </label>
                <label>
                  Amount (Rs.)
                  <input
                    aria-label="Expense amount"
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                  />
                </label>
                <label className="full-span">
                  Category / purpose
                  <input
                    aria-label="Expense category"
                    required
                    minLength={2}
                    maxLength={60}
                    list="expense-category-options"
                    placeholder={
                      period === 'daily'
                        ? 'Tea, cleaning, transport…'
                        : 'Rent, electricity, salaries…'
                    }
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  />
                </label>
                <datalist id="expense-category-options">
                  {['Tea', 'Cleaning', 'Transport', 'Rent', 'Electricity', 'Salaries', 'Other'].map(
                    (c) => (
                      <option value={c} key={c} />
                    ),
                  )}
                </datalist>
                <label className="full-span">
                  Notes
                  <textarea
                    aria-label="Expense notes"
                    rows={2}
                    maxLength={300}
                    value={expenseNote}
                    onChange={(e) => setExpenseNote(e.target.value)}
                  />
                </label>
              </div>
              <div className="form-actions">
                <button className="button button-primary" type="submit">
                  Record expense
                  <ArrowDownToLine size={16} />
                </button>
              </div>
            </form>
          </section>
          <section className="surface finance-history">
            <div className="surface-heading">
              <div>
                <h2>Shop expense journal</h2>
                <p>Owner drawings are not included here.</p>
              </div>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Expense</th>
                    <th>Category / note</th>
                    <th>Period</th>
                    <th>Amount</th>
                    <th>Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {[...state.expenses].reverse().map((e) => (
                    <tr key={e.id}>
                      <td>
                        <strong>{e.number}</strong>
                        <small>{formatDate(e.createdAt, true)}</small>
                      </td>
                      <td className="notes-cell">
                        <strong>{e.category}</strong>
                        <small>{e.notes}</small>
                      </td>
                      <td>{e.kind}</td>
                      <td>{formatMoney(e.amount)}</td>
                      <td>
                        {e.payment === 'cash'
                          ? 'Drawer cash'
                          : 'Already paid in provisional refund'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!state.expenses.length && (
              <Empty title="No shop expenses yet">
                Record a sample daily or monthly cash payment.
              </Empty>
            )}
          </section>
        </>
      )}
      <div className="security-note">
        <ShieldCheck size={18} />
        <p>
          These are operational demo ledgers, not a production accounting system or an immutable
          audit trail.
        </p>
      </div>
    </div>
  )
}
