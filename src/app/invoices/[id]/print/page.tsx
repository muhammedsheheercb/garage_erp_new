import { getInvoiceById } from "@/features/invoices/actions"
import { notFound } from "next/navigation"
import { PrintActions } from "./print-actions"
import { formatDisplayDate } from "@/lib/date-format"

export default async function PrintInvoicePage({ params }: { params: { id: string } }) {
  const { id } = await params
  const invoice = await getInvoiceById(id)
  
  if (!invoice) return notFound()

  const paidAmount = invoice.payments.reduce((total, payment) => total + payment.amount, 0)
  const balance = Math.max(0, invoice.grandTotal - paidAmount)

  let otherChargesList: Array<{ name: string; amount: number }> = []
  if (invoice.otherCharges) {
    try {
      const parsed = JSON.parse(invoice.otherCharges)
      if (Array.isArray(parsed)) {
        otherChargesList = parsed
      }
    } catch (e) {}
  }

  return (
    <div className="min-h-screen bg-white text-black p-4 print:p-0 font-sans">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
          html, body {
            height: 100%;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden;
          }
          .print-container {
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            width: 100% !important;
            max-width: 100% !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `,
        }}
      />

      <div className="max-w-3xl mx-auto">
        <PrintActions />

        <div className="print-container border border-gray-200 p-6 rounded-lg bg-white shadow-sm print:shadow-none print:border-none">
          {/* Top Centered Logo */}
          <div className="flex justify-center items-center mb-6">
            <img
              src="/images/logo.webp"
              alt="Bin Matar Garage"
              className="h-16 object-contain"
            />
          </div>

          {/* Customer & Vehicle Info Header Table */}
          <div className="mb-6 border border-gray-300 rounded-md overflow-hidden">
            <div className="bg-gray-100 px-4 py-2 font-bold text-sm text-gray-800 border-b border-gray-300 uppercase tracking-wider text-center flex justify-between items-center">
              <span>INVOICE</span>
              <span className="text-xs text-gray-600 font-mono">
                INV: #{invoice.id.split("-")[0].toUpperCase()}
              </span>
              <span>{formatDisplayDate(invoice.createdAt)}</span>
            </div>
            <table className="w-full text-xs text-left">
              <tbody>
                <tr className="border-b border-gray-200">
                  <td className="p-2.5 font-bold bg-gray-50 border-r border-gray-200 w-1/4">
                    Customer Name
                  </td>
                  <td className="p-2.5 w-1/4 border-r border-gray-200 font-semibold text-gray-900">
                    {invoice.customer?.name}
                  </td>
                  <td className="p-2.5 font-bold bg-gray-50 border-r border-gray-200 w-1/4">
                    Vehicle
                  </td>
                  <td className="p-2.5 w-1/4 font-semibold text-gray-900">
                    {invoice.jobCard?.vehicle?.brand} {invoice.jobCard?.vehicle?.model}
                  </td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="p-2.5 font-bold bg-gray-50 border-r border-gray-200">
                    Phone / Contact
                  </td>
                  <td className="p-2.5 border-r border-gray-200">
                    {invoice.customer?.phone || "N/A"}
                  </td>
                  <td className="p-2.5 font-bold bg-gray-50 border-r border-gray-200">
                    Plate Number
                  </td>
                  <td className="p-2.5 font-mono font-semibold text-gray-900">
                    {invoice.jobCard?.vehicle?.plateNumber}
                  </td>
                </tr>
                {invoice.jobCard?.complaint && (
                  <tr>
                    <td className="p-2.5 font-bold bg-gray-50 border-r border-gray-200">
                      Complaint / Issue
                    </td>
                    <td colSpan={3} className="p-2.5 text-gray-800 font-medium whitespace-pre-wrap">
                      {invoice.jobCard.complaint}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Itemized Charges & Details Table */}
          <div className="mb-6">
            <table className="w-full border-collapse border border-gray-300 text-xs">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-300 text-gray-800">
                  <th className="p-2.5 border-r border-gray-300 w-12 text-center">#</th>
                  <th className="p-2.5 border-r border-gray-300 text-left">Description / Details</th>
                  <th className="p-2.5 text-right w-36">Amount (OMR)</th>
                </tr>
              </thead>
              <tbody>
                {/* Services details */}
                <tr className="border-b border-gray-200 align-top">
                  <td className="p-2.5 border-r border-gray-200 text-center font-medium">1</td>
                  <td className="p-2.5 border-r border-gray-200">
                    <span className="font-semibold text-gray-900">Service & Labour Charges</span>
                    <p className="mt-1 text-gray-600 whitespace-pre-wrap">
                      {invoice.servicesDetails || invoice.jobCard?.workDone || "Standard vehicle servicing & labor"}
                    </p>
                  </td>
                  <td className="p-2.5 text-right font-medium">
                    {(invoice.serviceCharge + invoice.labourCharge).toFixed(3)}
                  </td>
                </tr>

                {/* Parts details */}
                <tr className="border-b border-gray-200 align-top">
                  <td className="p-2.5 border-r border-gray-200 text-center font-medium">2</td>
                  <td className="p-2.5 border-r border-gray-200">
                    <span className="font-semibold text-gray-900">Parts & Materials</span>
                    <p className="mt-1 text-gray-600 whitespace-pre-wrap">
                      {invoice.partsDetails || "Replacement parts used in job"}
                    </p>
                  </td>
                  <td className="p-2.5 text-right font-medium">
                    {invoice.partsCost.toFixed(3)}
                  </td>
                </tr>

                {/* Other Charges */}
                {otherChargesList.map((oc, index) => (
                  <tr key={index} className="border-b border-gray-200 align-top">
                    <td className="p-2.5 border-r border-gray-200 text-center font-medium">
                      {3 + index}
                    </td>
                    <td className="p-2.5 border-r border-gray-200 font-medium text-gray-900">
                      {oc.name || "Other Charge"}
                    </td>
                    <td className="p-2.5 text-right font-medium">
                      {oc.amount.toFixed(3)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Summary */}
          <div className="flex justify-end mb-8">
            <div className="w-72 border border-gray-300 rounded-md overflow-hidden text-xs">
              <table className="w-full">
                <tbody>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <td className="p-2 text-gray-700 font-medium">Subtotal:</td>
                    <td className="p-2 text-right font-semibold">{invoice.subTotal.toFixed(3)} OMR</td>
                  </tr>
                  {invoice.discount > 0 && (
                    <tr className="border-b border-gray-200 text-red-600">
                      <td className="p-2 font-medium">Discount:</td>
                      <td className="p-2 text-right font-semibold">-{invoice.discount.toFixed(3)} OMR</td>
                    </tr>
                  )}
                  {invoice.tax > 0 && (
                    <tr className="border-b border-gray-200">
                      <td className="p-2 text-gray-700 font-medium">Tax (VAT):</td>
                      <td className="p-2 text-right font-semibold">+{invoice.tax.toFixed(3)} OMR</td>
                    </tr>
                  )}
                  <tr className="border-b border-gray-300 bg-gray-100 font-bold text-sm">
                    <td className="p-2 text-gray-900">Grand Total:</td>
                    <td className="p-2 text-right text-gray-900">{invoice.grandTotal.toFixed(3)} OMR</td>
                  </tr>
                  <tr className="border-b border-gray-200 text-green-700 font-medium">
                    <td className="p-2">Paid Amount:</td>
                    <td className="p-2 text-right">-{paidAmount.toFixed(3)} OMR</td>
                  </tr>
                  <tr className="bg-red-50 text-red-700 font-bold">
                    <td className="p-2">Balance Due:</td>
                    <td className="p-2 text-right">{balance.toFixed(3)} OMR</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer Signatures */}
          <div className="grid grid-cols-2 gap-8 mt-12 pt-6 border-t border-gray-300">
            <div className="text-center">
              <div className="border-b border-gray-400 w-44 mx-auto mb-2"></div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Customer Signature
              </p>
            </div>
            <div className="text-center">
              <div className="border-b border-gray-400 w-44 mx-auto mb-2"></div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Authorized Signature
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

