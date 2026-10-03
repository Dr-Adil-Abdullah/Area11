import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Trash2, RotateCcw, CheckCircle2, Percent, Phone } from 'lucide-react'
import { type Dialog, useWorkspace } from './workspace'
import { Modal, Notice, Empty } from './common'
import {
  formatDate,
  formatMoney,
  formatPercent,
  parseMoney,
  parsePercent,
  parseQuantity,
  returnReasons,
  uid,
  unitLabel,
} from '../domain/model'
import {
  linkProvisionalReturn,
  quoteReturn,
  recordProvisionalReturn,
  recordSalesReturn,
  returnedUnits,
  type ReturnSelection,
} from '../domain/returns'
import { cartDetails, setCartDiscount, setCartPhone } from '../domain/operations'
import { openSession } from '../domain/cash'
import { paidByLine } from '../domain/arithmetic'

export function FinanceDialogs({ dialog }: { dialog: Dialog }) {
  if (dialog.type === 'sales-return') return <ReturnDialog initialSaleId={dialog.saleId} />
  if (dialog.type === 'link-return') return <ReturnDialog provisionalId={dialog.provisionalId} />
  if (dialog.type === 'provisional-return') return <ProvisionalDialog />
  if (dialog.type === 'return-record') return <ReturnRecordDialog returnId={dialog.returnId} />
  if (dialog.type === 'discount') return <DiscountDialog />
  if (dialog.type === 'contact') return <ContactDialog />
  return null
}
function ReturnDialog({
  initialSaleId = '',
  provisionalId,
}: {
  initialSaleId?: string
  provisionalId?: string
}) {
  const { state, role, today, run, notify, close, open, navigate } = useWorkspace()
  const provisional = state.provisionalReturns.find((p) => p.id === provisionalId)
  const [requestId] = useState(uid)
  const [saleId, setSaleId] = useState(initialSaleId)
  const [query, setQuery] = useState('')
  const [quantities, setQuantities] = useState<Record<number, string>>({})
  const [reason, setReason] = useState<(typeof returnReasons)[number]>(
    provisional?.reason ?? 'Customer change',
  )
  const [notes, setNotes] = useState(provisional?.notes ?? '')
  const [disposition, setDisposition] = useState<'restock' | 'quarantine'>('quarantine')
  const [settlement, setSettlement] = useState<'cash' | 'expense'>('cash')
  const [confirmed, setConfirmed] = useState(false)
  useEffect(() => {
    setQuantities({})
    setConfirmed(false)
  }, [saleId])
  const sale = state.sales.find((s) => s.id === saleId)
  const matching = state.sales.filter(
    (s) =>
      (!provisional || s.createdAt <= provisional.createdAt) &&
      `${s.number} ${s.customerPhone} ${s.lines.map((l) => l.productName).join(' ')}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  )
  const actualReason = provisional?.reason ?? reason
  const selections: ReturnSelection[] =
    sale?.lines.flatMap((line, index) =>
      Number(quantities[index] ?? '0') > 0
        ? [
            {
              saleLineIndex: index,
              baseQuantity: Number(quantities[index]),
              disposition:
                role === 'cashier' ||
                actualReason === 'Damaged' ||
                actualReason === 'Expired' ||
                line.expiresOn < today
                  ? ('quarantine' as const)
                  : disposition,
            },
          ]
        : [],
    ) ?? []
  let quote: ReturnType<typeof quoteReturn> | undefined
  let error = ''
  if (sale && selections.length) {
    try {
      quote = quoteReturn(state, sale.id, selections, actualReason, role, today)
    } catch (e) {
      error = (e as Error).message
    }
  }
  const difference = provisional && quote ? provisional.refundPaid - quote.refund : 0
  const needsCash = !provisional || (difference !== 0 && settlement === 'cash')
  const cashOpen = !!openSession(state)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!sale) return
    const input = {
      requestId,
      saleId: sale.id,
      lines: selections,
      reason: actualReason,
      notes,
      confirmed,
    }
    const result = run((s) =>
      provisionalId
        ? linkProvisionalReturn(s, provisionalId, input, settlement, role, new Date().toISOString())
        : recordSalesReturn(s, input, role, new Date().toISOString()),
    )
    if (result) {
      const r = result.salesReturns.at(-1)!
      notify(`${r.number} saved. Original batch stock and cash records are linked.`, 'success')
      open({ type: 'return-record', returnId: r.id })
    }
  }
  return (
    <Modal
      title={provisionalId ? 'Verify & link a provisional return' : 'Create sales return'}
      subtitle={
        provisional
          ? `${provisional.number} · ${formatMoney(provisional.refundPaid)} already refunded`
          : 'Refund the actual collected price, not today’s retail price.'
      }
      onClose={close}
      wide
    >
      {provisionalId && !provisional && (
        <Notice tone="error">This provisional record is no longer available.</Notice>
      )}
      {provisional && (
        <>
          <Notice tone="warning">
            Original received goods:{' '}
            {provisional.items
              .map((i) => `${i.productName} × ${i.baseQuantity} base units`)
              .join(', ')}
            . Linking restores their verified original batches, not guessed batches.
          </Notice>
          <div className="form-grid two-cols">
            <label>
              Find invoice
              <input
                aria-label="Find invoice for provisional return"
                placeholder="Invoice, product or recorded phone"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <label>
              Original invoice
              <select
                aria-label="Original invoice"
                required
                value={saleId}
                onChange={(e) => setSaleId(e.target.value)}
              >
                <option value="">Select the verified original bill…</option>
                {matching.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.number} · {formatDate(s.createdAt)} · {formatMoney(s.total)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </>
      )}
      {!sale && !provisional && (
        <Empty title="Original sale unavailable">
          The invoice may have been removed by a demo reset.
        </Empty>
      )}
      {sale && (
        <form onSubmit={submit}>
          <div className="return-sale-summary">
            <strong>{sale.number}</strong>
            <span>
              {formatDate(sale.createdAt, true)} · {sale.customerPhone || 'Walk-in'}
            </span>
            <strong>{formatMoney(sale.total)} collected</strong>
          </div>
          <div className="return-line-list">
            {sale.lines.map((line, index) => {
              const already = returnedUnits(state, sale.id, index)
              const remaining = line.baseQuantity - already
              return (
                <div className="return-line" key={index}>
                  <div>
                    <strong>{line.productName}</strong>
                    <span>
                      Batch {line.batchNumber} · Exp {line.expiresOn}
                    </span>
                    <small>
                      Sold {line.quantity} {unitLabel(line, line.unit, line.quantity !== 1)} ={' '}
                      {line.baseQuantity} {unitLabel(line, 'loose', true)} · already returned{' '}
                      {already}
                    </small>
                    <small>{formatMoney(paidByLine(sale)[index])} allocated collected price</small>
                  </div>
                  <label>
                    Return {unitLabel(line, 'loose', true)}
                    <input
                      aria-label={`Return base units for line ${index + 1}`}
                      type="number"
                      min={0}
                      max={remaining}
                      step={1}
                      disabled={!remaining}
                      value={quantities[index] ?? '0'}
                      onChange={(e) => {
                        setQuantities({ ...quantities, [index]: e.target.value })
                        setConfirmed(false)
                      }}
                    />
                  </label>
                </div>
              )
            })}
          </div>
          <div className="form-grid two-cols">
            {!provisional && (
              <label>
                Return reason
                <select
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value as typeof reason)
                    setConfirmed(false)
                  }}
                >
                  {returnReasons.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Stock disposition for inspected goods
              <select
                aria-label="Return stock disposition"
                value={disposition}
                disabled={
                  role === 'cashier' || actualReason === 'Damaged' || actualReason === 'Expired'
                }
                onChange={(e) => setDisposition(e.target.value as typeof disposition)}
              >
                <option value="quarantine">Quarantine · not saleable</option>
                <option value="restock">Restock sealed, inspected goods</option>
              </select>
            </label>
            <label className="full-span">
              Return / verification notes
              <textarea
                rows={2}
                maxLength={400}
                required={actualReason === 'Other'}
                minLength={actualReason === 'Other' ? 2 : undefined}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
          </div>
          <p className="field-help">
            Damaged or expired lines are always quarantined. Only Owner/Manager may release
            inspected unexpired returns into saleable stock. Quantities are smallest units, not
            boxes.
          </p>
          {error && <Notice tone="error">{error}</Notice>}
          <div className="refund-total">
            <span>Allocated refund entitlement</span>
            <strong data-testid="return-refund">{formatMoney(quote?.refund ?? 0)}</strong>
          </div>
          {provisional && quote && (
            <>
              <Notice tone={difference ? 'warning' : 'success'}>
                {difference > 0
                  ? `Already refunded more than this bill’s entitlement. Recover ${formatMoney(difference)} from the customer, or Owner may explicitly absorb it as a shop expense.`
                  : difference < 0
                    ? `An additional ${formatMoney(-difference)} must be refunded to the customer.`
                    : 'The original refund matches. No second cash payment will be recorded.'}
              </Notice>
              {difference > 0 && (
                <label>
                  Overpayment settlement
                  <select
                    aria-label="Overpayment settlement"
                    value={settlement}
                    onChange={(e) => {
                      setSettlement(e.target.value as typeof settlement)
                      setConfirmed(false)
                    }}
                  >
                    <option value="cash">Customer returned the overpaid cash</option>
                    {role === 'owner' && (
                      <option value="expense">Owner absorbs overpayment as expense</option>
                    )}
                  </select>
                </label>
              )}
            </>
          )}
          {needsCash && !cashOpen && (
            <Notice tone="warning">
              Open a cash shift before recording this refund or cash difference.{' '}
              <button
                type="button"
                className="button button-text"
                onClick={() => {
                  close()
                  navigate('cash')
                }}
              >
                Open cash drawer
              </button>
            </Notice>
          )}
          <label className="check-label">
            <input
              type="checkbox"
              required
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            {provisional
              ? `I checked the original invoice and goods${difference && settlement === 'cash' ? ', and exchanged the stated cash difference' : difference && settlement === 'expense' ? ', and approve the expense write-off' : ''}.`
              : 'I received these goods and confirmed the actual cash refund.'}
          </label>
          <div className="form-actions">
            <button type="button" className="button button-secondary" onClick={close}>
              Cancel
            </button>
            <button
              type="submit"
              className="button button-primary"
              disabled={
                !quote ||
                !!error ||
                !confirmed ||
                (needsCash && !cashOpen) ||
                (!!provisional && role === 'cashier')
              }
            >
              <CheckCircle2 size={17} />
              {provisional ? 'Link original bill' : 'Confirm return & refund'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
function ProvisionalDialog() {
  const { state, role, run, notify, close, navigate } = useWorkspace()
  const [requestId] = useState(uid)
  const [items, setItems] = useState([{ id: uid(), productId: '', quantity: '1' }])
  const [refund, setRefund] = useState('')
  const [phone, setPhone] = useState('')
  const [reason, setReason] = useState<(typeof returnReasons)[number]>('Customer change')
  const [notes, setNotes] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const updateItems = (next: typeof items) => {
    setItems(next)
    setConfirmed(false)
  }
  const cashOpen = !!openSession(state)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    try {
      const input = {
        requestId,
        items: items.map((i) => ({
          productId: i.productId,
          baseQuantity: parseQuantity(i.quantity),
        })),
        refundPaid: parseMoney(refund),
        phone,
        reason,
        notes,
        confirmed,
      }
      if (
        run(
          (s) => recordProvisionalReturn(s, input, role, new Date().toISOString()),
          'Provisional refund saved. The pending bill alert remains until Owner/Manager links it.',
        )
      ) {
        close()
        navigate('returns')
      }
    } catch (error) {
      notify((error as Error).message, 'error')
    }
  }
  return (
    <Modal
      title="Provisional return · bill missing"
      subtitle="Record a real sample cash refund now. Verify the original invoice later."
      onClose={close}
      wide
    >
      <Notice tone="warning">
        This is not an invented sale or guessed batch. Received goods stay outside saleable
        inventory until the original bill is linked. A persistent pending alert will remain.
      </Notice>
      <form onSubmit={submit}>
        {items.map((item, index) => (
          <div className="provisional-item-row form-grid" key={item.id}>
            <label>
              Product
              <select
                aria-label={`Provisional product ${index + 1}`}
                required
                value={item.productId}
                onChange={(e) =>
                  updateItems(
                    items.map((i) => (i.id === item.id ? { ...i, productId: e.target.value } : i)),
                  )
                }
              >
                <option value="">Choose returned product…</option>
                {state.products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.baseUnit}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Base units
              <input
                aria-label={`Provisional base units ${index + 1}`}
                required
                type="number"
                min={1}
                max={1000000}
                step={1}
                value={item.quantity}
                onChange={(e) =>
                  updateItems(
                    items.map((i) => (i.id === item.id ? { ...i, quantity: e.target.value } : i)),
                  )
                }
              />
            </label>
            <button
              type="button"
              className="icon-button"
              aria-label={`Remove provisional item ${index + 1}`}
              disabled={items.length === 1}
              onClick={() => updateItems(items.filter((i) => i.id !== item.id))}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="button button-text"
          onClick={() => updateItems([...items, { id: uid(), productId: '', quantity: '1' }])}
        >
          <Plus size={15} />
          Another returned product
        </button>
        <div className="form-grid two-cols">
          <label>
            Cash actually refunded (Rs.)
            <input
              aria-label="Provisional cash refunded"
              type="number"
              required
              min="0.01"
              step="0.01"
              value={refund}
              onChange={(e) => {
                setRefund(e.target.value)
                setConfirmed(false)
              }}
            />
          </label>
          <label>
            Customer phone <span className="optional">optional</span>
            <input
              type="tel"
              maxLength={40}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          <label>
            Return reason
            <select
              value={reason}
              onChange={(e) => {
                setReason(e.target.value as typeof reason)
                setConfirmed(false)
              }}
            >
              {returnReasons.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <label>
            Notes
            <textarea
              rows={2}
              maxLength={400}
              required={reason === 'Other'}
              minLength={reason === 'Other' ? 2 : undefined}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </div>
        {!cashOpen && (
          <Notice tone="warning">
            Open a cash shift to record the actual refund.{' '}
            <button
              type="button"
              className="button button-text"
              onClick={() => {
                close()
                navigate('cash')
              }}
            >
              Open cash drawer
            </button>
          </Notice>
        )}
        <label className="check-label">
          <input
            type="checkbox"
            required
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          I received the stated goods and actually refunded this amount.
        </label>
        <div className="form-actions">
          <button type="button" className="button button-secondary" onClick={close}>
            Cancel
          </button>
          <button
            type="submit"
            className="button button-primary"
            disabled={!confirmed || !cashOpen}
          >
            <RotateCcw size={16} />
            Save provisional refund
          </button>
        </div>
      </form>
    </Modal>
  )
}
function ReturnRecordDialog({ returnId }: { returnId: string }) {
  const { state, close } = useWorkspace()
  const record = state.salesReturns.find((r) => r.id === returnId)
  if (!record)
    return (
      <Modal title="Return unavailable" onClose={close}>
        <Notice tone="error">This record was removed by a demo reset.</Notice>
      </Modal>
    )
  const sale = state.sales.find((s) => s.id === record.saleId)!
  const provisional = state.provisionalReturns.find((p) => p.id === record.provisionalId)
  return (
    <Modal
      title={record.number}
      subtitle={`${sale.number} · ${formatDate(record.createdAt, true)} · ${record.reason}`}
      onClose={close}
      wide
    >
      <div className="purchase-confirmed">
        <CheckCircle2 size={22} />
        <div>
          <strong>Original invoice and batches linked</strong>
          <span>
            {record.role} ·{' '}
            {record.settlement === 'direct' ? 'Direct refund' : 'Provisional case resolved'}
          </span>
        </div>
        <strong>{formatMoney(record.refund)}</strong>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Product / original batch</th>
              <th>Base units</th>
              <th>Allocated refund</th>
              <th>Stock</th>
            </tr>
          </thead>
          <tbody>
            {record.lines.map((l) => (
              <tr key={l.saleLineIndex}>
                <td>
                  <strong>{l.productName}</strong>
                  <small>{state.batches.find((b) => b.id === l.batchId)?.number}</small>
                </td>
                <td>{l.baseQuantity}</td>
                <td>{formatMoney(l.refund)}</td>
                <td>
                  <span
                    className={`stock-pill ${l.disposition === 'quarantine' ? 'stock-empty' : ''}`}
                  >
                    {l.disposition}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {provisional && (
        <Notice>
          Originally paid on {provisional.number}: {formatMoney(provisional.refundPaid)}.{' '}
          {record.settlement === 'matched'
            ? 'No second cash payment.'
            : record.settlement === 'expense'
              ? `Overpayment absorbed as ${state.expenses.find((e) => e.id === record.differenceExpenseId)?.number}; no second cash deduction.`
              : record.cashDifference > 0
                ? `${formatMoney(record.cashDifference)} recovered in cash.`
                : `${formatMoney(-record.cashDifference)} additional refund paid.`}
        </Notice>
      )}
      {record.notes && <p className="record-note">{record.notes}</p>}
      <p className="field-help">
        Quarantined goods are recorded in their original batch but cannot be sold. Original sales
        and cash journal records are not erased.
      </p>
      <div className="form-actions">
        <button className="button button-primary" onClick={close}>
          Done
          <CheckCircle2 size={16} />
        </button>
      </div>
    </Modal>
  )
}
function DiscountDialog() {
  const { state, role, today, run, close } = useWorkspace()
  const [value, setValue] = useState(String(state.cartDiscountBps / 100))
  let preview: ReturnType<typeof cartDetails> | undefined
  let error = ''
  try {
    preview = cartDetails(
      { ...state, cartDiscountBps: parsePercent(value) },
      today,
      state.cart,
      role,
    )
  } catch (e) {
    error = (e as Error).message
  }
  return (
    <Modal
      title="Discount with safeguards"
      subtitle="Purchase cost is a hard floor. No role can bypass it."
      onClose={close}
    >
      <Notice>
        {state.cartDiscountMode === 'margin'
          ? 'Margin mode: the percentage applies only to retail minus purchase cost.'
          : 'Retail mode: the percentage applies to the full retail amount.'}{' '}
        Percentages are calculated per line and floored to whole paisa. Cashier maximum:{' '}
        {formatPercent(state.settings.cashierMaxDiscountBps)}. Owner/Manager are still bound by the
        cost floor.
      </Notice>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (
            run(
              (s) => setCartDiscount(s, parsePercent(value), role, today),
              'Discount applied to the current quote.',
            )
          )
            close()
        }}
      >
        <label>
          Discount percentage
          <input
            autoFocus
            aria-label="Discount percentage"
            required
            type="number"
            min={0}
            max={role === 'cashier' ? state.settings.cashierMaxDiscountBps / 100 : 100}
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
        {error ? (
          <Notice tone="error">{error}</Notice>
        ) : (
          <div className="discount-preview">
            <div>
              <span>Actual discount</span>
              <strong>{formatMoney(preview?.discount ?? 0)}</strong>
            </div>
            <div>
              <span>After protected rounding</span>
              <strong>{formatMoney(preview?.total ?? 0)}</strong>
            </div>
          </div>
        )}
        <div className="form-actions">
          <button className="button button-secondary" type="button" onClick={close}>
            Cancel
          </button>
          <button className="button button-primary" type="submit" disabled={!!error}>
            <Percent size={16} />
            Apply discount
          </button>
        </div>
      </form>
    </Modal>
  )
}
function ContactDialog() {
  const { state, run, close } = useWorkspace()
  const [phone, setPhone] = useState(state.cartPhone)
  return (
    <Modal
      title="Receipt phone"
      subtitle="Optional lookup information for this walk-in sale; not a customer profile."
      onClose={close}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (run((s) => setCartPhone(s, phone), 'Receipt lookup phone saved.')) close()
        }}
      >
        <label>
          Receipt lookup phone
          <input
            autoFocus
            aria-label="Receipt lookup phone"
            type="tel"
            maxLength={40}
            placeholder="Sample phone only · leave blank if unknown"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>
        <Notice>
          Use sample data only. The phone is saved on this invoice for lost-bill lookup and follows
          a parked cart. Full customer profiles are a later phase.
        </Notice>
        <div className="form-actions">
          <button className="button button-secondary" type="button" onClick={close}>
            Cancel
          </button>
          <button className="button button-primary" type="submit">
            <Phone size={16} />
            Save receipt phone
          </button>
        </div>
      </form>
    </Modal>
  )
}
