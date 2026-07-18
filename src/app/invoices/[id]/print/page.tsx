import { getInvoiceById } from "@/features/invoices/actions"
import { notFound } from "next/navigation"
import { PrintActions } from "./print-actions"

export default async function PrintInvoicePage({ params }: { params: { id: string } }) {
  const { id } = await params
  const invoice = await getInvoiceById(id)
  
  if (!invoice) return notFound()

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white text-black min-h-screen font-sans">
      <PrintActions />
      
      <div className="border border-gray-200 p-8 rounded-lg shadow-sm print:shadow-none print:border-none">
        <div className="flex justify-between items-start border-b pb-6 mb-6">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">INVOICE</h1>
            <p className="text-gray-500 mt-1">ID: {invoice.id.split('-')[0].toUpperCase()}</p>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-semibold">Garage ERP</h2>
            <p className="text-gray-600">123 Mechanic Street</p>
            <p className="text-gray-600">City, Country</p>
            <p className="text-gray-600">contact@garageerp.com</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <h3 className="font-semibold text-gray-900 border-b pb-2 mb-2">Customer Details</h3>
            <p className="font-medium text-lg">{invoice.customer.name}</p>
            <p className="text-gray-600">{invoice.customer.phone || 'N/A'}</p>
            <p className="text-gray-600">{invoice.customer.email || 'N/A'}</p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 border-b pb-2 mb-2">Vehicle Details</h3>
            <p className="font-medium">{invoice.jobCard.vehicle.brand} {invoice.jobCard.vehicle.model}</p>
            <p className="text-gray-600">Plate: {invoice.jobCard.vehicle.plateNumber}</p>
            <p className="text-gray-600">Job Card: {invoice.jobCard.id.split('-')[0].toUpperCase()}</p>
          </div>
        </div>

        <div className="mb-8">
          <h3 className="font-semibold text-gray-900 border-b pb-2 mb-2">Service Details</h3>
          <div className="bg-gray-50 p-4 rounded text-gray-800 whitespace-pre-wrap min-h-[4rem]">
            {invoice.servicesDetails || invoice.jobCard.workDone || invoice.jobCard.complaint || "No service details provided."}
          </div>
        </div>
        
        <div className="mb-8">
          <h3 className="font-semibold text-gray-900 border-b pb-2 mb-2">Parts Details</h3>
          <div className="bg-gray-50 p-4 rounded text-gray-800 whitespace-pre-wrap min-h-[4rem]">
            {invoice.partsDetails || "No parts details provided."}
          </div>
        </div>

        <div className="flex justify-end">
          <div className="w-1/2 min-w-[300px]">
            <table className="w-full text-right">
              <tbody>
                <tr className="border-b">
                  <td className="py-2 text-gray-600">Labour Charge:</td>
                  <td className="py-2 font-medium">{invoice.labourCharge.toFixed(3)} OMR</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 text-gray-600">Parts Cost:</td>
                  <td className="py-2 font-medium">{invoice.partsCost.toFixed(3)} OMR</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 text-gray-600">Subtotal:</td>
                  <td className="py-2 font-medium">{invoice.subTotal.toFixed(3)} OMR</td>
                </tr>
                <tr className="border-b text-red-600">
                  <td className="py-2">Discount:</td>
                  <td className="py-2 font-medium">-{invoice.discount.toFixed(3)} OMR</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 text-gray-600">Tax:</td>
                  <td className="py-2 font-medium">+{invoice.tax.toFixed(3)} OMR</td>
                </tr>
                <tr className="text-xl font-bold bg-gray-100">
                  <td className="py-4 px-4 text-left">Grand Total:</td>
                  <td className="py-4 px-4">{invoice.grandTotal.toFixed(3)} OMR</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        
        <div className="mt-16 text-center text-gray-500 text-sm">
          <p>Thank you for your business!</p>
          <p>Generated on {new Date(invoice.createdAt).toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  )
}
