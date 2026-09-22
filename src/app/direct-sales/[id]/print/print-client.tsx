"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Printer } from "lucide-react"
import { formatDisplayDate } from "@/lib/date-format"

const amount = (value: number) => Number(value || 0).toFixed(3).replace(/\.?0+$/, "")

export function DirectSalePrint({ sale }: { sale: any }) {
  const customerDetails = [
    { label: "Customer Name", value: sale.customerName },
    { label: "Mobile Number", value: sale.customerMobile },
    { label: "Vehicle Number", value: sale.vehicleNumber },
  ].filter((detail) => detail.value !== null && detail.value !== undefined && String(detail.value).trim() !== "")

  return (
    <main id="direct-sale-bill-page">
      <style dangerouslySetInnerHTML={{ __html: `
        @page { size: A4 portrait; margin: 10mm; }
        #direct-sale-bill-page, #direct-sale-bill-page * { box-sizing: border-box; }
        #direct-sale-bill-page { min-height:100vh; padding:24px; background:#f5eff0; color:#2b1719; font-family:Arial, "Noto Sans Arabic", sans-serif; }
        #direct-sale-bill { width:min(190mm, 100%); margin:0 auto; overflow:hidden; border:1px solid #6d2b35; background:#fffdfd; box-shadow:0 8px 24px rgba(74, 24, 32, .12); }
        #direct-sale-bill * { print-color-adjust:exact; -webkit-print-color-adjust:exact; }
        .ds-actions { display:flex; width:min(190mm, 100%); margin:0 auto 16px; justify-content:space-between; gap:12px; }
        .ds-header { display:flex; align-items:center; gap:18px; padding:18px 22px; background:#8d2634; color:#fff; border-bottom:4px solid #551d25; }
        .ds-logo { width:110px; height:54px; padding:6px; object-fit:contain; background:#fff; }
        .ds-heading { flex:1; min-width:0; }
        .ds-heading h1 { margin:0; font-size:25px; line-height:1.05; letter-spacing:.7px; }
        .ds-heading p { margin:5px 0 0; font-size:12px; font-weight:700; letter-spacing:1.2px; }
        .ds-reference { min-width:155px; padding-left:18px; border-left:1px solid rgba(255,255,255,.55); font-size:13px; line-height:1.55; text-align:right; }
        .ds-reference strong { display:block; font-size:15px; letter-spacing:.35px; }
        .ds-content { padding:18px 22px 22px; }
        .ds-customer { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); margin-bottom:18px; border:1px solid #c48d95; background:#fff7f8; }
        .ds-customer div { min-height:58px; padding:10px 12px; border-right:1px solid #d7abb1; }
        .ds-customer div:last-child { border-right:0; }
        .ds-label { display:block; margin-bottom:5px; color:#772d38; font-size:11px; font-weight:800; letter-spacing:.45px; text-transform:uppercase; }
        .ds-value { display:block; color:#251316; font-size:15px; font-weight:700; overflow-wrap:anywhere; }
        .ds-table-wrap { width:100%; overflow:visible; border:1px solid #74313b; }
        .ds-table { width:100%; min-width:0; table-layout:fixed; border-collapse:collapse; font-size:14px; }
        .ds-table th { padding:10px 9px; border-right:1px solid #9d5963; background:#efc9ce; color:#4e1921; font-size:12px; font-weight:800; letter-spacing:.25px; text-align:left; }
        .ds-table th:last-child, .ds-table td:last-child { border-right:0; }
        .ds-table td { padding:10px 9px; border-top:1px solid #e0b8bd; border-right:1px solid #e0b8bd; vertical-align:top; }
        .ds-table .ds-center { text-align:center; }.ds-table .ds-money { text-align:right; white-space:nowrap; }
        .ds-table th:nth-child(1) { width:39%; }.ds-table th:nth-child(2) { width:8%; }.ds-table th:nth-child(3) { width:14%; }.ds-table th:nth-child(4) { width:8%; }.ds-table th:nth-child(5) { width:14%; }.ds-table th:nth-child(6) { width:17%; }
        .ds-item-name { display:block; font-weight:800; }.ds-item-meta { display:block; margin-top:3px; color:#774d53; font-size:12px; }
        .ds-summary { width:100%; max-width:350px; margin:18px 0 0 auto; border:1px solid #74313b; background:#fffafa; font-size:14px; }
        .ds-summary div { display:flex; justify-content:space-between; gap:20px; padding:9px 12px; border-bottom:1px solid #dfb3b9; }
        .ds-summary div:last-child { border-bottom:0; background:#8d2634; color:#fff; font-size:17px; font-weight:900; }
        .ds-summary .ds-discount { color:#a52436; font-weight:700; }
        @media (max-width:640px) { #direct-sale-bill-page { padding:12px; } .ds-header { align-items:flex-start; padding:14px; } .ds-logo { width:80px; height:44px; } .ds-heading h1 { font-size:19px; } .ds-reference { min-width:auto; padding-left:10px; font-size:11px; } .ds-reference strong { font-size:12px; } .ds-content { padding:14px; } .ds-customer { grid-template-columns:1fr; } .ds-customer div { border-right:0; border-bottom:1px solid #d7abb1; } .ds-customer div:last-child { border-bottom:0; } .ds-table-wrap { overflow-x:auto; } .ds-table { min-width:760px; table-layout:auto; } }
        @media print {
          html, body { width:210mm; margin:0 !important; padding:0 !important; background:#fff !important; }
          #direct-sale-bill-page { min-height:0; padding:0; background:#fff; }
          .ds-actions { display:none !important; }
          #direct-sale-bill { width:100%; max-width:none; margin:0; border:1px solid #6d2b35; box-shadow:none; }
          .ds-content { padding:14px 16px 16px; }
          .ds-header { padding:14px 16px; }
          .ds-table-wrap { overflow:visible; }
          .ds-table { min-width:0; table-layout:fixed; font-size:11px; }
          .ds-table thead { display:table-header-group; }
          .ds-table tr, .ds-customer, .ds-summary { break-inside:avoid; page-break-inside:avoid; }
          .ds-table th { padding:7px 5px; font-size:10px; }
          .ds-table td { padding:7px 5px; overflow-wrap:anywhere; }
          .ds-table th:nth-child(1) { width:39%; }.ds-table th:nth-child(2) { width:8%; }.ds-table th:nth-child(3) { width:14%; }.ds-table th:nth-child(4) { width:8%; }.ds-table th:nth-child(5) { width:14%; }.ds-table th:nth-child(6) { width:17%; }
          .ds-item-meta { font-size:10px; }
          .ds-summary { margin-top:14px; font-size:12px; }
          .ds-summary div { padding:7px 10px; }
          .ds-summary div:last-child { font-size:15px; }
        }
      ` }} />

      <div className="ds-actions">
        <Link href="/direct-sales"><Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to Direct Sales</Button></Link>
        <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print Bill</Button>
      </div>

      <article id="direct-sale-bill">
        <header className="ds-header">
          <img src="/images/logo.webp" alt="Logo" className="ds-logo" />
          <div className="ds-heading"><h1>DIRECT SALE INVOICE</h1></div>
          <div className="ds-reference"><strong>Invoice: DS-{sale.id.split("-")[0].toUpperCase()}</strong><span>Sale Date: {formatDisplayDate(sale.saleDate || sale.createdAt)}</span></div>
        </header>

        <div className="ds-content">
          {customerDetails.length > 0 && <section className="ds-customer" style={{ gridTemplateColumns: `repeat(${customerDetails.length}, minmax(0, 1fr))` }}>
            {customerDetails.map((detail) => <div key={detail.label}><span className="ds-label">{detail.label}</span><span className="ds-value">{detail.value}</span></div>)}
          </section>}

          <div className="ds-table-wrap">
            <table className="ds-table">
              <thead><tr><th>Product / Batch</th><th className="ds-center">Qty</th><th className="ds-money">Sales Price</th><th className="ds-money">VAT %</th><th className="ds-money">VAT Amount</th><th className="ds-money">Line Total</th></tr></thead>
              <tbody>{sale.items.map((item: any) => {
                const tax = item.quantity * item.salesPrice * item.vat / 100
                const itemMeta = [item.batch?.inventory?.partNumber && `Part: ${item.batch.inventory.partNumber}`, item.batch?.batchNumber && `Batch: ${item.batch.batchNumber}`].filter(Boolean).join(" · ")
                return <tr key={item.id}>
                  <td><span className="ds-item-name">{item.batch.inventory.itemName}</span>{itemMeta && <span className="ds-item-meta">{itemMeta}</span>}</td>
                  <td className="ds-center">{item.quantity}</td><td className="ds-money">{amount(item.salesPrice)}</td><td className="ds-money">{item.vat}%</td><td className="ds-money">{amount(tax)}</td><td className="ds-money"><strong>{amount(item.totalAmount)}</strong></td>
                </tr>
              })}</tbody>
            </table>
          </div>

          <section className="ds-summary">
            <div><span>Subtotal</span><strong>{amount(sale.subTotal)}</strong></div>
            <div className="ds-discount"><span>Discount</span><strong>-{amount(sale.discount)}</strong></div>
            <div><span>Total VAT / Tax</span><strong>{amount(sale.tax)}</strong></div>
            <div><span>Grand Total</span><strong>{amount(sale.grandTotal)} OMR</strong></div>
          </section>
        </div>
      </article>
    </main>
  )
}
