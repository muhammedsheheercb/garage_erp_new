"use client"

import { ArrowLeft, Printer } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useSyncExternalStore } from "react"
import { useTranslation } from "@/i18n"

function dateText(value: Date | string, locale: "en" | "ar") {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-OM" : "en-GB").format(new Date(value))
}

import { formatAmount } from "@/lib/amount"

function amountText(value: number, locale: "en" | "ar") {
  return formatAmount(value)
}

interface InvoicePrintData {
  id: string
  createdAt: Date | string
  payments: Array<{ amount: number }>
  grandTotal: number
  serviceCharge: number
  labourCharge: number
  partsCost: number
  subTotal: number
  discount: number
  tax: number
  servicesDetails?: string | null
  partsDetails?: string | null
  customer?: { name?: string | null; phone?: string | null } | null
  jobCard?: {
    tax?: number | null
    discount?: number | null
    complaint?: string | null
    workDone?: string | null
    vehicle?: { brand?: string | null; model?: string | null; plateNumber?: string | null } | null
  } | null
}

export function InvoicePrintClient({ invoice, otherChargesList }: { invoice: InvoicePrintData; otherChargesList: Array<{ name: string; amount: number }> }) {
  const router = useRouter()
  const { locale, isRTL } = useTranslation()
  const hydrated = useSyncExternalStore(() => () => {}, () => true, () => false)

  useEffect(() => {
    document.documentElement.dir = isRTL ? "rtl" : "ltr"
    document.documentElement.lang = locale
  }, [isRTL, locale])

  if (!hydrated) return null

  const paidAmount = invoice.payments.reduce((total: number, payment) => total + payment.amount, 0)
  const balance = Math.max(0, invoice.grandTotal - paidAmount)
  const money = (value: number) => `${amountText(value, locale)} ${isRTL ? "ر.ع." : "OMR"}`
  const l = isRTL ? {
    invoice: "فاتورة", customer: "اسم العميل", vehicle: "المركبة", phone: "الهاتف / الاتصال", plate: "رقم اللوحة",
    complaint: "الشكوى / المشكلة", description: "الوصف / التفاصيل", service: "رسوم الخدمة والعمل",
    parts: "القطع والمواد", other: "رسوم أخرى", subtotal: "المجموع الفرعي:", discount: "الخصم:",
    tax: "الضريبة (VAT):", grandTotal: "المجموع الإجمالي:", paid: "المبلغ المدفوع:", balance: "المبلغ المتبقي:", customerSignature: "توقيع العميل",
    authorizedSignature: "التوقيع المعتمد", back: "رجوع", print: "طباعة / تنزيل PDF", amount: "المبلغ (ر.ع.)",
  } : {
    invoice: "INVOICE", customer: "Customer Name", vehicle: "Vehicle", phone: "Phone / Contact", plate: "Plate Number",
    complaint: "Complaint / Issue", description: "Description / Details", service: "Service & Labour Charges",
    parts: "Parts & Materials", other: "Other Charge", subtotal: "Subtotal:", discount: "Discount:",
    tax: "Tax (VAT):", grandTotal: "Grand Total:", paid: "Paid Amount:", balance: "Balance Due:", customerSignature: "Customer Signature",
    authorizedSignature: "Authorized Signature", back: "Back", print: "Print / Download PDF", amount: "Amount (OMR)",
  }

  const handleBack = () => {
    router.push("/invoices")
  }

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className={`bill-screen min-h-screen p-4 font-sans ${isRTL ? "font-cairo" : ""}`}>
      <style dangerouslySetInnerHTML={{ __html: `
        @page { size:A4 portrait; margin:7mm; }
        * { box-sizing:border-box; }.bill-screen { background:#f6eff0; color:#281315; }.bill-paper { width:196mm; max-width:100%; margin:0 auto; padding:4mm!important; border:.55mm solid #551d25!important; background:#fff1f2!important; box-shadow:0 8px 24px rgba(74,24,32,.12)!important; font-family:Arial,"Noto Sans Arabic",sans-serif; line-height:1.24; overflow-wrap:anywhere; }.bill-header { display:flex; align-items:center; gap:4mm; padding:2.2mm 3mm; background:#8d2634!important; color:#fff!important; border:.35mm solid #551d25; }.bill-logo { width:29mm; height:15mm; object-fit:contain; background:#fff; padding:1.5mm; }.bill-title { flex:1; text-align:center; font-size:20px; line-height:1; font-weight:900; letter-spacing:1px; }.bill-number { min-width:37mm; border-left:.25mm solid #f7cbd0; padding-left:3mm; font-size:9px; }.bill-number strong { display:block; margin:.7mm 0; font-size:11px; }.bill-info { background:#fffafb; }.bill-info td { border-color:#c58d94!important; }.bill-info td:nth-child(odd) { background:#fff1f2!important; color:#762c35!important; }.bill-table-wrap { overflow-x:auto; border:.3mm solid #6d2931!important; border-radius:0!important; background:#fffafb; }.bill-table thead tr { background:#f4c9cf!important; color:#4c1720!important; }.bill-table th,.bill-table td { border-color:#c58d94!important; }.bill-table th { font-size:8px; text-transform:uppercase; }.bill-table td { font-size:8.8px; }.bill-totals { border:.3mm solid #6d2931!important; border-radius:0!important; background:#fffafb; }.bill-totals tr:last-child { background:#f1b8c0!important; color:#281315!important; }.bill-signatures { border-color:#6d2931!important; background:#fffafb; }
        @media print { html,body { margin:0!important; padding:0!important; background:#fff!important; } .bill-paper,.bill-paper * { print-color-adjust:exact!important; -webkit-print-color-adjust:exact!important; } .print-container { padding:0!important; margin:0!important; width:100%!important; max-width:100%!important; box-shadow:none!important; } .bill-paper { width:196mm!important; max-width:none!important; box-shadow:none!important; } .bill-table-wrap { overflow:visible!important; } .bill-table { width:100%!important; table-layout:fixed; font-size:8.8px!important; } .bill-table thead { display:table-header-group; } .bill-table tr,.bill-totals,.bill-signatures { break-inside:avoid; page-break-inside:avoid; } .bill-table th,.bill-table td { padding:6px!important; overflow-wrap:anywhere; } }
        @media (max-width:640px) { .bill-screen { padding:12px; }.bill-paper { padding:14px!important; }.bill-header { gap:10px; padding:10px; }.bill-logo { width:86px; height:45px; }.bill-title { font-size:17px; }.bill-number { min-width:92px; padding-left:10px; font-size:8px; }.bill-number strong { font-size:10px; }.bill-table-wrap { overflow-x:auto; }.bill-table { min-width:620px; }.bill-totals { width:100%!important; }.bill-signatures { grid-template-columns:1fr!important; gap:28px!important; } }
      ` }} />
      <style dangerouslySetInnerHTML={{ __html: ".bill-paper { border-radius:0!important; } @media print { .bill-paper { padding:4mm!important; } }" }} />
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between print:hidden mb-8 gap-4">
          <button type="button" className="border rounded-md px-4 py-2 flex items-center" onClick={handleBack}><ArrowLeft className="mr-2 h-4 w-4" />{l.back}</button>
          <button type="button" className="bg-primary text-primary-foreground rounded-md px-4 py-2 flex items-center" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />{l.print}</button>
        </div>
        <div className="bill-paper print-container border p-6 rounded-lg">
          <header className="bill-header">
            <img src="/images/logo.webp" alt="Bin Matar Garage" width="240" height="96" className="bill-logo" />
            <div className="bill-title">{l.invoice}</div>
            <div className="bill-number">INV. NO.<strong>{invoice.id.split("-")[0].toUpperCase()}</strong>{dateText(invoice.createdAt, locale)}</div>
          </header>
          <div className="mb-6 border border-gray-300 rounded-md overflow-hidden">
            <table className="bill-info w-full text-xs"><tbody>
              <tr className="border-b border-gray-200"><td className="p-2.5 font-bold bg-gray-50 border-r border-gray-200 w-1/4">{l.customer}</td><td className="p-2.5 w-1/4 border-r border-gray-200 font-semibold text-gray-900">{invoice.customer?.name}</td><td className="p-2.5 font-bold bg-gray-50 border-r border-gray-200 w-1/4">{l.vehicle}</td><td className="p-2.5 w-1/4 font-semibold text-gray-900">{invoice.jobCard?.vehicle?.brand} {invoice.jobCard?.vehicle?.model}</td></tr>
              {(invoice.customer?.phone || invoice.jobCard?.vehicle?.plateNumber) && <tr className="border-b border-gray-200"><td className="p-2.5 font-bold border-r border-gray-200">{l.phone}</td><td className="p-2.5 border-r border-gray-200">{invoice.customer?.phone}</td><td className="p-2.5 font-bold border-r border-gray-200">{l.plate}</td><td className="p-2.5 font-mono font-semibold text-gray-900">{invoice.jobCard?.vehicle?.plateNumber}</td></tr>}
              {invoice.jobCard?.complaint && <tr><td className="p-2.5 font-bold bg-gray-50 border-r border-gray-200">{l.complaint}</td><td colSpan={3} className="p-2.5 text-gray-800 font-medium whitespace-pre-wrap">{invoice.jobCard.complaint}</td></tr>}
            </tbody></table>
          </div>
          <div className="bill-table-wrap mb-6"><table className="bill-table w-full border-collapse border text-xs"><thead><tr><th className="p-2.5 border-r w-12 text-center">#</th><th className={`p-2.5 border-r ${isRTL ? "text-right" : "text-left"}`}>{l.description}</th><th className={`p-2.5 w-36 ${isRTL ? "text-left" : "text-right"}`}>{l.amount}</th></tr></thead><tbody>
            {(invoice.serviceCharge + invoice.labourCharge > 0 || invoice.servicesDetails || invoice.jobCard?.workDone) && <tr className="border-b align-top"><td className="p-2.5 border-r text-center font-medium">1</td><td className="p-2.5 border-r"><span className="font-semibold">{l.service}</span>{(invoice.servicesDetails || invoice.jobCard?.workDone) && <p className="mt-1 whitespace-pre-wrap">{invoice.servicesDetails || invoice.jobCard?.workDone}</p>}</td><td className="p-2.5 text-right font-medium">{money(invoice.serviceCharge + invoice.labourCharge)}</td></tr>}
            {(invoice.partsCost > 0 || invoice.partsDetails) && <tr className="border-b align-top"><td className="p-2.5 border-r text-center font-medium">2</td><td className="p-2.5 border-r"><span className="font-semibold">{l.parts}</span>{invoice.partsDetails && <p className="mt-1 whitespace-pre-wrap">{invoice.partsDetails}</p>}</td><td className="p-2.5 text-right font-medium">{money(invoice.partsCost)}</td></tr>}
            {otherChargesList.filter((oc) => oc.name).map((oc, index) => <tr key={index} className="border-b align-top"><td className="p-2.5 border-r text-center font-medium">{3 + index}</td><td className="p-2.5 border-r font-medium">{oc.name}</td><td className="p-2.5 text-right font-medium">{money(oc.amount)}</td></tr>)}
          </tbody></table></div>
          <div className="flex justify-end mb-8"><div className="bill-totals w-72 border rounded-md overflow-hidden text-xs"><table className="w-full"><tbody>
            <tr className="border-b border-gray-200 bg-gray-50"><td className="p-2 text-gray-700 font-medium">{l.subtotal}</td><td className="p-2 text-right font-semibold">{money(invoice.subTotal)}</td></tr>
            {invoice.discount > 0 && <tr className="border-b border-gray-200 text-red-600"><td className="p-2 font-medium">{l.discount}</td><td className="p-2 text-right font-semibold">-{money(invoice.discount)}</td></tr>}
            {invoice.tax > 0 && <tr className="border-b border-gray-200"><td className="p-2 text-gray-700 font-medium">{l.tax}{invoice.jobCard?.tax ? ` (${invoice.jobCard.tax}%)` : ""}</td><td className="p-2 text-right font-semibold">+{money(invoice.tax)}</td></tr>}
            <tr className="border-b border-gray-300 bg-gray-100 font-bold text-sm"><td className="p-2 text-gray-900">{l.grandTotal}</td><td className="p-2 text-right text-gray-900">{money(invoice.grandTotal)}</td></tr><tr className="border-b border-gray-200 text-green-700 font-medium"><td className="p-2">{l.paid}</td><td className="p-2 text-right">-{money(paidAmount)}</td></tr><tr className="bg-red-50 text-red-700 font-bold"><td className="p-2">{l.balance}</td><td className="p-2 text-right">{money(balance)}</td></tr>
          </tbody></table></div></div>
          <div className="bill-signatures grid grid-cols-2 gap-8 mt-12 pt-6 border-t"><div className="text-center"><div className="border-b border-gray-400 w-44 mx-auto mb-2" /><p className="text-xs font-semibold uppercase tracking-wider">{l.customerSignature}</p></div><div className="text-center"><div className="border-b border-gray-400 w-44 mx-auto mb-2" /><p className="text-xs font-semibold uppercase tracking-wider">{l.authorizedSignature}</p></div></div>
        </div>
      </div>
    </div>
  )
}
