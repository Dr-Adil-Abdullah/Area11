import { createPortal } from 'react-dom'
import type { Sale, Settings } from '../domain/model'
import { formatDate, formatMoney, unitLabel } from '../domain/model'

export function Receipt({
  sale,
  settings,
  width,
}: {
  sale: Sale
  settings: Settings
  width: 58 | 80
}) {
  return (
    <article className={`receipt-paper paper-${width}`} aria-label="Receipt preview">
      <div className="receipt-demo">DEMO · NOT A TAX INVOICE</div>
      <header>
        <div className="receipt-cross">✚</div>
        <h3>{settings.name}</h3>
        {settings.address && <p>{settings.address}</p>}
        {settings.phone && <p>{settings.phone}</p>}
      </header>
      <div className="receipt-rule" />
      <div className="receipt-pair">
        <strong>{sale.number}</strong>
        <span>CASH</span>
      </div>
      <p className="receipt-date">{formatDate(sale.createdAt, true)} · PKT</p>
      {sale.customerPhone && <p className="receipt-date">Phone: {sale.customerPhone}</p>}
      <div className="receipt-rule" />
      {sale.lines.map((line, index) => (
        <div className="receipt-item" key={index}>
          <strong>{line.productName}</strong>
          <div className="receipt-pair">
            <span>
              {line.quantity} {unitLabel(line, line.unit, line.quantity !== 1)} ×{' '}
              {formatMoney(line.pricePerPack)}
            </span>
            <span>{formatMoney(line.total)}</span>
          </div>
          <small>
            {line.discount > 0 && <>Discount − {formatMoney(line.discount)} · </>}
            Batch {line.batchNumber} · Exp {line.expiresOn}
          </small>
        </div>
      ))}
      <div className="receipt-rule" />
      {sale.discount > 0 && (
        <>
          <div className="receipt-pair">
            <span>Retail total</span>
            <span>{formatMoney(sale.grossSubtotal)}</span>
          </div>
          <div className="receipt-pair">
            <span>
              Discount ({sale.discountBps / 100}% {sale.discountMode})
            </span>
            <span>− {formatMoney(sale.discount)}</span>
          </div>
        </>
      )}
      <div className="receipt-pair">
        <span>Subtotal</span>
        <span>{formatMoney(sale.subtotal)}</span>
      </div>
      <div className="receipt-pair">
        <span>Round-down</span>
        <span>− {formatMoney(sale.rounding)}</span>
      </div>
      {sale.roundingSkipped && (
        <p className="receipt-note">Rounding skipped to protect purchase cost.</p>
      )}
      <div className="receipt-pair receipt-total">
        <strong>TOTAL (PKR)</strong>
        <strong>{formatMoney(sale.total)}</strong>
      </div>
      <div className="receipt-pair">
        <span>Cash received</span>
        <span>{formatMoney(sale.tendered)}</span>
      </div>
      <div className="receipt-pair">
        <span>Change</span>
        <span>{formatMoney(sale.change)}</span>
      </div>
      <div className="receipt-rule" />
      <p className="receipt-footer">{settings.footer}</p>
      <p className="receipt-note">
        Sample data only · Operator: {sale.role}
        <br />
        Powered by Area11
      </p>
    </article>
  )
}
export function PrintReceipt({
  sale,
  settings,
  width,
}: {
  sale: Sale
  settings: Settings
  width: 58 | 80
}) {
  return createPortal(
    <div id="receipt-print">
      <style>{`@media print { @page { size: auto; margin: 0; } body { margin: 0 !important; background: white !important; } body > *:not(#receipt-print) { display: none !important; } #receipt-print { display: block !important; width: ${width}mm; } #receipt-print .receipt-paper { box-shadow: none; border: 0; width: ${width}mm; padding: 3mm; } }`}</style>
      <Receipt sale={sale} settings={settings} width={width} />
    </div>,
    document.body,
  )
}
