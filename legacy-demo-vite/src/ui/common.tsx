import { useContext, useEffect, useId, useRef, type ReactNode } from 'react'
import { WorkspaceContext } from './workspace'
import { X, AlertCircle, Info, PackageOpen, Pill, FlaskConical, Package } from 'lucide-react'
import type { Product } from '../domain/model'

export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  onClose: () => void
  wide?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const feedback = useContext(WorkspaceContext)?.feedback
  useEffect(() => {
    const dialog = ref.current!
    if (!dialog.open) dialog.showModal()
    return () => {
      if (dialog.open) dialog.close()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? 'modal-wide' : ''}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="modal-header">
        <div>
          <h2 id={titleId}>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button className="icon-button" aria-label="Close dialog" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      <div className="modal-body">
        {feedback?.kind === 'error' && <Notice tone="error">{feedback.message}</Notice>}
        {children}
      </div>
    </dialog>
  )
}
export function Notice({
  children,
  tone = 'info',
}: {
  children: ReactNode
  tone?: 'info' | 'warning' | 'error' | 'success'
}) {
  const Icon = tone === 'error' || tone === 'warning' ? AlertCircle : Info
  return (
    <div className={`notice notice-${tone}`} role={tone === 'error' ? 'alert' : undefined}>
      <Icon size={17} />
      <div>{children}</div>
    </div>
  )
}
export function Empty({
  title,
  children,
  icon,
}: {
  title: string
  children: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon ?? <PackageOpen size={32} strokeWidth={1.4} />}</div>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  )
}
export function ProductIcon({
  product,
  small = false,
}: {
  product: Pick<Product, 'category'>
  small?: boolean
}) {
  const Icon =
    product.category === 'Liquids'
      ? FlaskConical
      : product.category === 'Essentials'
        ? Package
        : Pill
  return (
    <span
      className={`product-icon product-icon-${product.category.toLowerCase()} ${small ? 'small' : ''}`}
    >
      <Icon size={small ? 19 : 26} strokeWidth={1.7} />
    </span>
  )
}
export function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string
  title: string
  description: string
  children?: ReactNode
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  )
}
