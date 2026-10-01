import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  LayoutGrid,
  RotateCcw,
  Banknote,
  Wallet,
  Truck,
  CalendarClock,
  PackageSearch,
  Boxes,
  ArrowDownToLine,
  ReceiptText,
  Settings,
  ChevronRight,
  ChevronDown,
  FlaskConical,
  Layers,
  CheckCircle2,
  ShieldCheck,
  X,
  AlertCircle,
  ArrowDown,
  ArrowUpRight,
} from 'lucide-react'
import { type AppState, type Role, businessDate, formatMoney } from './domain/model'
import { cartDetails } from './domain/operations'
import { demoStore } from './data/store'
import { WorkspaceContext, type Dialog, type Page } from './ui/workspace'
import { Notice } from './ui/common'
import Dialogs from './ui/Dialogs'
import Counter from './pages/Counter'
import Inventory from './pages/Inventory'
import Purchases, { blankStockDraft, selectDraftProduct } from './pages/Purchases'
import Receipts from './pages/Receipts'
import SettingsPage from './pages/Settings'
import ReturnsPage from './pages/Returns'
import CashPage from './pages/Cash'
import AccountsPage from './pages/Accounts'
import SuppliersPage from './pages/Suppliers'
import ExpiryPage from './pages/Expiry'
import ReorderPage from './pages/Reorder'
import { requireOpenSession } from './domain/cash'

const nav = [
  { page: 'counter', label: 'Counter', icon: LayoutGrid, restricted: false },
  { page: 'inventory', label: 'Inventory', icon: Boxes, restricted: true },
  { page: 'purchases', label: 'Stock in', icon: ArrowDownToLine, restricted: true },
  { page: 'receipts', label: 'Receipts', icon: ReceiptText, restricted: false },
  { page: 'returns', label: 'Returns', icon: RotateCcw, restricted: false },
  { page: 'cash', label: 'Cash drawer', icon: Banknote, restricted: false },
  { page: 'accounts', label: 'Accounts', icon: Wallet, restricted: true },
  { page: 'suppliers', label: 'Suppliers', icon: Truck, restricted: true },
  { page: 'expiry', label: 'Expiry', icon: CalendarClock, restricted: true },
  { page: 'reorder', label: 'Reorder', icon: PackageSearch, restricted: true },
] as const
const titles: Record<Page, string> = {
  counter: 'Counter',
  inventory: 'Inventory',
  purchases: 'Stock in',
  receipts: 'Receipts',
  settings: 'Settings',
  returns: 'Returns',
  cash: 'Cash drawer',
  accounts: 'Accounts',
  suppliers: 'Suppliers',
  expiry: 'Expiry',
  reorder: 'Reorder',
}

export default function App() {
  const { state, issue } = useSyncExternalStore(demoStore.subscribe, demoStore.getSnapshot)
  const [page, setPage] = useState<Page>('counter')
  const [role, setRole] = useState<Role>('owner')
  const [today, setToday] = useState(businessDate())
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [draft, setDraft] = useState(blankStockDraft)
  const [feedback, setFeedback] = useState<{
    message: string
    kind: 'success' | 'error' | 'info'
  } | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const timer = window.setInterval(() => setToday(businessDate()), 30_000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    if (!feedback) return
    const timer = window.setTimeout(() => setFeedback(null), 6500)
    return () => window.clearTimeout(timer)
  }, [feedback])
  const notify = (message: string, kind: 'success' | 'error' | 'info' = 'info') =>
    setFeedback({ message, kind })
  const run = (change: (state: AppState) => AppState, message?: string) => {
    try {
      const result = demoStore.commit(change)
      if (message) notify(message, 'success')
      return result
    } catch (error) {
      notify(error instanceof Error ? error.message : 'This change could not be saved.', 'error')
      return undefined
    }
  }
  const open = (value: Dialog) => {
    setFeedback(null)
    setDialog(value)
  }
  const close = () => setDialog(null)
  const navigate = (value: Page) => {
    if (
      role === 'cashier' &&
      ['inventory', 'purchases', 'settings', 'accounts', 'suppliers', 'expiry', 'reorder'].includes(
        value,
      )
    ) {
      notify('Switch to Owner or Manager to manage the workspace.', 'error')
      return
    }
    setPage(value)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
  const switchRole = (value: Role) => {
    setRole(value)
    if (value === 'cashier') {
      if (
        [
          'inventory',
          'purchases',
          'settings',
          'accounts',
          'suppliers',
          'expiry',
          'reorder',
        ].includes(page)
      )
        setPage('counter')
      if (
        dialog &&
        [
          'product',
          'purchase',
          'reset',
          'link-return',
          'supplier',
          'supplier-balance',
          'supplier-cash',
          'supplier-return',
          'supplier-return-record',
          'reorder-policy',
        ].includes(dialog.type)
      )
        setDialog(null)
    }
    notify(
      `${value.charAt(0).toUpperCase() + value.slice(1)} test mode. This is not a secure login.`,
      'info',
    )
  }
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (dialog || event.repeat) return
      if (
        event.key === 'F2' ||
        ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k')
      ) {
        event.preventDefault()
        setPage('counter')
        requestAnimationFrame(() => {
          searchRef.current?.focus()
          searchRef.current?.select()
        })
      }
      if (page === 'counter' && event.key === 'F4') {
        event.preventDefault()
        setFeedback(null)
        setDialog({ type: 'park' })
      }
      if (page === 'counter' && event.key === 'F8') {
        event.preventDefault()
        if (!state.cart.length) return
        try {
          cartDetails(state, today, state.cart, role)
          requireOpenSession(state)
          setFeedback(null)
          setDialog({ type: 'checkout' })
        } catch (e) {
          setFeedback({ message: (e as Error).message, kind: 'error' })
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [dialog, page, state, today, role])
  const onProductCreated = (id: string, rowId?: string) => {
    if (rowId)
      setDraft((current) => ({
        ...current,
        lines: current.lines.map((line) =>
          line.id === rowId
            ? selectDraftProduct(demoStore.getSnapshot().state, line, id, today)
            : line,
        ),
      }))
  }
  const reset = (actor: Role) => {
    try {
      demoStore.reset(actor)
      setDraft(blankStockDraft())
      setDialog(null)
      setPage('counter')
      notify('Sample workspace restored. Demo records were reset.', 'success')
    } catch (e) {
      notify((e as Error).message, 'error')
    }
  }
  let mobileTotal = 0
  try {
    mobileTotal = cartDetails(state, today).total
  } catch {
    /* Invalid cart is explained in the counter. */
  }
  const navigation = nav.map((item) => (
    <button
      key={item.page}
      className={`nav-item ${page === item.page ? 'active' : ''}`}
      disabled={role === 'cashier' && item.restricted}
      onClick={() => navigate(item.page)}
      aria-current={page === item.page ? 'page' : undefined}
      title={role === 'cashier' && item.restricted ? 'Owner or Manager only (demo)' : item.label}
    >
      <item.icon size={19} />
      <span>{item.label}</span>
      {page === item.page && <span className="nav-active-dot" />}
    </button>
  ))
  return (
    <WorkspaceContext.Provider
      value={{
        state,
        role,
        today,
        storageIssue: issue,
        feedback,
        run,
        notify,
        open,
        close,
        navigate,
      }}
    >
      <a className="skip-link" href="#main-content">
        Skip to workspace
      </a>
      <div className="app-shell">
        <aside className="sidebar">
          <a
            className="brand"
            href="#"
            onClick={(e) => {
              e.preventDefault()
              navigate('counter')
            }}
          >
            <img src={`${import.meta.env.BASE_URL}mark.svg`} width="38" height="38" alt="" />
            <div>
              <strong>
                Area<span>11</span>
              </strong>
              <small>PHARMACY WORKSPACE</small>
            </div>
          </a>
          <div className="workspace-label">YOUR WORKSPACE</div>
          <nav aria-label="Main navigation">{navigation}</nav>
          <div className="sidebar-bottom">
            <button
              className={`nav-item ${page === 'settings' ? 'active' : ''}`}
              disabled={role === 'cashier'}
              onClick={() => navigate('settings')}
            >
              <Settings size={19} />
              <span>Settings</span>
            </button>
            <button className="phase-card" onClick={() => open({ type: 'roadmap' })}>
              <div>
                <Layers size={17} />
                <span>ONE PHASE AT A TIME</span>
                <ArrowUpRight size={14} />
              </div>
              <strong>Smart stock & suppliers</strong>
              <p>Phase 3 of your master plan</p>
              <div className="phase-dots">
                <span className="complete" />
                <span className="complete" />
                <span className="current" />
                <span />
                <span />
              </div>
            </button>
            <div className="sidebar-store">
              <span className="store-avatar">
                <FlaskConical size={18} />
              </span>
              <div>
                <strong>Sample pharmacy</strong>
                <small>Local demo workspace</small>
              </div>
              <ShieldCheck size={15} />
            </div>
          </div>
        </aside>
        <div className="workspace-main">
          <header className="topbar">
            <div className="breadcrumb">
              <span>Workspace</span>
              <ChevronRight size={13} />
              <strong>{titles[page]}</strong>
            </div>
            <div className="topbar-right">
              {state.provisionalReturns.some((p) => !p.linkedReturnId) && (
                <button
                  className="pending-alert"
                  aria-label={`Pending returns: ${state.provisionalReturns.filter((p) => !p.linkedReturnId).length}`}
                  onClick={() => navigate('returns')}
                >
                  <AlertCircle size={16} />
                  <span>Pending returns</span>
                  <strong>
                    {state.provisionalReturns.filter((p) => !p.linkedReturnId).length}
                  </strong>
                </button>
              )}
              <span className={`saved-indicator ${issue ? 'save-warning' : ''}`}>
                <span className="status-dot" />
                {issue ? 'Storage needs attention' : 'Saved in this browser'}
              </span>
              <button
                className="badge badge-demo demo-button"
                onClick={() => open({ type: 'roadmap' })}
              >
                DEMO
              </button>
              <div className="role-select">
                <span className="role-avatar">{role.charAt(0).toUpperCase()}</span>
                <label>
                  <small>TEST ROLE</small>
                  <select
                    aria-label="Test role"
                    value={role}
                    onChange={(e) => switchRole(e.target.value as Role)}
                  >
                    <option value="owner">Owner</option>
                    <option value="manager">Manager</option>
                    <option value="cashier">Cashier</option>
                  </select>
                </label>
                <ChevronDown size={13} />
              </div>
              <button
                className="icon-button mobile-settings"
                aria-label="Workspace settings"
                disabled={role === 'cashier'}
                onClick={() => navigate('settings')}
              >
                <Settings size={19} />
              </button>
            </div>
          </header>
          <aside className="demo-strip" aria-label="Demo workspace status">
            <span>
              <FlaskConical size={14} />
              <strong>Sample data only.</strong> A working demo, not a live pharmacy system.
            </span>
            <button onClick={() => open({ type: 'roadmap' })}>
              Phase 3 · Smart stock
              <ArrowUpRight size={13} />
            </button>
          </aside>
          {issue && (
            <div className="storage-warning">
              <Notice tone="error">
                {issue} {role === 'cashier' && 'Switch the test role to Owner to access Settings.'}
              </Notice>
            </div>
          )}
          <main id="main-content" tabIndex={-1}>
            {page === 'counter' && <Counter searchRef={searchRef} />}
            {page === 'inventory' && role !== 'cashier' && <Inventory />}
            {page === 'purchases' && role !== 'cashier' && (
              <Purchases draft={draft} onChange={setDraft} />
            )}
            {page === 'receipts' && <Receipts />}
            {page === 'returns' && <ReturnsPage />}
            {page === 'cash' && <CashPage />}
            {page === 'accounts' && role !== 'cashier' && <AccountsPage />}
            {page === 'suppliers' && role !== 'cashier' && <SuppliersPage />}
            {page === 'expiry' && role !== 'cashier' && <ExpiryPage />}
            {page === 'reorder' && role !== 'cashier' && <ReorderPage />}
            {page === 'settings' && role !== 'cashier' && <SettingsPage />}
          </main>
        </div>
      </div>
      <nav className="mobile-navigation" aria-label="Mobile navigation">
        {navigation}
      </nav>
      {page === 'counter' && state.cart.length > 0 && (
        <button
          className="mobile-cart-jump"
          onClick={() =>
            document
              .querySelector('.cart-panel')
              ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
        >
          <span>View cart · {state.cart.length} lines</span>
          <strong>{formatMoney(mobileTotal)}</strong>
          <ArrowDown size={17} />
        </button>
      )}
      {feedback && !dialog && (
        <div
          className={`toast toast-${feedback.kind}`}
          role={feedback.kind === 'error' ? 'alert' : 'status'}
        >
          {feedback.kind === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          <span>{feedback.message}</span>
          <button aria-label="Dismiss notification" onClick={() => setFeedback(null)}>
            <X size={16} />
          </button>
        </div>
      )}
      {dialog && (
        <Dialogs
          dialog={dialog}
          onProductCreated={onProductCreated}
          onSupplierCreated={(id) => {
            if (dialog.type === 'supplier' && dialog.selectForPurchase) {
              const supplier = demoStore.getSnapshot().state.suppliers.find((s) => s.id === id)!
              setDraft((d) => ({ ...d, supplierId: id, supplier: supplier.name }))
            }
          }}
          onReset={reset}
        />
      )}
    </WorkspaceContext.Provider>
  )
}
