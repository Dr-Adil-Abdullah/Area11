import { notFound } from "next/navigation";
import { getSale } from "@/lib/sales";
import { getPurchase } from "@/lib/purchases";
import { getReturnReceipt } from "@/lib/returns";
import { getProvisionalReceipt } from "@/lib/provisional";
import { getSettings } from "@/lib/settings";
import { currentUser } from "@/lib/session";
import { formatAmount, formatPKR } from "@/lib/money";
import ReceiptActions from "./ReceiptActions";

export const dynamic = "force-dynamic";

export default async function ReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string; auto?: string; code?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const type =
    sp.type === "purchase" ? "purchase" : sp.type === "return" ? "return" : sp.type === "provisional" ? "provisional" : "sale";
  const code = (sp.code ?? "").trim();
  const saleId = Number(id);
  // "return" aur "provisional" me [id] sirf saathi hai -- asal pehchan 'code' ya
  // provisional id hai; is liye wahan id 0 bhi chal jata hai.
  if (!saleId && type !== "return") notFound();

  const settings = await getSettings();
  const user = await currentUser();
  // Cost columns sirf owner ko (setting + role dono)
  const showCost = !!settings["receipt.showCostColumns"] && user?.role === "owner";
  const width = settings["printer.width"] === "80" ? "80mm" : settings["printer.width"] === "58" ? "58mm" : "80mm";

  const header = {
    store: settings["store.name"],
    address: settings["store.address"],
    phone: settings["store.phone"],
    footer: settings["store.footerNote"],
    terms: settings["store.terms"],
    datePosition: settings["receipt.datePosition"],
    showOriginal: settings["receipt.showOriginalPrice"],
    showDiscount: settings["receipt.showDiscount"],
  };

  if (type === "sale") {
    const sale = getSale(saleId);
    if (!sale) notFound();
    const s = sale.header;

    const dateLine = new Date(s.date.replace(" ", "T")).toLocaleString("en-PK");

    return (
      <div className="mx-auto max-w-3xl p-4">
        <ReceiptActions auto={sp.auto === "1"} />
        <div className="mx-auto bg-white p-3 shadow-sm ring-1 ring-slate-200 print:shadow-none print:ring-0" style={{ width }}>
          <div className="text-center font-mono text-[11px] leading-tight">
            <div className="text-[14px] font-bold uppercase">{header.store}</div>
            {header.address && <div>{header.address}</div>}
            {header.phone && <div>Ph: {header.phone}</div>}
            <div className="my-1 border-t border-dashed border-black" />
            {header.datePosition === "top" && <div>{dateLine}</div>}
            <div className="flex justify-between">
              <span>Bill: {s.code}</span>
              <span>{s.payment_method.toUpperCase()}</span>
            </div>
            {s.customer_name && (
              <div className="text-left">
                Customer: {s.customer_name}
                {s.customer_phone ? ` (${s.customer_phone})` : ""}
              </div>
            )}
            <div className="my-1 border-t border-dashed border-black" />
          </div>

          <table className="w-full font-mono text-[11px]">
            <thead>
              <tr className="border-b border-dashed border-black">
                <th className="py-0.5 text-left">Item</th>
                <th className="py-0.5 text-right">Qty</th>
                <th className="py-0.5 text-right">Rate</th>
                <th className="py-0.5 text-right">Amt</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((it) => (
                <tr key={it.id} className="align-top">
                  <td className="py-0.5">
                    {it.name_snapshot || it.name}
                    <div className="text-[9px] text-slate-600">
                      {it.unit_sold !== "base" ? `${it.qty_entered} ${it.unit_sold} = ` : ""}
                      {it.qty_base} {it.batch_no && it.batch_no !== "—" ? `• B:${it.batch_no}` : ""}
                      {it.batch_no && it.batch_no !== "—" && it.expiry_ym ? ` • exp ${it.expiry_ym}` : ""}
                    </div>
                  </td>
                  <td className="py-0.5 text-right">{it.qty_base}</td>
                  <td className="py-0.5 text-right">{formatAmount(it.unit_price_paisa, 2)}</td>
                  <td className="py-0.5 text-right">{formatAmount(it.line_total_paisa, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-1 border-t border-dashed border-black pt-1 font-mono text-[11px]">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatAmount(s.subtotal_paisa, 2)}</span>
            </div>
            {header.showDiscount && s.discount_paisa > 0 && (
              <div className="flex justify-between">
                <span>Discount</span>
                <span>-{formatAmount(s.discount_paisa, 2)}</span>
              </div>
            )}
            {s.tax_paisa > 0 && (
              <div className="flex justify-between">
                <span>{settings["tax.label"]}</span>
                <span>{formatAmount(s.tax_paisa, 2)}</span>
              </div>
            )}
            {s.round_off_paisa !== 0 && (
              <div className="flex justify-between">
                <span>Round off</span>
                <span>{formatAmount(s.round_off_paisa, 2)}</span>
              </div>
            )}
            <div className="mt-0.5 flex justify-between border-t border-black pt-0.5 text-[13px] font-bold">
              <span>TOTAL</span>
              <span>{formatPKR(s.total_paisa)}</span>
            </div>
            {s.due_paisa > 0 && (
              <>
                <div className="flex justify-between">
                  <span>Paid</span>
                  <span>{formatAmount(s.paid_paisa, 2)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Credit (balance)</span>
                  <span>{formatAmount(s.due_paisa, 2)}</span>
                </div>
              </>
            )}
            {(s.change_paisa ?? 0) > 0 && (
              <>
                <div className="flex justify-between">
                  <span>Cash received</span>
                  <span>{formatAmount(s.total_paisa + s.change_paisa, 2)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Change returned</span>
                  <span>{formatAmount(s.change_paisa, 2)}</span>
                </div>
              </>
            )}
          </div>

          <div className="mt-2 border-t border-dashed border-black pt-1 text-center font-mono text-[10px]">
            {header.datePosition === "bottom" && <div>{dateLine}</div>}
            <div>Items: {sale.items.reduce((n, i) => n + 1, 0)} • Served by: {s.user_name ?? "—"}</div>
            {header.footer && <div className="mt-1">{header.footer}</div>}
            {header.terms && <div className="text-[9px]">{header.terms}</div>}
            <div className="mt-1">--- {s.code} ---</div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------- WAPSI ki raseed (U-35) --------------------
  if (type === "return") {
    const ret = code ? getReturnReceipt(code) : null;
    if (!ret) notFound();
    const rDate = new Date((ret.date ?? "").replace(" ", "T")).toLocaleString("en-PK");
    return (
      <div className="mx-auto max-w-3xl p-4">
        <ReceiptActions auto={sp.auto === "1"} />
        <div className="mx-auto bg-white p-3 shadow-sm ring-1 ring-slate-200 print:shadow-none print:ring-0" style={{ width }}>
          <div className="text-center font-mono text-[11px] leading-tight">
            <div className="text-[14px] font-bold uppercase">{header.store}</div>
            {header.address && <div>{header.address}</div>}
            {header.phone && <div>Ph: {header.phone}</div>}
            <div className="my-1 border-t border-dashed border-black" />
            <div className="text-[12px] font-bold">واپسی کی رسید / RETURN RECEIPT</div>
            <div className="flex justify-between">
              <span className="font-bold">Return: {ret.code}</span>
              <span>{rDate}</span>
            </div>
            <div className="text-left">Bill: {ret.saleCode ?? "—"}</div>
            {ret.customerName && (
              <div className="text-left">
                Customer: {ret.customerName}
                {ret.customerPhone ? ` (${ret.customerPhone})` : ""}
              </div>
            )}
            <div className="my-1 border-t border-dashed border-black" />
          </div>

          <table className="w-full font-mono text-[11px]">
            <thead>
              <tr className="border-b border-dashed border-black">
                <th className="py-0.5 text-left">Item</th>
                <th className="py-0.5 text-right">Qty</th>
                <th className="py-0.5 text-right">Refund</th>
              </tr>
            </thead>
            <tbody>
              {ret.items.map((it) => (
                <tr key={it.id} className="align-top">
                  <td className="py-0.5">
                    {it.name}
                    <div className="text-[9px] text-slate-600">
                      {it.qtyBase} {it.baseUnit}
                      {it.batchNo ? ` • B:${it.batchNo}` : ""}
                      {it.restock
                        ? " • stock me wapas"
                        : ` • quarantine${it.qcode ? ` (${it.qcode})` : ""} me`}
                    </div>
                  </td>
                  <td className="py-0.5 text-right">{it.qtyBase}</td>
                  <td className="py-0.5 text-right">{formatAmount(it.refundPaisa, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-1 border-t border-dashed border-black pt-1 font-mono text-[11px]">
            <div className="mt-0.5 flex justify-between border-t border-black pt-0.5 text-[13px] font-bold">
              <span>REFUND TOTAL</span>
              <span>{formatPKR(ret.totalRefundPaisa)}</span>
            </div>
            {ret.reason && <div className="mt-1 text-left">Reason: {ret.reason}</div>}
          </div>

          <div className="mt-3 border-t border-dashed border-black pt-1 font-mono text-[10px]">
            <div className="mt-4 flex justify-between gap-6">
              <span>Received by: ________________</span>
              <span>Signature: ________________</span>
            </div>
            <div className="mt-2 text-center">
              {header.footer && <div>{header.footer}</div>}
              <div className="mt-1">--- {ret.code} ---</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------- BINA-BILL (jaldi) wapsi ki raseed (U-33 + U-35) --------------------
  if (type === "provisional") {
    const pv = saleId ? getProvisionalReceipt(saleId) : null;
    if (!pv) notFound();
    const pDate = new Date((pv.date ?? "").replace(" ", "T")).toLocaleString("en-PK");
    return (
      <div className="mx-auto max-w-3xl p-4">
        <ReceiptActions auto={sp.auto === "1"} />
        <div className="mx-auto bg-white p-3 shadow-sm ring-1 ring-slate-200 print:shadow-none print:ring-0" style={{ width }}>
          <div className="text-center font-mono text-[11px] leading-tight">
            <div className="text-[14px] font-bold uppercase">{header.store}</div>
            {header.address && <div>{header.address}</div>}
            {header.phone && <div>Ph: {header.phone}</div>}
            <div className="my-1 border-t border-dashed border-black" />
            <div className="text-[12px] font-bold">بغیر بل واپسی / RUSH RETURN</div>
            <div className="flex justify-between">
              <span className="font-bold">Return: {pv.code}</span>
              <span>{pDate}</span>
            </div>
            <div className="text-left">
              Bill: {pv.linkedSaleCode ?? "(abhi nahi jura)"}
              {pv.phone ? ` • Phone: ${pv.phone}` : ""}
            </div>
            <div className="my-1 border-t border-dashed border-black" />
          </div>

          <table className="w-full font-mono text-[11px]">
            <thead>
              <tr className="border-b border-dashed border-black">
                <th className="py-0.5 text-left">Item</th>
                <th className="py-0.5 text-right">Qty</th>
              </tr>
            </thead>
            <tbody>
              {pv.items.map((it, idx) => (
                <tr key={idx} className="align-top">
                  <td className="py-0.5">{it.name}</td>
                  <td className="py-0.5 text-right">
                    {it.qtyBase} {it.baseUnit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-1 border-t border-dashed border-black pt-1 font-mono text-[11px]">
            <div className="mt-0.5 flex justify-between border-t border-black pt-0.5 text-[13px] font-bold">
              <span>REFUND TOTAL</span>
              <span>{formatPKR(pv.refundPaisa)}</span>
            </div>
            {pv.reason && <div className="mt-1 text-left">Reason: {pv.reason}</div>}
            {pv.notes && <div className="text-left">Note: {pv.notes}</div>}
            <div className="mt-1 text-left text-[10px]">
              Maal foran stock me shamil ho gaya hai.
              {pv.status === "pending"
                ? " Bill baad me jora ja sakta hai (alert us waqt tak rahe ga)."
                : ""}
            </div>
          </div>

          <div className="mt-3 border-t border-dashed border-black pt-1 font-mono text-[10px]">
            <div className="mt-4 flex justify-between gap-6">
              <span>Received by: ________________</span>
              <span>Signature: ________________</span>
            </div>
            <div className="mt-2 text-center">
              {header.footer && <div>{header.footer}</div>}
              <div className="mt-1">--- {pv.code} ---</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------- purchase receipt --------------------
  const purchase = getPurchase(saleId);
  if (!purchase) notFound();
  const p = purchase.header;
  const dateLine = new Date((p.date ?? "").replace(" ", "T")).toLocaleString("en-PK");

  return (
    <div className="mx-auto max-w-3xl p-4">
      <ReceiptActions auto={sp.auto === "1"} />
      <div className="mx-auto bg-white p-3 shadow-sm ring-1 ring-slate-200 print:shadow-none print:ring-0" style={{ width }}>
        <div className="text-center font-mono text-[11px] leading-tight">
          <div className="text-[14px] font-bold uppercase">{header.store}</div>
          <div className="my-1 border-t border-dashed border-black" />
          <div className="font-bold">PURCHASE / STOCK-IN</div>
          <div className="flex justify-between">
            <span>Bill: {p.code}</span>
            <span>{dateLine}</span>
          </div>
          {p.supplier_name && <div className="text-left">Supplier: {p.supplier_name}</div>}
          {p.supplier_invoice_no && <div className="text-left">Their invoice: {p.supplier_invoice_no}</div>}
          <div className="my-1 border-t border-dashed border-black" />
        </div>

        <table className="w-full font-mono text-[11px]">
          <thead>
            <tr className="border-b border-dashed border-black">
              <th className="py-0.5 text-left">Item</th>
              <th className="py-0.5 text-right">Qty</th>
              {showCost && <th className="py-0.5 text-right">Cost</th>}
              <th className="py-0.5 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {purchase.items.map((it) => (
              <tr key={it.id} className="align-top">
                <td className="py-0.5">
                  {it.name}
                  <div className="text-[9px] text-slate-600">
                    {it.unit !== "base" ? `${it.qty_entered} ${it.unit} = ` : ""}
                    {it.qty_base} {it.base_unit}
                    {it.batch_no ? ` • B:${it.batch_no}` : ""}
                    {it.expiry_date ? ` • exp ${it.expiry_date.slice(0, 7)}` : ""}
                  </div>
                </td>
                <td className="py-0.5 text-right">{it.qty_base}</td>
                {showCost && (
                  <td className="py-0.5 text-right">{formatAmount(it.cost_paisa, 2)}</td>
                )}
                <td className="py-0.5 text-right">{formatAmount(it.line_total_paisa, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-1 border-t border-dashed border-black pt-1 font-mono text-[11px]">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatAmount(p.subtotal_paisa, 2)}</span>
          </div>
          {p.discount_paisa > 0 && (
            <div className="flex justify-between">
              <span>Discount</span>
              <span>-{formatAmount(p.discount_paisa, 2)}</span>
            </div>
          )}
          <div className="mt-0.5 flex justify-between border-t border-black pt-0.5 text-[13px] font-bold">
            <span>TOTAL</span>
            <span>{formatPKR(p.total_paisa)}</span>
          </div>
          <div className="flex justify-between">
            <span>Paid</span>
            <span>{formatAmount(p.paid_paisa, 2)}</span>
          </div>
          {p.due_paisa > 0 && (
            <div className="flex justify-between font-bold">
              <span>Balance (payable)</span>
              <span>{formatAmount(p.due_paisa, 2)}</span>
            </div>
          )}
        </div>

        <div className="mt-2 border-t border-dashed border-black pt-1 text-center font-mono text-[9px]">
          <div>--- {p.code} ---</div>
        </div>
      </div>
    </div>
  );
}
