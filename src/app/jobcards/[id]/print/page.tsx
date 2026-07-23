import { getJobCardById } from "@/features/jobcards/actions"
import { notFound } from "next/navigation"
import { Currency } from "@/components/currency"
import { PrintButton } from "./print-button"

export default async function PrintJobCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJobCardById(id)
  
  if (!job) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-white text-black p-8 print:p-0">
      <div className="max-w-3xl mx-auto border border-gray-200 p-8 print:border-none print:p-0">
        
        {/* Header */}
        <div className="flex justify-between items-start mb-8 pb-8 border-b border-gray-200">
          <div>
            <h1 className="text-3xl font-bold uppercase tracking-widest text-gray-900">Job Card</h1>
            <p className="text-sm text-gray-500 mt-1">Ref: {job.id.split('-')[0].toUpperCase()}</p>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold">Garage ERP</h2>
            <p className="text-sm text-gray-500">123 Mechanics Lane</p>
            <p className="text-sm text-gray-500">Muscat, Oman</p>
            <p className="text-sm text-gray-500 mt-2 font-medium">Date: {new Date(job.createdAt).toLocaleDateString()}</p>
          </div>
        </div>

        {/* Customer & Vehicle Info */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Customer Details</h3>
            <p className="font-semibold text-gray-900">{job.customer.name}</p>
            <p className="text-gray-600">{job.customer.phone || 'No phone provided'}</p>
            <p className="text-gray-600">{job.customer.email}</p>
          </div>
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Vehicle Details</h3>
            <p className="font-semibold text-gray-900">{job.vehicle.brand} {job.vehicle.model}</p>
            <p className="text-gray-600">Plate: <span className="font-mono">{job.vehicle.plateNumber}</span></p>
            <p className="text-gray-600">Year: {job.vehicle.year}</p>
          </div>
        </div>

        {/* Job Details */}
        <div className="mb-8">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Job Description</h3>
          <div className="bg-gray-50 p-4 rounded-md border border-gray-100">
            <h4 className="font-semibold text-sm mb-1">Customer Complaint:</h4>
            <p className="text-gray-800 text-sm whitespace-pre-wrap">{job.complaint}</p>
          </div>
        </div>

        {/* Assigned Mechanic */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Assigned Mechanic</h3>
            <p className="font-semibold text-gray-900">{job.mechanic?.name || 'Unassigned'}</p>
          </div>
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Current Status</h3>
            <p className="font-semibold text-gray-900">{job.status.replace('_', ' ')}</p>
          </div>
        </div>

        {/* Work Done & Cost */}
        {(job.workDone || job.estimatedCost) && (
          <div className="mb-8 border-t border-gray-200 pt-8">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Service Assessment</h3>
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4 font-semibold text-gray-900">Work Done / Notes</th>
                  <th className="py-3 px-4 font-semibold text-gray-900 text-right w-32">Est. Cost</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="py-4 px-4 text-gray-800 whitespace-pre-wrap">{job.workDone || 'Pending assessment...'}</td>
                  <td className="py-4 px-4 text-right font-medium">
                    {job.estimatedCost ? <Currency amount={job.estimatedCost} /> : '-'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {(job.services.length > 0 || job.parts.length > 0) && (
          <div className="mb-8 border-t border-gray-200 pt-8">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Services &amp; Parts Used</h3>

            {job.services.length > 0 && (
              <div className="mb-6">
                <h4 className="font-semibold text-gray-900 mb-2">Services</h4>
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="py-3 px-4 font-semibold text-gray-900">Service</th>
                      <th className="py-3 px-4 font-semibold text-gray-900 text-right">Qty.</th>
                      <th className="py-3 px-4 font-semibold text-gray-900 text-right">Time Used</th>
                      <th className="py-3 px-4 font-semibold text-gray-900 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {job.services.map((item) => (
                      <tr key={item.id} className="border-b border-gray-100">
                        <td className="py-3 px-4 text-gray-800">{item.service.name}</td>
                        <td className="py-3 px-4 text-right text-gray-800">{item.quantity}</td>
                        <td className="py-3 px-4 text-right text-gray-800">{item.service.estimatedTime || '-'}</td>
                        <td className="py-3 px-4 text-right font-medium"><Currency amount={item.price * item.quantity} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {job.parts.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Parts Used</h4>
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="py-3 px-4 font-semibold text-gray-900">Part</th>
                      <th className="py-3 px-4 font-semibold text-gray-900">Part No.</th>
                      <th className="py-3 px-4 font-semibold text-gray-900 text-right">Qty.</th>
                      <th className="py-3 px-4 font-semibold text-gray-900 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {job.parts.map((item) => (
                      <tr key={item.id} className="border-b border-gray-100">
                        <td className="py-3 px-4 text-gray-800">{item.batch.inventory.itemName}</td>
                        <td className="py-3 px-4 text-gray-800">{item.batch.inventory.partNumber}</td>
                        <td className="py-3 px-4 text-right text-gray-800">{item.quantity}</td>
                        <td className="py-3 px-4 text-right font-medium"><Currency amount={item.price * item.quantity} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Footer Signatures */}
        <div className="grid grid-cols-2 gap-8 mt-16 pt-8 border-t border-gray-200">
          <div className="text-center">
            <div className="border-b border-gray-400 w-48 mx-auto mb-2"></div>
            <p className="text-xs text-gray-500 uppercase">Customer Signature</p>
          </div>
          <div className="text-center">
            <div className="border-b border-gray-400 w-48 mx-auto mb-2"></div>
            <p className="text-xs text-gray-500 uppercase">Authorized Signature</p>
          </div>
        </div>

      </div>

      <PrintButton />
    </div>
  )
}
