"use client"

import { ArrowLeft, Printer } from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useEffect, useSyncExternalStore } from "react"
import { useTranslation } from "@/i18n"

function dateText(value: Date | string, locale: "en" | "ar") {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-OM" : "en-GB").format(new Date(value))
}

function amountText(value: number, locale: "en" | "ar") {
  return new Intl.NumberFormat(locale === "ar" ? "ar-OM" : "en-OM", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(value)
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
    complaint: "الشكوى / المشكلة", description: "الوصف / التفاصيل", service: "رسوم الخدمة والعمل", serviceFallback: "خدمات وصيانة المركبة القياسية",
    parts: "القطع والمواد", partsFallback: "قطع الغيار المستخدمة في العمل", other: "رسوم أخرى", subtotal: "المجموع الفرعي:", discount: "الخصم:",
    tax: "الضريبة (VAT):", grandTotal: "المجموع الإجمالي:", paid: "المبلغ المدفوع:", balance: "المبلغ المتبقي:", customerSignature: "توقيع العميل",
    authorizedSignature: "التوقيع المعتمد", back: "رجوع", print: "طباعة / تنزيل PDF", amount: "المبلغ (ر.ع.)",
  } : {
    invoice: "INVOICE", customer: "Customer Name", vehicle: "Vehicle", phone: "Phone / Contact", plate: "Plate Number",
    complaint: "Complaint / Issue", description: "Description / Details", service: "Service & Labour Charges", serviceFallback: "Standard vehicle servicing & labor",
    parts: "Parts & Materials", partsFallback: "Replacement parts used in job", other: "Other Charge", subtotal: "Subtotal:", discount: "Discount:",
    tax: "Tax (VAT):", grandTotal: "Grand Total:", paid: "Paid Amount:", balance: "Balance Due:", customerSignature: "Customer Signature",
    authorizedSignature: "Authorized Signature", back: "Back", print: "Print / Download PDF", amount: "Amount (OMR)",
  }

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className={`min-h-screen bg-white text-black p-4 print:p-0 font-sans ${isRTL ? "font-cairo" : ""}`}>
      <style dangerouslySetInnerHTML={{ __html: `@media print { @page { size: A4 portrait; margin: 8mm; } html,body { margin:0!important; padding:0!important; overflow:hidden; } .print-container { border:none!important; padding:0!important; margin:0!important; box-shadow:none!important; width:100%!important; max-width:100%!important; page-break-inside:avoid!important; } }` }} />
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between print:hidden mb-8 gap-4">
          <button type="button" className="border rounded-md px-4 py-2 flex items-center" onClick={() => router.back()}><ArrowLeft className="mr-2 h-4 w-4" />{l.back}</button>
          <button type="button" className="bg-primary text-primary-foreground rounded-md px-4 py-2 flex items-center" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />{l.print}</button>
        </div>
        <div className="print-container border border-gray-200 p-6 rounded-lg bg-white shadow-sm print:shadow-none print:border-none">
          <div className="flex justify-center items-center mb-6"><Image src="/images/logo.webp" alt="Bin Matar Garage" width={160} height={64} className="h-16 w-auto object-contain" /></div>
          <div className="mb-6 border border-gray-300 rounded-md overflow-hidden">
            <div className="bg-gray-100 px-4 py-2 font-bold text-sm text-gray-800 border-b border-gray-300 uppercase tracking-wider text-center flex justify-between items-center"><span>{l.invoice}</span><span className="text-xs text-gray-600 font-mono">INV: #{invoice.id.split("-")[0].toUpperCase()}</span><span>{dateText(invoice.createdAt, locale)}</span></div>
            <table className="w-full text-xs"><tbody>
              <tr className="border-b border-gray-200"><td className="p-2.5 font-bold bg-gray-50 border-r border-gray-200 w-1/4">{l.customer}</td><td className="p-2.5 w-1/4 border-r border-gray-200 font-semibold text-gray-900">{invoice.customer?.name}</td><td className="p-2.5 font-bold bg-gray-50 border-r border-gray-200 w-1/4">{l.vehicle}</td><td className="p-2.5 w-1/4 font-semibold text-gray-900">{invoice.jobCard?.vehicle?.brand} {invoice.jobCard?.vehicle?.model}</td></tr>
              <tr className="border-b border-gray-200"><td className="p-2.5 font-bold bg-gray-50 border-r border-gray-200">{l.phone}</td><td className="p-2.5 border-r border-gray-200">{invoice.customer?.phone || "N/A"}</td><td className="p-2.5 font-bold bg-gray-50 border-r border-gray-200">{l.plate}</td><td className="p-2.5 font-mono font-semibold text-gray-900">{invoice.jobCard?.vehicle?.plateNumber}</td></tr>
              {invoice.jobCard?.complaint && <tr><td className="p-2.5 font-bold bg-gray-50 border-r border-gray-200">{l.complaint}</td><td colSpan={3} className="p-2.5 text-gray-800 font-medium whitespace-pre-wrap">{invoice.jobCard.complaint}</td></tr>}
            </tbody></table>
          </div>
          <div className="mb-6"><table className="w-full border-collapse border border-gray-300 text-xs"><thead><tr className="bg-gray-100 border-b border-gray-300 text-gray-800"><th className="p-2.5 border-r border-gray-300 w-12 text-center">#</th><th className={`p-2.5 border-r border-gray-300 ${isRTL ? "text-right" : "text-left"}`}>{l.description}</th><th className={`p-2.5 w-36 ${isRTL ? "text-left" : "text-right"}`}>{l.amount}</th></tr></thead><tbody>
            <tr className="border-b border-gray-200 align-top"><td className="p-2.5 border-r border-gray-200 text-center font-medium">1</td><td className="p-2.5 border-r border-gray-200"><span className="font-semibold text-gray-900">{l.service}</span><p className="mt-1 text-gray-600 whitespace-pre-wrap">{invoice.servicesDetails || invoice.jobCard?.workDone || l.serviceFallback}</p></td><td className="p-2.5 text-right font-medium">{money(invoice.serviceCharge + invoice.labourCharge)}</td></tr>
            <tr className="border-b border-gray-200 align-top"><td className="p-2.5 border-r border-gray-200 text-center font-medium">2</td><td className="p-2.5 border-r border-gray-200"><span className="font-semibold text-gray-900">{l.parts}</span><p className="mt-1 text-gray-600 whitespace-pre-wrap">{invoice.partsDetails || l.partsFallback}</p></td><td className="p-2.5 text-right font-medium">{money(invoice.partsCost)}</td></tr>
            {otherChargesList.map((oc, index) => <tr key={index} className="border-b border-gray-200 align-top"><td className="p-2.5 border-r border-gray-200 text-center font-medium">{3 + index}</td><td className="p-2.5 border-r border-gray-200 font-medium text-gray-900">{oc.name || l.other}</td><td className="p-2.5 text-right font-medium">{money(oc.amount)}</td></tr>)}
          </tbody></table></div>
          <div className="flex justify-end mb-8"><div className="w-72 border border-gray-300 rounded-md overflow-hidden text-xs"><table className="w-full"><tbody>
            <tr className="border-b border-gray-200 bg-gray-50"><td className="p-2 text-gray-700 font-medium">{l.subtotal}</td><td className="p-2 text-right font-semibold">{money(invoice.subTotal)}</td></tr>
            {invoice.discount > 0 && <tr className="border-b border-gray-200 text-red-600"><td className="p-2 font-medium">{l.discount}</td><td className="p-2 text-right font-semibold">-{money(invoice.discount)}</td></tr>}
            {invoice.tax > 0 && <tr className="border-b border-gray-200"><td className="p-2 text-gray-700 font-medium">{l.tax}</td><td className="p-2 text-right font-semibold">+{money(invoice.tax)}</td></tr>}
            <tr className="border-b border-gray-300 bg-gray-100 font-bold text-sm"><td className="p-2 text-gray-900">{l.grandTotal}</td><td className="p-2 text-right text-gray-900">{money(invoice.grandTotal)}</td></tr><tr className="border-b border-gray-200 text-green-700 font-medium"><td className="p-2">{l.paid}</td><td className="p-2 text-right">-{money(paidAmount)}</td></tr><tr className="bg-red-50 text-red-700 font-bold"><td className="p-2">{l.balance}</td><td className="p-2 text-right">{money(balance)}</td></tr>
          </tbody></table></div></div>
          <div className="grid grid-cols-2 gap-8 mt-12 pt-6 border-t border-gray-300"><div className="text-center"><div className="border-b border-gray-400 w-44 mx-auto mb-2" /><p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">{l.customerSignature}</p></div><div className="text-center"><div className="border-b border-gray-400 w-44 mx-auto mb-2" /><p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">{l.authorizedSignature}</p></div></div>
        </div>
      </div>
    </div>
  )
}
