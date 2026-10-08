import { useEffect, useState, type FormEvent } from 'react'
import { Banknote, CheckCircle2, Save, RotateCcw, Truck } from 'lucide-react'
import { type Dialog, useWorkspace } from './workspace'
import { Modal, Notice, Empty } from './common'
import {
  formatMoney,
  formatDate,
  parseMoney,
  uid,
  supplierReturnReasons,
  type SupplierReturn,
  type Supplier,
} from '../domain/model'
import {
  createSupplier,
  editSupplier,
  confirmSupplierBalance,
  supplierBalance,
  recordSupplierSettlement,
  quoteSupplierReturn,
  recordSupplierReturn,
  saveReorderPolicy,
  type SupplierReturnInput,
} from '../domain/suppliers'
import { openSession } from '../domain/cash'

export function StockDialogs({
  dialog,
  onSupplierCreated,
}: {
  dialog: Dialog
  onSupplierCreated: (id: string) => void
}) {
  if (dialog.type === 'supplier')
    return <SupplierDialog supplierId={dialog.supplierId} onCreated={onSupplierCreated} />
  if (dialog.type === 'supplier-balance') return <BalanceDialog supplierId={dialog.supplierId} />
  if (dialog.type === 'supplier-cash') return <SupplierCashDialog supplierId={dialog.supplierId} />
  if (dialog.type === 'supplier-return')
    return (
      <SupplierReturnDialog initialSupplierId={dialog.supplierId} initialBatchId={dialog.batchId} />
    )
  if (dialog.type === 'supplier-return-record')
    return <SupplierReturnRecord returnId={dialog.returnId} />
  if (dialog.type === 'reorder-policy')
    return <ReorderPolicyDialog initialProductId={dialog.productId} />
  return null
}
function SupplierDialog({
  supplierId,
  onCreated,
}: {
  supplierId?: string
  onCreated: (id: string) => void
}) {
  const { state, role, run, notify, close } = useWorkspace()
  const existing = state.suppliers.find((s) => s.id === supplierId)
  const [contact, setContact] = useState<Pick<Supplier, 'name' | 'agency' | 'phone' | 'address'>>({
    name: existing?.name ?? '',
    agency: existing?.agency ?? '',
    phone: existing?.phone ?? '',
    address: existing?.address ?? '',
  })
  const [amount, setAmount] = useState('')
  const [direction, setDirection] = useState<'payable' | 'credit'>('payable')
  const [note, setNote] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    try {
      const result = run(
        (s) =>
          existing
            ? editSupplier(s, existing.id, contact, role)
            : createSupplier(
                s,
                {
                  ...contact,
                  openingBalance: parseMoney(amount) * (direction === 'credit' ? -1 : 1),
                  openingNote: note,
                  confirmed,
                },
                role,
                new Date().toISOString(),
              ),
        existing
          ? 'Supplier contacts updated. Original invoices were not rewritten.'
          : 'Supplier profile and confirmed starting balance saved.',
      )
      if (result) {
        if (!existing) onCreated(result.suppliers.at(-1)!.id)
        close()
      }
    } catch (error) {
      notify((error as Error).message, 'error')
    }
  }
  return (
    <Modal
      title={existing ? 'Edit supplier profile' : 'New supplier profile'}
      subtitle="Use sample contacts and balances. This is not an authenticated supplier connection."
      onClose={close}
      wide
    >
      <form onSubmit={submit}>
        <div className="form-grid two-cols">
          <label>
            Supplier name
            <input
              aria-label="Supplier profile name"
              autoFocus
              required
              minLength={2}
              maxLength={100}
              value={contact.name}
              onChange={(e) => setContact({ ...contact, name: e.target.value })}
            />
          </label>
          <label>
            Agency / company
            <input
              aria-label="Supplier agency"
              maxLength={100}
              value={contact.agency}
              onChange={(e) => setContact({ ...contact, agency: e.target.value })}
            />
          </label>
          <label>
            Phone / WhatsApp
            <input
              aria-label="Supplier phone"
              type="tel"
              maxLength={40}
              placeholder="Sample +92 phone; optional"
              value={contact.phone}
              onChange={(e) => setContact({ ...contact, phone: e.target.value })}
            />
          </label>
          <label>
            Address
            <input
              aria-label="Supplier address"
              maxLength={150}
              value={contact.address}
              onChange={(e) => setContact({ ...contact, address: e.target.value })}
            />
          </label>
          {!existing && (
            <>
              <label>
                Starting balance direction
                <select
                  aria-label="Supplier starting balance direction"
                  value={direction}
                  onChange={(e) => {
                    setDirection(e.target.value as typeof direction)
                    setConfirmed(false)
                  }}
                >
                  <option value="payable">We owe supplier · payable</option>
                  <option value="credit">Supplier owes us · credit</option>
                </select>
              </label>
              <label>
                Starting balance (Rs.)
                <input
                  aria-label="Supplier starting balance"
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value)
                    setConfirmed(false)
                  }}
                />
              </label>
              <label className="full-span">
                Starting balance note
                <textarea
                  aria-label="Supplier starting balance note"
                  maxLength={300}
                  rows={2}
                  placeholder="New sample account, or checked carried-forward balance"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
            </>
          )}
        </div>
        {existing ? (
          <Notice>
            Editing contact details preserves the original invoice supplier-name snapshots and does
            not edit the confirmed starting balance.
          </Notice>
        ) : (
          <>
            <Notice>
              Enter zero only for a genuinely new/settled sample account. Starting balances do not
              move drawer cash.
            </Notice>
            <label className="check-label">
              <input
                type="checkbox"
                required
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              I confirm this starting supplier balance, including zero.
            </label>
          </>
        )}
        <div className="form-actions">
          <button type="button" className="button button-secondary" onClick={close}>
            Cancel
          </button>
          <button
            type="submit"
            className="button button-primary"
            disabled={!existing && !confirmed}
          >
            <Save size={16} />
            {existing ? 'Save supplier contacts' : 'Create supplier'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
function BalanceDialog({ supplierId }: { supplierId: string }) {
  const { state, role, run, notify, close } = useWorkspace()
  const supplier = state.suppliers.find((s) => s.id === supplierId)
  const [amount, setAmount] = useState('')
  const [direction, setDirection] = useState<'payable' | 'credit'>('payable')
  const [note, setNote] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    try {
      if (
        run(
          (s) =>
            confirmSupplierBalance(
              s,
              supplierId,
              parseMoney(amount) * (direction === 'credit' ? -1 : 1),
              note,
              role,
              new Date().toISOString(),
              confirmed,
            ),
          'Supplier statement reconciled. No cash transaction was invented.',
        )
      )
        close()
    } catch (error) {
      notify((error as Error).message, 'error')
    }
  }
  return (
    <Modal title="Confirm current supplier statement" subtitle={supplier?.name} onClose={close}>
      <Notice tone="warning">
        Old purchase costs do not prove an unpaid debt. Enter the supplier's actual current sample
        statement balance. The system deducts already-posted Phase 3 movements to derive the
        carried-forward balance, avoiding duplicate charges.
      </Notice>
      <form onSubmit={submit}>
        <div className="form-grid two-cols">
          <label>
            Statement direction
            <select
              value={direction}
              onChange={(e) => {
                setDirection(e.target.value as typeof direction)
                setConfirmed(false)
              }}
            >
              <option value="payable">We owe supplier</option>
              <option value="credit">Supplier owes us / holds credit</option>
            </select>
          </label>
          <label>
            Current statement balance (Rs.)
            <input
              aria-label="Current supplier statement balance"
              required
              autoFocus
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value)
                setConfirmed(false)
              }}
            />
          </label>
          <label className="full-span">
            Verification note
            <textarea
              aria-label="Supplier statement note"
              required
              minLength={2}
              maxLength={300}
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
        </div>
        <label className="check-label">
          <input
            type="checkbox"
            required
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          I checked this current balance against the supplier's statement.
        </label>
        <div className="form-actions">
          <button className="button button-secondary" type="button" onClick={close}>
            Cancel
          </button>
          <button type="submit" className="button button-primary" disabled={!confirmed}>
            <CheckCircle2 size={17} />
            Confirm supplier balance
          </button>
        </div>
      </form>
    </Modal>
  )
}
function SupplierCashDialog({ supplierId }: { supplierId: string }) {
  const { state, role, run, notify, close, navigate } = useWorkspace()
  const supplier = state.suppliers.find((s) => s.id === supplierId)
  let balance: number | null = null
  try {
    balance = supplierBalance(state, supplierId)
  } catch {
    /* Needs statement verification. */
  }
  const [kind, setKind] = useState<'payment' | 'refund'>(
    balance !== null && balance < 0 ? 'refund' : 'payment',
  )
  const [amount, setAmount] = useState('')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [requestId] = useState(uid)
  const cashOpen = !!openSession(state)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    try {
      if (
        run(
          (s) =>
            recordSupplierSettlement(
              s,
              {
                supplierId,
                kind,
                amount: parseMoney(amount),
                reference,
                notes,
                confirmed,
                requestId,
              },
              role,
              new Date().toISOString(),
            ),
          'Supplier cash settlement saved together with the drawer journal.',
        )
      )
        close()
    } catch (error) {
      notify((error as Error).message, 'error')
    }
  }
  return (
    <Modal title="Supplier cash settlement" subtitle={supplier?.name} onClose={close}>
      <Notice>
        {balance === null
          ? 'Reconcile this supplier statement before any cash settlement.'
          : balance < 0
            ? `Supplier holds ${formatMoney(-balance)} credit. A received cash refund reduces that credit.`
            : `Payable: ${formatMoney(balance)}. Payment cannot exceed the known payable or drawer cash.`}
      </Notice>
      <form onSubmit={submit}>
        <div className="form-grid two-cols">
          <label>
            Cash movement
            <select
              aria-label="Supplier cash movement"
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as typeof kind)
                setConfirmed(false)
              }}
            >
              <option value="payment">Pay supplier from drawer</option>
              <option value="refund">Receive supplier cash refund</option>
            </select>
          </label>
          <label>
            Amount (Rs.)
            <input
              aria-label="Supplier cash amount"
              required
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value)
                setConfirmed(false)
              }}
            />
          </label>
          <label className="full-span">
            Receipt / payment reference
            <input
              aria-label="Supplier cash reference"
              required
              minLength={2}
              maxLength={80}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </label>
          <label className="full-span">
            Notes
            <textarea
              rows={2}
              maxLength={300}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </div>
        {!cashOpen && (
          <Notice tone="warning">
            A current cash shift is required.{' '}
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
          I confirmed the actual supplier cash exchange and reference.
        </label>
        <div className="form-actions">
          <button type="button" className="button button-secondary" onClick={close}>
            Cancel
          </button>
          <button
            type="submit"
            className="button button-primary"
            disabled={!confirmed || !cashOpen || balance === null}
          >
            <Banknote size={17} />
            Save supplier cash
          </button>
        </div>
      </form>
    </Modal>
  )
}
function SupplierReturnDialog({
  initialSupplierId = '',
  initialBatchId,
}: {
  initialSupplierId?: string
  initialBatchId?: string
}) {
  const { state, today, role, run, notify, open, close } = useWorkspace()
  const [supplierId, setSupplierId] = useState(initialSupplierId)
  const [reason, setReason] = useState<SupplierReturn['reason']>(
    state.batches.find((b) => b.id === initialBatchId)?.expiresOn! < today ? 'Expired' : 'Damaged',
  )
  const [quantities, setQuantities] = useState<
    Record<string, { shelf: string; quarantine: string }>
  >({})
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [requestId] = useState(uid)
  useEffect(() => {
    setQuantities({})
    setConfirmed(false)
  }, [supplierId])
  const batches = state.batches
    .filter(
      (b) =>
        b.stockUnits > 0 &&
        state.purchases.some((p) => p.id === b.purchaseId && p.supplierId === supplierId),
    )
    .sort((a, b) =>
      a.id === initialBatchId
        ? -1
        : b.id === initialBatchId
          ? 1
          : a.expiresOn.localeCompare(b.expiresOn),
    )
  const lines = batches.flatMap((b) => {
    const q = quantities[b.id]
    return q && (Number(q.shelf) > 0 || Number(q.quarantine) > 0)
      ? [{ batchId: b.id, shelfUnits: Number(q.shelf), quarantinedUnits: Number(q.quarantine) }]
      : []
  })
  const input: SupplierReturnInput = {
    supplierId,
    reason,
    lines,
    creditReference: reference,
    notes,
    confirmed,
    requestId,
  }
  let quote: ReturnType<typeof quoteSupplierReturn> | undefined
  let error = ''
  if (lines.length) {
    try {
      quote = quoteSupplierReturn(state, input, today)
    } catch (e) {
      error = (e as Error).message
    }
  }
  const update = (id: string, key: 'shelf' | 'quarantine', value: string) => {
    setQuantities({
      ...quantities,
      [id]: {
        shelf: quantities[id]?.shelf ?? '0',
        quarantine: quantities[id]?.quarantine ?? '0',
        [key]: value,
      },
    })
    setConfirmed(false)
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const result = run((s) => recordSupplierReturn(s, input, role, new Date().toISOString()))
    if (result) {
      const record = result.supplierReturns.at(-1)!
      notify(
        `${record.number}: stock removed and accepted supplier credit posted; no drawer cash deducted.`,
        'success',
      )
      open({ type: 'supplier-return-record', returnId: record.id })
    }
  }
  return (
    <Modal
      title="Return goods to supplier"
      subtitle="Only accepted credit notes are booked. Original delivery cost, never retail price."
      onClose={close}
      wide
    >
      <Notice tone="warning">
        Record the goods actually accepted by the original supplier. Shelf and quarantine quantities
        are distinct. Unknown-batch provisional customer goods cannot be assigned to a guessed
        supplier.
      </Notice>
      <form onSubmit={submit}>
        <div className="form-grid two-cols">
          <label>
            Original supplier
            <select
              aria-label="Supplier return profile"
              required
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
            >
              <option value="">Select original supplier…</option>
              {state.suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Supplier return reason
            <select
              aria-label="Supplier return reason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value as typeof reason)
                setConfirmed(false)
              }}
            >
              {supplierReturnReasons.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="supplier-return-lines">
          {batches.map((b) => {
            const product = state.products.find((p) => p.id === b.productId)!
            const purchase = state.purchases.find((p) => p.id === b.purchaseId)!
            const bonus = purchase.lines.find((l) => l.batchId === b.id)?.stockKind === 'bonus'
            return (
              <div
                className={`supplier-return-line ${b.id === initialBatchId ? 'highlighted' : ''}`}
                key={b.id}
              >
                <div>
                  <strong>{product.name}</strong>
                  <span>
                    {b.number} · {purchase.number} · Exp {b.expiresOn}
                  </span>
                  <small>
                    Original cost {formatMoney(b.costPerBase)} / {product.baseUnit}
                    {bonus ? ' · ZERO-COST BONUS' : ''}
                  </small>
                </div>
                <label>
                  Shelf units (max {b.stockUnits - b.quarantinedUnits})
                  <input
                    aria-label={`Supplier shelf units for ${b.number}`}
                    type="number"
                    min={0}
                    max={b.stockUnits - b.quarantinedUnits}
                    step={1}
                    value={quantities[b.id]?.shelf ?? '0'}
                    onChange={(e) => update(b.id, 'shelf', e.target.value)}
                  />
                </label>
                <label>
                  Quarantine (max {b.quarantinedUnits})
                  <input
                    aria-label={`Supplier quarantine units for ${b.number}`}
                    type="number"
                    min={0}
                    max={b.quarantinedUnits}
                    step={1}
                    disabled={!b.quarantinedUnits}
                    value={quantities[b.id]?.quarantine ?? '0'}
                    onChange={(e) => update(b.id, 'quarantine', e.target.value)}
                  />
                </label>
              </div>
            )
          })}
        </div>
        {supplierId && !batches.length && (
          <Empty title="No on-hand batches from this supplier">
            Already sold/returned units cannot be returned again.
          </Empty>
        )}
        <div className="form-grid two-cols">
          <label>
            Accepted supplier credit note / reference
            <input
              aria-label="Supplier credit note reference"
              required
              minLength={2}
              maxLength={80}
              value={reference}
              onChange={(e) => {
                setReference(e.target.value)
                setConfirmed(false)
              }}
            />
          </label>
          <label>
            Return notes
            <textarea
              maxLength={400}
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="refund-total">
          <span>Accepted cost-based supplier credit</span>
          <strong data-testid="supplier-return-credit">
            {formatMoney(quote?.totalCredit ?? 0)}
          </strong>
        </div>
        <p className="field-help">
          Zero-cost bonus goods remove physical stock but create zero credit. Credits offset the
          next supplier purchase through its running balance; they are never silently deducted from
          drawer cash.
        </p>
        <label className="check-label">
          <input
            type="checkbox"
            required
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          The supplier accepted these goods and credited the displayed original-cost amount.
        </label>
        <div className="form-actions">
          <button className="button button-secondary" type="button" onClick={close}>
            Cancel
          </button>
          <button
            type="submit"
            className="button button-primary"
            disabled={!quote || !!error || !confirmed}
          >
            <RotateCcw size={16} />
            Confirm supplier return
          </button>
        </div>
      </form>
    </Modal>
  )
}
function SupplierReturnRecord({ returnId }: { returnId: string }) {
  const { state, close } = useWorkspace()
  const r = state.supplierReturns.find((r) => r.id === returnId)
  return (
    <Modal
      title={r?.number ?? 'Supplier return unavailable'}
      subtitle={
        r
          ? `${state.suppliers.find((s) => s.id === r.supplierId)?.name} · ${formatDate(r.createdAt, true)} · ${r.reason}`
          : undefined
      }
      onClose={close}
      wide
    >
      {r ? (
        <>
          <div className="purchase-confirmed">
            <CheckCircle2 size={22} />
            <div>
              <strong>Accepted return credit recorded</strong>
              <span>Supplier credit reference: {r.creditReference}</span>
            </div>
            <strong>{formatMoney(r.totalCredit)}</strong>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Product / original batch</th>
                  <th>Original invoice</th>
                  <th>Shelf + quarantine</th>
                  <th>Credit</th>
                </tr>
              </thead>
              <tbody>
                {r.lines.map((l) => (
                  <tr key={l.batchId}>
                    <td>
                      <strong>{l.productName}</strong>
                      <small>{l.batchNumber}</small>
                    </td>
                    <td>{state.purchases.find((p) => p.id === l.purchaseId)?.number}</td>
                    <td>
                      {l.shelfUnits} + {l.quarantinedUnits} = {l.baseQuantity}
                    </td>
                    <td>{formatMoney(l.credit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Notice>
            Stock and supplier credit were saved together. No cash was paid or refunded by this
            credit note. Original purchase/sale snapshots remain unchanged.
          </Notice>
          {r.notes && <p className="record-note">{r.notes}</p>}
        </>
      ) : (
        <Notice tone="error">This return was removed by a demo reset.</Notice>
      )}
      <div className="form-actions">
        <button className="button button-primary" onClick={close}>
          Done
          <CheckCircle2 size={16} />
        </button>
      </div>
    </Modal>
  )
}
function ReorderPolicyDialog({ initialProductId = '' }: { initialProductId?: string }) {
  const { state, role, run, close } = useWorkspace()
  const [productId, setProductId] = useState(initialProductId || state.products[0]?.id || '')
  const product = state.products.find((p) => p.id === productId)
  const [critical, setCritical] = useState(String(product?.reorder.criticalUnits ?? 1))
  const [warning, setWarning] = useState(String(product?.reorder.warningUnits ?? 2))
  const [target, setTarget] = useState(String(product?.reorder.targetUnits ?? 4))
  const [supplierId, setSupplierId] = useState(product?.reorder.preferredSupplierId ?? '')
  useEffect(() => {
    const p = state.products.find((p) => p.id === productId)
    if (p) {
      setCritical(String(p.reorder.criticalUnits))
      setWarning(String(p.reorder.warningUnits))
      setTarget(String(p.reorder.targetUnits))
      setSupplierId(p.reorder.preferredSupplierId ?? '')
    }
  }, [productId])
  return (
    <Modal
      title="Product reorder thresholds"
      subtitle="Thresholds use smallest units. Zero saleable stock is always the out-of-stock stage."
      onClose={close}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (
            run(
              (s) =>
                saveReorderPolicy(
                  s,
                  productId,
                  {
                    criticalUnits: Number(critical),
                    warningUnits: Number(warning),
                    targetUnits: Number(target),
                    preferredSupplierId: supplierId || null,
                  },
                  role,
                ),
              'Product reorder policy saved.',
            )
          )
            close()
        }}
      >
        <div className="form-grid two-cols">
          <label className="full-span">
            Product
            <select
              aria-label="Reorder policy product"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
            >
              {state.products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.baseUnit}
                </option>
              ))}
            </select>
          </label>
          <label>
            Critical limit
            <input
              aria-label="Critical stock limit"
              required
              type="number"
              min={1}
              max={1000000000000}
              step={1}
              value={critical}
              onChange={(e) => setCritical(e.target.value)}
            />
          </label>
          <label>
            Warning limit
            <input
              aria-label="Warning stock limit"
              required
              type="number"
              min={1}
              max={1000000000000}
              step={1}
              value={warning}
              onChange={(e) => setWarning(e.target.value)}
            />
          </label>
          <label>
            Target after replenishment
            <input
              aria-label="Target stock level"
              required
              type="number"
              min={1}
              max={1000000000000}
              step={1}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </label>
          <label>
            Preferred supplier
            <select
              aria-label="Preferred reorder supplier"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
            >
              <option value="">Use delivery history / choose per order</option>
              {state.suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <Notice>
          Critical &lt; warning &lt; target. Initial limits of 1 / 2 / 4 boxes converted to base
          units are adjustable sample defaults, not your confirmed purchasing policy.
        </Notice>
        <div className="form-actions">
          <button className="button button-secondary" type="button" onClick={close}>
            Cancel
          </button>
          <button className="button button-primary" type="submit">
            <Truck size={17} />
            Save reorder thresholds
          </button>
        </div>
      </form>
    </Modal>
  )
}
