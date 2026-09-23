"use client"

import { ArrowLeft, Printer } from "lucide-react"
import { useRouter } from "next/navigation"

const money = (value: number) => `${Number(value || 0).toFixed(3)} OMR`
const date = (value: string | Date) => new Date(value).toLocaleDateString()

export function QuotationPrintClient({ quotation, settings }: { quotation: any; settings: any }) {
  const router = useRouter()
  const rows = [
    ...(quotation.services || []).map((item: any) => ({ type: "Service", name: item.service?.name, quantity: item.quantity, price: item.price })),
    ...(quotation.parts || []).map((item: any) => ({ type: "Part", name: `${item.inventory?.itemName || ""}${item.inventory?.partNumber ? ` (${item.inventory.partNumber})` : ""}`, quantity: item.quantity, price: item.price })),
  ]
  const subtotal = Number(quotation.serviceTotal || 0) + Number(quotation.partsTotal || 0)

  return <main className="qp-screen">
    <style dangerouslySetInnerHTML={{ __html: `
      @page { size:A4 portrait; margin:7mm; }
      * { box-sizing:border-box; }
      .qp-screen { min-height:100vh; padding:128px 0 24px; background:#f6eff0; color:#281315; font-family:Arial,"Noto Sans Arabic",sans-serif; }
      .qp-paper { width:196mm; min-height:283mm; margin:0 auto; padding:4mm; border:.55mm solid #551d25; background:#fff1f2; font-size:9.4px; line-height:1.24; overflow-wrap:anywhere; }
      .qp-paper, .qp-paper *, .qp-paper *::before, .qp-paper *::after { print-color-adjust:exact; -webkit-print-color-adjust:exact; }
      .qp-header { display:flex; align-items:center; gap:4mm; padding:2.2mm 3mm; background:#8d2634; color:#fff; border:.35mm solid #551d25; }
      .qp-logo { width:29mm; height:15mm; object-fit:contain; background:#fff; padding:1.5mm; }
      .qp-title { flex:1; text-align:center; font-size:20px; line-height:1; font-weight:900; letter-spacing:1px; }.qp-title small { display:block; margin-top:.7mm; font-size:9px; letter-spacing:.5px; }
      .qp-number { min-width:37mm; border-left:.25mm solid #f7cbd0; padding-left:3mm; font-size:9px; }.qp-number strong { display:block; margin-top:.7mm; font-size:11px; }
      .qp-section { margin-top:1.6mm; border:.3mm solid #6d2931; background:#fffafb; break-inside:avoid; page-break-inside:avoid; }.qp-section-title { padding:1mm 2mm; color:#fff; background:#9d3543; font-size:9px; font-weight:800; letter-spacing:.35px; text-transform:uppercase; }
      .qp-grid { display:grid; grid-template-columns:repeat(4,1fr); }.qp-vehicle-grid { display:grid; grid-template-columns:repeat(3,1fr); }.qp-field { min-height:9.5mm; padding:1mm 2mm; border-right:.2mm solid #c58d94; border-top:.2mm solid #c58d94; }.qp-grid .qp-field:nth-child(4n),.qp-vehicle-grid .qp-field:nth-child(3n) { border-right:0; }.qp-field span { display:block; margin-bottom:.5mm; color:#762c35; font-size:7.5px; font-weight:800; text-transform:uppercase; }.qp-field strong { display:block; font-size:9.8px; }
      .qp-text { padding:1.1mm 2mm; min-height:9.5mm; white-space:pre-wrap; border-top:.2mm solid #c58d94; }.qp-text b { color:#762c35; font-size:8px; text-transform:uppercase; }
      .qp-items { width:100%; border-collapse:collapse; table-layout:fixed; }.qp-items th { padding:1.1mm; background:#f4c9cf; color:#4c1720; border:.2mm solid #8e4751; font-size:8px; text-transform:uppercase; }.qp-items td { padding:1mm 1.3mm; border:.2mm solid #c58d94; vertical-align:top; font-size:8.8px; }.qp-items tr { break-inside:avoid; page-break-inside:avoid; }.qp-items .number { width:7mm; text-align:center; }.qp-items .type { width:25mm; }.qp-items .qty { width:12mm; text-align:center; }.qp-items .money { width:23mm; text-align:right; white-space:nowrap; }
      .qp-totals { display:grid; grid-template-columns:1fr 51mm; border-top:.25mm solid #6d2931; }.qp-note { padding:1.5mm 2mm; color:#6a3037; font-size:8px; }.qp-total-values { border-left:.25mm solid #6d2931; }.qp-total { display:flex; justify-content:space-between; padding:1.1mm 2mm; border-bottom:.2mm solid #c58d94; font-size:8.7px; }.qp-total:last-child { border-bottom:0; background:#f1b8c0; font-weight:900; font-size:10px; }
      .qp-footer { display:grid; grid-template-columns:1fr 1fr; gap:4mm; padding:2.4mm 2mm 1.8mm; font-size:8.5px; }.qp-signature { padding-top:6mm; text-align:center; border-top:.25mm solid #59212a; font-weight:800; }
      @media screen and (max-width:768px) { .qp-screen { display:flex; flex-direction:column; align-items:center; overflow-x:hidden; } .qp-paper { margin:0; } } @media screen and (max-width:768px) and (min-width:601px) { .qp-paper { zoom:.85; } } @media screen and (max-width:600px) and (min-width:421px) { .qp-paper { zoom:.6; } } @media screen and (max-width:420px) { .qp-paper { zoom:.45; } }
      @media print { html,body { width:210mm; min-height:297mm; margin:0!important; padding:0!important; background:#fff!important; } .print-preview-actions { display:none!important; } .qp-screen { width:196mm!important; margin:0 auto!important; padding:0!important; background:#fff!important; } .qp-paper { margin:0!important; } }
    ` }} />
    <div className="print-preview-actions fixed top-4 left-4 right-4 z-50 flex flex-col gap-2 sm:left-8 sm:right-8 sm:flex-row sm:justify-between"><button type="button" className="rounded-md border border-[#6d2931] bg-white px-4 py-2 text-sm font-semibold text-[#281315] shadow-lg" onClick={() => router.back()}><ArrowLeft className="mr-2 inline h-4 w-4" />Back</button><button type="button" className="rounded-md bg-[#8d2634] px-4 py-2 text-sm font-semibold text-white shadow-lg" onClick={() => window.print()}><Printer className="mr-2 inline h-4 w-4" />Print</button></div>
    <article className="qp-paper"><header className="qp-header"><img src="/images/logo.webp" alt="Workshop logo" className="qp-logo" /><div className="qp-title">QUOTATION<small>WORKSHOP SERVICE ESTIMATE</small></div><div className="qp-number">QUOTATION NO.<strong>{quotation.id.slice(-8).toUpperCase()}</strong></div></header>
      <section className="qp-section"><div className="qp-section-title">Customer & Quotation Details</div><div className="qp-grid"><div className="qp-field"><span>Customer</span><strong>{quotation.customer?.name || "—"}</strong></div><div className="qp-field"><span>Phone</span><strong>{quotation.customer?.phone || "—"}</strong></div><div className="qp-field"><span>Quotation date</span><strong>{date(quotation.date)}</strong></div><div className="qp-field"><span>Valid until</span><strong>{date(quotation.validUntil)}</strong></div></div></section>
      <section className="qp-section"><div className="qp-section-title">Vehicle Details</div><div className="qp-vehicle-grid"><div className="qp-field"><span>Vehicle</span><strong>{quotation.vehicle?.brand} {quotation.vehicle?.model}</strong></div><div className="qp-field"><span>Plate no.</span><strong>{quotation.vehicle?.plateNumber || "—"}</strong></div><div className="qp-field"><span>Vehicle KM</span><strong>{quotation.vehicleKm || "—"}</strong></div></div><div className="qp-text"><b>Complaint / Issue:</b><br />{quotation.complaint || "—"}</div>{quotation.notes && <div className="qp-text"><b>Notes:</b><br />{quotation.notes}</div>}</section>
      <section className="qp-section"><div className="qp-section-title">Service & Parts Details</div><table className="qp-items"><thead><tr><th className="number">#</th><th className="type">Type</th><th>Description</th><th className="qty">Qty</th><th className="money">Rate</th><th className="money">Amount</th></tr></thead><tbody>{rows.length ? rows.map((row: any, index: number) => <tr key={`${row.type}-${index}`}><td className="number">{index + 1}</td><td className="type">{row.type}</td><td>{row.name}</td><td className="qty">{row.quantity}</td><td className="money">{money(row.price)}</td><td className="money">{money(row.quantity * row.price)}</td></tr>) : <tr><td colSpan={6} style={{ textAlign:"center" }}>No services or parts listed</td></tr>}</tbody></table><div className="qp-totals"><div className="qp-note">Services total: {money(quotation.serviceTotal)} · Parts total: {money(quotation.partsTotal)} · Discount: Not applied</div><div className="qp-total-values"><div className="qp-total"><span>Subtotal</span><span>{money(subtotal)}</span></div><div className="qp-total"><span>Grand total</span><span>{money(quotation.grandTotal)}</span></div></div></div></section>
      <footer className="qp-section"><div className="qp-footer"><div><strong>{settings.garageName}</strong><br />{settings.address}<br />{settings.phone}{settings.email ? ` · ${settings.email}` : ""}</div><div className="qp-signature">Authorized Signature</div></div></footer>
    </article>
  </main>
}
