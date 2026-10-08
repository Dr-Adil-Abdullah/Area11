import { useState, type CSSProperties } from 'react'
import { CalendarClock, RotateCcw, ShieldCheck } from 'lucide-react'
import { daysUntil, formatDate } from '../domain/model'
import { expiryLots, expiryLevel, expiryColor, type ExpiryLevel } from '../domain/alerts'
import { useWorkspace } from '../ui/workspace'
import { Empty, Notice, PageHeading } from '../ui/common'

const labels: Record<ExpiryLevel, string> = {
  far: 'Level 1 · Far window',
  middle: 'Level 2 · Middle warning',
  near: 'Level 3 · Near expiry',
  expired: 'Expired goods',
}
export default function ExpiryPage() {
  const { state, today, open, navigate } = useWorkspace()
  const [level, setLevel] = useState<ExpiryLevel>('near')
  const [supplierId, setSupplierId] = useState('')
  const levels: ExpiryLevel[] = ['far', 'middle', 'near', 'expired']
  const lots = expiryLots(state, today, level, supplierId)
  const policy = state.settings.expiry
  const outside = state.batches.filter(
    (b) => b.stockUnits > 0 && expiryLevel(b, today, policy) === null,
  ).length
  return (
    <div className="page-content">
      <PageHeading
        eyebrow="EXPIRY CONTROL"
        title="Expiry watch"
        description="Three configurable alert windows, plus an isolated expired-goods view."
      >
        <button className="button button-secondary" onClick={() => navigate('settings')}>
          Configure alert days & colors
        </button>
      </PageHeading>
      <div className="expiry-summary-grid">
        {levels.map((l) => (
          <button
            key={l}
            className={`surface expiry-summary ${level === l ? 'selected' : ''}`}
            style={{ '--alert-color': expiryColor(l, policy) } as CSSProperties}
            aria-pressed={level === l}
            onClick={() => setLevel(l)}
          >
            <CalendarClock size={22} />
            <span>{labels[l]}</span>
            <strong>{expiryLots(state, today, l, supplierId).length}</strong>
            <small>
              {l === 'expired'
                ? 'Expiry date has passed · blocked'
                : l === 'near'
                  ? `0–${policy.nearDays} days remaining`
                  : l === 'middle'
                    ? `${policy.nearDays + 1}–${policy.middleDays} days remaining`
                    : `${policy.middleDays + 1}–${policy.farDays} days remaining`}
            </small>
          </button>
        ))}
      </div>
      {level === 'expired' && (
        <Notice tone="warning">
          These lots cannot be sold or used as owner medicine. Only a verified supplier return
          removes these goods in this phase. An expiry date remains valid through that date; the
          next day is expired.
        </Notice>
      )}
      <section className="surface finance-history">
        <div className="surface-heading">
          <div>
            <h2>
              {labels[level]} <span className="heading-count">{lots.length}</span>
            </h2>
            <p>On-hand lots only. Each batch appears in one band, not three.</p>
          </div>
          <label className="sr-select-label">
            <span className="sr-only">Expiry supplier filter</span>
            <select
              aria-label="Expiry supplier filter"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
            >
              <option value="">All suppliers</option>
              {state.suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Product / batch</th>
                <th>Supplier / invoice</th>
                <th>Expiry</th>
                <th>On hand</th>
                <th>Quarantine</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {lots.map((b) => {
                const p = state.products.find((p) => p.id === b.productId)!
                const purchase = state.purchases.find((p) => p.id === b.purchaseId)!
                const supplier = state.suppliers.find((s) => s.id === purchase.supplierId)!
                return (
                  <tr key={b.id}>
                    <td>
                      <strong>{p.name}</strong>
                      <small>
                        {b.number}
                        {purchase.lines.find((l) => l.batchId === b.id)?.stockKind === 'bonus'
                          ? ' · BONUS / SAMPLE'
                          : ''}
                      </small>
                    </td>
                    <td>
                      {supplier.name}
                      <small>{purchase.number}</small>
                    </td>
                    <td>
                      <span className="expiry-date">
                        <span
                          className="alert-color-dot"
                          style={{ background: expiryColor(level, policy) }}
                        />
                        {formatDate(b.expiresOn)}
                      </span>
                      <small>
                        {daysUntil(b.expiresOn, today) < 0
                          ? `${-daysUntil(b.expiresOn, today)} days past expiry`
                          : `${daysUntil(b.expiresOn, today)} days remaining`}
                      </small>
                    </td>
                    <td>
                      {b.stockUnits.toLocaleString()} {p.baseUnit}
                      {p.baseUnit === 'ml' || b.stockUnits === 1 ? '' : 's'}
                    </td>
                    <td>{b.quarantinedUnits}</td>
                    <td>
                      <button
                        className="button button-text"
                        onClick={() =>
                          open({ type: 'supplier-return', supplierId: supplier.id, batchId: b.id })
                        }
                      >
                        <RotateCcw size={14} />
                        Supplier return
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {!lots.length && (
          <Empty title="No on-hand lots in this window">
            Choose another alert band or supplier filter.
          </Empty>
        )}
      </section>
      <div className="security-note">
        <ShieldCheck size={18} />
        <p>
          {outside} on-hand lots are beyond the far alert window. Thresholds/colors are sample
          defaults and can be adjusted. Quarantined quantities remain excluded from saleable stock.
        </p>
      </div>
    </div>
  )
}
