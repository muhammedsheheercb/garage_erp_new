"use client"

import { ArrowLeft, Printer } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useSyncExternalStore } from "react"
import { useTranslation } from "@/i18n"
import { formatAmount } from "@/lib/amount"

function dateText(value: Date | string, locale: "en" | "ar") {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-OM" : "en-GB").format(new Date(value))
}

function amountText(value: number, locale: "en" | "ar") {
  return formatAmount(value)
}

export interface PurchasePrintData {
  id: string
  purchaseNumber: string
  purchaseDate: Date | string
  purchaseType: string
  jobCardId?: string | null
  subTotal: number
  taxRate: number
  taxAmount: number
  discount: number
  grandTotal: number
  paidAmount: number
  pendingAmount: number
  createdBy?: string | null
  supplier?: {
    name?: string | null
    phone?: string | null
    contact?: string | null
  } | null
  jobCard?: {
    customer?: { name?: string | null; phone?: string | null } | null
    vehicle?: { brand?: string | null; model?: string | null; plateNumber?: string | null } | null
  } | null
  paymentMethod?: {
    name?: string | null
  } | null
  items: Array<{
    id: string
    quantity: number
    purchasePrice: number
    sellingPrice: number
    taxRate?: number | null
    taxAmount?: number | null
    itemTotal: number
    inventory?: {
      itemName?: string | null
      partNumber?: string | null
    } | null
  }>
}

export function PurchasePrintClient({ purchase }: { purchase: PurchasePrintData }) {
  const router = useRouter()
  const { locale, isRTL } = useTranslation()
  const hydrated = useSyncExternalStore(() => () => {}, () => true, () => false)

  useEffect(() => {
    document.documentElement.dir = isRTL ? "rtl" : "ltr"
    document.documentElement.lang = locale
  }, [isRTL, locale])

  if (!hydrated) return null

  const money = (value: number) => `${amountText(value, locale)} ${isRTL ? "ر.ع." : "OMR"}`

  const subTotal = purchase.subTotal
  const totalTax = purchase.taxAmount
  const discountAmount = purchase.discount
  const grandTotal = purchase.grandTotal
  const paidAmount = purchase.paidAmount
  const balanceDue = purchase.pendingAmount

  const l = isRTL ? {
    invoiceTitle: "فاتورة الشراء",
    purchaseNo: "رقم الشراء",
    date: "التاريخ",
    supplier: "المورد",
    supplierName: "اسم المورد",
    contact: "الاتصال / الهاتف",
    paymentMethod: "طريقة الدفع / الدفتر",
    type: "نوع الشراء",
    vehicleDetails: "تفاصيل المركبة (بطاقة العمل)",
    stockPurchase: "شراء للمخزون",
    vehiclePurchase: "شراء لمركبة",
    description: "اسم القطعة / الوصف",
    partNo: "رقم القطعة",
    qty: "الكمية",
    unitPrice: "سعر الوحدة",
    amount: "مبلغ المنتج",
    taxRate: "نسبة الضريبة",
    taxAmount: "مبلغ الضريبة",
    total: "الإجمالي",
    subtotal: "المجموع الفرعي:",
    totalTax: "إجمالي الضريبة:",
    discount: "الخصم:",
    grandTotal: "المجموع الإجمالي:",
    paidAmount: "المبلغ المدفوع:",
    balanceDue: "المبلغ المتبقي:",
    receivedBySignature: "توقيع المستلم / المورد",
    authorizedSignature: "التوقيع المعتمد",
    back: "رجوع",
    print: "طباعة / تنزيل PDF",
  } : {
    invoiceTitle: "PURCHASE INVOICE",
    purchaseNo: "Purchase No",
    date: "Date",
    supplier: "Supplier",
    supplierName: "Supplier Name",
    contact: "Contact / Phone",
    paymentMethod: "Payment Method / Ledger",
    type: "Purchase Type",
    vehicleDetails: "Job Card / Vehicle",
    stockPurchase: "Stock Purchase",
    vehiclePurchase: "Vehicle Purchase",
    description: "Item / Part Description",
    partNo: "Part Number",
    qty: "Qty",
    unitPrice: "Unit Price",
    amount: "Product Amount",
    taxRate: "Tax %",
    taxAmount: "Tax Amount",
    total: "Total",
    subtotal: "Subtotal:",
    totalTax: "Total Tax:",
    discount: "Discount:",
    grandTotal: "Grand Total:",
    paidAmount: "Paid Amount:",
    balanceDue: "Balance Due:",
    receivedBySignature: "Received / Supplier Signature",
    authorizedSignature: "Authorized Signature",
    back: "Back",
    print: "Print / Download PDF",
  }

  const handleBack = () => {
    router.push("/purchases")
  }

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className={`bill-screen min-h-screen p-4 font-sans ${isRTL ? "font-cairo" : ""}`}>
      <style dangerouslySetInnerHTML={{ __html: `
        @page { size:A4 portrait; margin:7mm; }
        * { box-sizing:border-box; }.bill-screen { background:#f6eff0; color:#281315; }.bill-paper { width:196mm; max-width:100%; margin:0 auto; padding:4mm!important; border:.55mm solid #551d25!important; background:#fff1f2!important; box-shadow:0 8px 24px rgba(74,24,32,.12)!important; font-family:Arial,"Noto Sans Arabic",sans-serif; line-height:1.24; overflow-wrap:anywhere; }.bill-header { display:flex; align-items:center; gap:4mm; padding:2.2mm 3mm; background:#8d2634!important; color:#fff!important; border:.35mm solid #551d25; }.bill-logo { width:29mm; height:15mm; object-fit:contain; background:#fff; padding:1.5mm; }.bill-title { flex:1; text-align:center; font-size:20px; line-height:1; font-weight:900; letter-spacing:1px; }.bill-number { min-width:37mm; border-left:.25mm solid #f7cbd0; padding-left:3mm; font-size:9px; }.bill-number strong { display:block; margin:.7mm 0; font-size:11px; }.bill-info { background:#fffafb; }.bill-info td { border-color:#c58d94!important; }.bill-info td:nth-child(odd) { background:#fff1f2!important; color:#762c35!important; }.bill-table-wrap { overflow-x:auto; border:.3mm solid #6d2931!important; border-radius:0!important; background:#fffafb; }.bill-table thead tr { background:#f4c9cf!important; color:#4c1720!important; }.bill-table th,.bill-table td { border-color:#c58d94!important; }.bill-table th { font-size:8px; text-transform:uppercase; }.bill-table td { font-size:8.8px; }.bill-totals { border:.3mm solid #6d2931!important; border-radius:0!important; background:#fffafb; }.bill-totals tr:last-child { background:#f1b8c0!important; color:#281315!important; }.bill-signatures { border-color:#6d2931!important; background:#fffafb; }
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }
          .bill-paper,.bill-paper * { print-color-adjust:exact!important; -webkit-print-color-adjust:exact!important; }
          .print-container {
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          .bill-paper { width:196mm!important; max-width:none!important; box-shadow:none!important; }
          .bill-table-wrap { overflow:visible!important; }
          .bill-table { width:100%!important; table-layout:fixed; font-size:8.8px!important; }
          .bill-table thead { display:table-header-group; }
          .bill-table tr,.bill-totals,.bill-signatures { break-inside:avoid; page-break-inside:avoid; }
          .bill-table th,.bill-table td { padding:6px!important; overflow-wrap:anywhere; }
        }
        @media (max-width:640px) { .bill-screen { padding:12px; }.bill-paper { padding:14px!important; }.bill-header { gap:10px; padding:10px; }.bill-logo { width:86px; height:45px; }.bill-title { font-size:17px; }.bill-number { min-width:92px; padding-left:10px; font-size:8px; }.bill-number strong { font-size:10px; }.bill-table-wrap { overflow-x:auto; }.bill-table { min-width:620px; }.bill-totals { width:100%!important; }.bill-signatures { grid-template-columns:1fr!important; gap:28px!important; } }
      ` }} />

      <style dangerouslySetInnerHTML={{ __html: ".bill-paper { border-radius:0!important; } @media print { .bill-paper { padding:4mm!important; } }" }} />
      <div className="max-w-4xl mx-auto">
        {/* Top Control Bar (Hidden on Print) */}
        <div className="flex justify-between print:hidden mb-6 gap-4">
          <button
            type="button"
            className="border border-gray-300 rounded-md px-4 py-2 flex items-center hover:bg-gray-50 transition-colors text-sm font-medium"
            onClick={handleBack}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {l.back}
          </button>
          <button
            type="button"
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 flex items-center hover:bg-primary/90 transition-colors text-sm font-medium shadow-sm"
            onClick={() => window.print()}
          >
            <Printer className="mr-2 h-4 w-4" />
            {l.print}
          </button>
        </div>

        {/* Printable Invoice Container */}
        <div className="bill-paper print-container border p-6 rounded-lg">
          <header className="bill-header">
            <img src="/images/logo.webp" alt="Bin Matar Garage" width="240" height="96" className="bill-logo" />
            <div className="bill-title">{l.invoiceTitle}</div>
            <div className="bill-number">{l.purchaseNo}<strong>{purchase.purchaseNumber}</strong>{dateText(purchase.purchaseDate, locale)}</div>
          </header>

          {/* Invoice Meta Banner */}
          <div className="mb-6 border border-gray-300 rounded-md overflow-hidden">
            {/* Supplier & Info Grid Table */}
            <table className="bill-info w-full text-xs">
              <tbody>
                <tr className="border-b border-gray-200">
                  <td className="p-2.5 font-bold bg-gray-50 border-r border-gray-200 w-1/4">{l.supplierName}</td>
                  <td className="p-2.5 w-1/4 border-r border-gray-200 font-semibold text-gray-900">{purchase.supplier?.name}</td>
                  <td className="p-2.5 font-bold bg-gray-50 border-r border-gray-200 w-1/4">{l.contact}</td>
                  <td className="p-2.5 w-1/4 font-semibold text-gray-900">{purchase.supplier?.phone || purchase.supplier?.contact}</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="p-2.5 font-bold bg-gray-50 border-r border-gray-200">{l.type}</td>
                  <td className="p-2.5 border-r border-gray-200 font-semibold text-gray-900">
                    {purchase.purchaseType === "VEHICLE" ? l.vehiclePurchase : l.stockPurchase}
                  </td>
                  <td className="p-2.5 font-bold bg-gray-50 border-r border-gray-200">{l.paymentMethod}</td>
                  <td className="p-2.5 font-semibold text-gray-900">{purchase.paymentMethod?.name}</td>
                </tr>
                {purchase.purchaseType === "VEHICLE" && purchase.jobCard && (
                  <tr>
                    <td className="p-2.5 font-bold bg-gray-50 border-r border-gray-200">{l.vehicleDetails}</td>
                    <td colSpan={3} className="p-2.5 text-gray-900 font-semibold">
                      {purchase.jobCard.vehicle?.plateNumber} ({purchase.jobCard.vehicle?.brand} {purchase.jobCard.vehicle?.model}) — {purchase.jobCard.customer?.name}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Product-Wise Itemized Table */}
          <div className="bill-table-wrap mb-6 border border-gray-300 rounded-md">
            <table className="bill-table w-full border-collapse text-xs">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-300 text-gray-800 font-bold">
                  <th className="p-2 border-r border-gray-300 w-8 text-center">#</th>
                  <th className={`p-2 border-r border-gray-300 ${isRTL ? "text-right" : "text-left"}`}>{l.description}</th>
                  <th className="p-2 border-r border-gray-300 w-12 text-center">{l.qty}</th>
                  <th className={`p-2 border-r border-gray-300 w-24 ${isRTL ? "text-left" : "text-right"}`}>{l.unitPrice}</th>
                  <th className="p-2 border-r border-gray-300 w-16 text-center">{l.taxRate}</th>
                  <th className={`p-2 border-r border-gray-300 w-24 ${isRTL ? "text-left" : "text-right"}`}>{l.taxAmount}</th>
                  <th className={`p-2 w-24 ${isRTL ? "text-left" : "text-right"}`}>{l.total}</th>
                </tr>
              </thead>
              <tbody>
                {purchase.items.map((item, idx) => (
                  <tr key={item.id || idx} className="border-b border-gray-200 align-top">
                    <td className="p-2 border-r border-gray-200 text-center font-medium text-gray-600">{idx + 1}</td>
                    <td className="p-2 border-r border-gray-200">
                      {item.inventory?.itemName && <span className="font-semibold text-gray-900 block">{item.inventory.itemName}</span>}
                      {item.inventory?.partNumber && (
                        <span className="text-[11px] text-gray-500 font-mono block">
                          {l.partNo}: {item.inventory.partNumber}
                        </span>
                      )}
                    </td>
                    <td className="p-2 border-r border-gray-200 text-center font-medium">{item.quantity}</td>
                    <td className={`p-2 border-r border-gray-200 font-medium ${isRTL ? "text-left" : "text-right"}`}>{money(item.purchasePrice)}</td>
                    <td className="p-2 border-r border-gray-200 text-center font-medium">{item.taxRate ?? 0}%</td>
                    <td className={`p-2 border-r border-gray-200 font-medium text-gray-800 ${isRTL ? "text-left" : "text-right"}`}>{item.taxAmount != null ? `+${money(item.taxAmount)}` : ""}</td>
                    <td className={`p-2 font-semibold text-gray-900 ${isRTL ? "text-left" : "text-right"}`}>{money(item.itemTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Summary */}
          <div className="flex justify-end mb-8">
            <div className="bill-totals w-80 border border-gray-300 rounded-md overflow-hidden text-xs">
              <table className="w-full">
                <tbody>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <td className="p-2 text-gray-700 font-medium">{l.subtotal}</td>
                    <td className="p-2 text-right font-semibold text-gray-900">{money(subTotal)}</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="p-2 text-gray-700 font-medium">{l.totalTax}</td>
                    <td className="p-2 text-right font-semibold text-gray-900">+{money(totalTax)}</td>
                  </tr>
                  {discountAmount > 0 && (
                    <tr className="border-b border-gray-200 text-red-600">
                      <td className="p-2 font-medium">{l.discount}</td>
                      <td className="p-2 text-right font-semibold">-{money(discountAmount)}</td>
                    </tr>
                  )}
                  <tr className="border-b border-gray-300 bg-gray-100 font-bold text-sm">
                    <td className="p-2 text-gray-900">{l.grandTotal}</td>
                    <td className="p-2 text-right text-gray-900">{money(grandTotal)}</td>
                  </tr>
                  <tr className="border-b border-gray-200 text-green-700 font-medium">
                    <td className="p-2">{l.paidAmount}</td>
                    <td className="p-2 text-right font-semibold">-{money(paidAmount)}</td>
                  </tr>
                  <tr className={balanceDue > 0 ? "bg-red-50 text-red-700 font-bold" : "bg-gray-50 text-gray-700 font-bold"}>
                    <td className="p-2">{l.balanceDue}</td>
                    <td className="p-2 text-right">{money(balanceDue)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Signatures */}
          <div className="bill-signatures grid grid-cols-2 gap-8 mt-12 pt-6 border-t border-gray-300">
            <div className="text-center">
              <div className="border-b border-gray-400 w-48 mx-auto mb-2" />
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">{l.receivedBySignature}</p>
            </div>
            <div className="text-center">
              <div className="border-b border-gray-400 w-48 mx-auto mb-2" />
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">{l.authorizedSignature}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
