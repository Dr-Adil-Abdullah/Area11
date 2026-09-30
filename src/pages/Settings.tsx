import { useEffect, useState } from 'react'
import {
  Save,
  ShieldCheck,
  HardDrive,
  RotateCcw,
  Printer,
  Download,
  CalendarClock,
} from 'lucide-react'
import { businessDate, parsePercent } from '../domain/model'
import { STORAGE_KEY } from '../data/repository'
import { MIGRATION_BACKUP_KEY, PHASE2_BACKUP_KEY } from '../data/migrations'
import { saveSettings } from '../domain/operations'
import { useWorkspace } from '../ui/workspace'
import { Notice, PageHeading } from '../ui/common'

export default function SettingsPage() {
  const { state, role, run, open, notify, storageIssue } = useWorkspace()
  const [form, setForm] = useState(state.settings)
  const [expiryDays, setExpiryDays] = useState({
    far: String(state.settings.expiry.farDays),
    middle: String(state.settings.expiry.middleDays),
    near: String(state.settings.expiry.nearDays),
  })
  const [limit, setLimit] = useState(String(state.settings.cashierMaxDiscountBps / 100))
  useEffect(() => {
    setForm(state.settings)
    setLimit(String(state.settings.cashierMaxDiscountBps / 100))
    setExpiryDays({
      far: String(state.settings.expiry.farDays),
      middle: String(state.settings.expiry.middleDays),
      near: String(state.settings.expiry.nearDays),
    })
  }, [state.settings])
  let hasOriginal = false
  let hasPhase2Original = false
  try {
    hasOriginal = !!localStorage.getItem(MIGRATION_BACKUP_KEY)
    hasPhase2Original = !!localStorage.getItem(PHASE2_BACKUP_KEY)
  } catch {
    /* Storage may be disabled. */
  }
  const downloadSnapshot = (original: false | 'phase1' | 'phase2') => {
    try {
      const raw = localStorage.getItem(
        original === 'phase2'
          ? PHASE2_BACKUP_KEY
          : original === 'phase1'
            ? MIGRATION_BACKUP_KEY
            : STORAGE_KEY,
      )
      if (!raw) throw new Error('No saved snapshot is available at this browser origin.')
      const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `area11-${original === 'phase2' ? 'original-phase-2' : original ? 'original-phase-1' : 'recovery-snapshot'}-${businessDate()}.json`
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      notify(
        'Snapshot download started. This is a recovery copy, not cloud backup or a restore workflow.',
        'info',
      )
    } catch (error) {
      notify((error as Error).message, 'error')
    }
  }
  return (
    <div className="page-content settings-page">
      <PageHeading
        eyebrow="DEMO WORKSPACE"
        title="Workspace settings"
        description="Receipt identity and discount policy for your sample pharmacy. Everything stays in this browser."
      />
      <form
        className="surface settings-form"
        onSubmit={(e) => {
          e.preventDefault()
          try {
            const next = {
              ...form,
              cashierMaxDiscountBps: parsePercent(limit),
              expiry: {
                ...form.expiry,
                farDays: Number(expiryDays.far),
                middleDays: Number(expiryDays.middle),
                nearDays: Number(expiryDays.near),
              },
            }
            run((s) => saveSettings(s, next, role), 'Receipt, discount and expiry settings saved.')
          } catch (error) {
            notify((error as Error).message, 'error')
          }
        }}
      >
        <div className="section-title">
          <span className="metric-icon green">
            <Printer size={20} />
          </span>
          <div>
            <h2>Receipt identity</h2>
            <p>The default name is a placeholder, not confirmed shop branding.</p>
          </div>
        </div>
        <div className="form-grid two-cols">
          <label>
            Shop name
            <input
              required
              minLength={2}
              maxLength={80}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label>
            Phone <span className="optional">optional</span>
            <input
              maxLength={50}
              value={form.phone}
              placeholder="Shop phone number"
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </label>
          <label className="full-span">
            Address
            <input
              maxLength={150}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </label>
          <label className="full-span">
            Receipt footer
            <textarea
              rows={2}
              maxLength={180}
              value={form.footer}
              onChange={(e) => setForm({ ...form, footer: e.target.value })}
            />
          </label>
          <label>
            Default receipt width
            <select
              value={form.paperWidth}
              onChange={(e) => setForm({ ...form, paperWidth: Number(e.target.value) as 58 | 80 })}
            >
              <option value={80}>80mm thermal roll</option>
              <option value={58}>58mm thermal roll</option>
            </select>
          </label>
          <div className="settings-fixed">
            <span>Interface & currency</span>
            <strong>English · PKR</strong>
            <small>Time zone: Asia/Karachi</small>
          </div>
        </div>
        <div className="section-title discount-settings-title">
          <span className="metric-icon green">
            <ShieldCheck size={20} />
          </span>
          <div>
            <h2>Discount policy</h2>
            <p>
              Owner/Manager can configure these demo defaults. Purchase-cost protection cannot be
              disabled.
            </p>
          </div>
        </div>
        <div className="form-grid two-cols">
          <label>
            Discount calculation
            <select
              aria-label="Discount calculation"
              value={form.discountMode}
              onChange={(e) =>
                setForm({ ...form, discountMode: e.target.value as 'margin' | 'retail' })
              }
            >
              <option value="margin">Percentage of profit margin</option>
              <option value="retail">Percentage of full retail amount</option>
            </select>
          </label>
          <label>
            Cashier maximum discount (%)
            <input
              aria-label="Cashier maximum discount"
              type="number"
              required
              min={0}
              max={100}
              step="0.01"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
            />
          </label>
        </div>
        <p className="field-help">
          The initial margin mode and 10% cashier limit are adjustable sample settings, not your
          confirmed business policy. Discounts cannot put an individual line below cost; round-down
          cannot put the invoice below total purchase cost.
        </p>
        <div className="section-title discount-settings-title">
          <span className="metric-icon amber">
            <CalendarClock size={20} />
          </span>
          <div>
            <h2>Three expiry alert windows</h2>
            <p>Mutually exclusive levels; expired stock has its own fixed red tab.</p>
          </div>
        </div>
        <div className="form-grid three-cols">
          {(['far', 'middle', 'near'] as const).map((level, index) => (
            <div className="expiry-setting" key={level}>
              <label>
                Level {index + 1} · {level} days
                <input
                  aria-label={`${level} expiry days`}
                  required
                  type="number"
                  min={level === 'near' ? 0 : 1}
                  max={3650}
                  step={1}
                  value={expiryDays[level]}
                  onChange={(e) => setExpiryDays({ ...expiryDays, [level]: e.target.value })}
                />
              </label>
              <label>
                Level {index + 1} color
                <input
                  aria-label={`${level} expiry color`}
                  type="color"
                  value={form.expiry[`${level}Color`]}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      expiry: { ...form.expiry, [`${level}Color`]: e.target.value },
                    })
                  }
                />
              </label>
            </div>
          ))}
        </div>
        <p className="field-help">
          Near days &lt; middle days &lt; far days. 90 / 180 / 365 days and their colors are
          adjustable sample defaults, not a confirmed supplier-return cutoff policy.
        </p>
        <div className="form-actions">
          <button className="button button-primary" type="submit">
            <Save size={17} />
            Save settings
          </button>
        </div>
      </form>
      <div className="surface workspace-info">
        <div className="section-title">
          <span className="metric-icon blue">
            <HardDrive size={20} />
          </span>
          <div>
            <h2>Local demo storage</h2>
            <p>Browser persistence, not full offline support or a cloud backup.</p>
          </div>
        </div>
        <Notice>
          Keep real customer and financial data out of this demo. Clearing site data removes this
          workspace and its migration backup. Existing Phase 1/2 data is migrated with an original
          snapshot retained in this same browser origin. Server-backed security, synchronization,
          and scheduled backups are later-phase work.
        </Notice>
        <div className="settings-facts">
          <div>
            <span>Version</span>
            <strong>Phase 3 · v0.3</strong>
          </div>
          <div>
            <span>Storage</span>
            <strong>This browser only</strong>
          </div>
          <div>
            <span>Sample receipts</span>
            <strong>{state.sales.length}</strong>
          </div>
        </div>
        {role === 'owner' && (
          <div className="snapshot-recovery">
            <strong>
              {storageIssue ? 'Preserve saved data before resetting' : 'Preserve a demo snapshot'}
            </strong>
            <p>
              Local data does not move between browsers or preview domains. Recovery downloads are
              copies only; import, scheduled backups and cloud restore remain later work.
            </p>
            <div>
              <button className="button button-secondary" onClick={() => downloadSnapshot(false)}>
                <Download size={16} />
                Download saved snapshot
              </button>
              {hasPhase2Original && (
                <button
                  className="button button-secondary"
                  onClick={() => downloadSnapshot('phase2')}
                >
                  <Download size={16} />
                  Download original Phase 2
                </button>
              )}
              {hasOriginal && (
                <button
                  className="button button-secondary"
                  onClick={() => downloadSnapshot('phase1')}
                >
                  <Download size={16} />
                  Download original Phase 1
                </button>
              )}
            </div>
          </div>
        )}
        {role === 'owner' && (
          <div className="reset-row">
            <div>
              <strong>Reset sample workspace</strong>
              <p>
                Remove current demo transactions and restore sample inventory. Original Phase 1/2
                migration copies are retained, if present.
              </p>
            </div>
            <button
              className="button button-danger-outline"
              onClick={() => open({ type: 'reset' })}
            >
              <RotateCcw size={16} />
              Reset demo
            </button>
          </div>
        )}
      </div>
      <div className="security-note">
        <ShieldCheck size={19} />
        <p>
          The role switcher is only a testing tool. It does not authenticate users or provide
          production-grade security.
        </p>
      </div>
    </div>
  )
}
