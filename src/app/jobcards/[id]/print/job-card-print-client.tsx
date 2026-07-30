"use client";

import { useTranslation } from "@/i18n";
import { Currency } from "@/components/currency";
import { PrintButton } from "./print-button";
import { useEffect } from "react";
import { formatDisplayDate } from "@/lib/date-format";

export function JobCardPrintClient({ job }: { job: any }) {
  const { t, isRTL, locale } = useTranslation();

  useEffect(() => {
    document.documentElement.dir = isRTL ? "rtl" : "ltr";
  }, [isRTL]);

  const printDate = (value: Date | string) => formatDisplayDate(value);

  return (
    <div className={`min-h-screen bg-white text-black p-8 print:p-0 ${isRTL ? "font-cairo" : ""}`} dir={isRTL ? "rtl" : "ltr"}>
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { margin: 0; }
          body { padding: 2cm; }
        }
      `}} />
      <div className="max-w-3xl mx-auto border border-gray-200 p-8 print:border-none print:p-0">
        
        {/* Header */}
        <div className="flex justify-between items-start mb-8 pb-8 border-b border-gray-200">
          <div>
            <h1 className="text-3xl font-bold uppercase tracking-widest text-gray-900">{t.jobcards.title}</h1>
            <p className="text-sm text-gray-500 mt-1">Ref: {job.id.split('-')[0].toUpperCase()}</p>
          </div>
          <div className={`text-${isRTL ? 'left' : 'right'}`}>
            <h2 className="text-xl font-bold">{t.common.appName || 'Garage ERP'}</h2>
            <p className="text-sm text-gray-500">{isRTL ? '123 شارع الميكانيكيين' : '123 Mechanics Lane'}</p>
            <p className="text-sm text-gray-500">{isRTL ? 'مسقط، عمان' : 'Muscat, Oman'}</p>
            <p className="text-sm text-gray-500 mt-2 font-medium">{t.invoicesMod.date || 'Date'}: {printDate(job.createdAt)} {new Date(job.createdAt).toLocaleTimeString(locale === 'ar' ? 'ar-EG' : 'en-US')}</p>
          </div>
        </div>

        {/* Customer & Vehicle Info */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{t.jobcards.customer}</h3>
            <p className="font-semibold text-gray-900">{job.customer.name}</p>
            <p className="text-gray-600">{job.customer.phone || (isRTL ? 'لا يوجد رقم هاتف' : 'No phone provided')}</p>
            <p className="text-gray-600">{job.customer.email}</p>
          </div>
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{t.jobcards.vehicle || 'Vehicle Details'}</h3>
            <p className="font-semibold text-gray-900">{job.vehicle.brand} {job.vehicle.model}</p>
            <p className="text-gray-600">{isRTL ? 'اللوحة:' : 'Plate:'} <span className="font-mono">{job.vehicle.plateNumber}</span></p>
            <p className="text-gray-600">{t.common.year || 'Year'}: {job.vehicle.year}</p>
          </div>
        </div>

        {/* Job Details */}
        <div className="mb-8">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{t.jobcards.complaintIssue || 'Job Description'}</h3>
          <div className="bg-gray-50 p-4 rounded-md border border-gray-100">
            <h4 className="font-semibold text-sm mb-1">{t.jobcards.complaint}:</h4>
            <p className="text-gray-800 text-sm whitespace-pre-wrap">{job.complaint}</p>
          </div>
        </div>

        {/* Assigned Mechanic */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{t.jobcards.mechanic}</h3>
            <p className="font-semibold text-gray-900">{job.mechanic?.name || t.jobcards.unassigned}</p>
          </div>
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{t.common.status}</h3>
            <p className="font-semibold text-gray-900">{isRTL && job.status === 'PENDING' ? t.jobcards.statusPending : isRTL && job.status === 'IN_PROGRESS' ? t.jobcards.statusInProgress : isRTL && job.status === 'COMPLETED' ? t.jobcards.statusCompleted : isRTL && job.status === 'CANCELLED' ? t.jobcards.statusCancelled : job.status.replace('_', ' ')}</p>
          </div>
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{isRTL ? 'الانتهاء المتوقع' : 'Expected Finish'}</h3>
            <p className="font-semibold text-gray-900">{job.expectedFinishDate ? printDate(job.expectedFinishDate) : (isRTL ? 'غير محدد' : 'Not set')}</p>
          </div>
        </div>

        {/* Work Done & Cost */}
        {(job.workDone || job.estimatedCost) && (
          <div className="mb-8 border-t border-gray-200 pt-8">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">{isRTL ? 'تقييم الخدمة' : 'Service Assessment'}</h3>
            <table className="w-full table-fixed border-collapse text-sm text-left" dir={isRTL ? "rtl" : "ltr"}>
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className={`py-3 px-4 font-semibold text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}>{t.jobcards.workDone}</th>
                  <th className={`py-3 px-4 font-semibold text-gray-900 w-32 ${isRTL ? 'text-left' : 'text-right'}`}>{t.jobcards.estCost}</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100 align-top">
                  <td className="py-4 px-4 text-gray-800 whitespace-pre-wrap">{job.workDone || (isRTL ? 'في انتظار التقييم...' : 'Pending assessment...')}</td>
                  <td className={`py-4 px-4 font-medium ${isRTL ? 'text-left' : 'text-right'}`}>
                    {job.estimatedCost ? <Currency amount={job.estimatedCost} /> : '-'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {(job.services.length > 0 || job.parts.length > 0) && (
          <div className="mb-8 border-t border-gray-200 pt-8">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">{t.jobcards.services} &amp; {t.jobcards.parts}</h3>

            {job.services.length > 0 && (
              <div className="mb-6">
                <h4 className="font-semibold text-gray-900 mb-2">{t.jobcards.services}</h4>
                <table className="w-full table-fixed border-collapse text-sm text-left" dir={isRTL ? "rtl" : "ltr"}>
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className={`py-3 px-4 font-semibold text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}>{t.services.serviceName || 'Service'}</th>
                      <th className={`py-3 px-4 font-semibold text-gray-900 ${isRTL ? 'text-left' : 'text-right'}`}>{t.invoicesMod.qty || 'Qty.'}</th>
                      <th className={`py-3 px-4 font-semibold text-gray-900 ${isRTL ? 'text-left' : 'text-right'}`}>{t.services.estimatedTime || 'Time Used'}</th>
                      <th className={`py-3 px-4 font-semibold text-gray-900 ${isRTL ? 'text-left' : 'text-right'}`}>{t.invoicesMod.amount || 'Amount'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {job.services.map((item: any) => (
                      <tr key={item.id} className="border-b border-gray-100 align-top">
                        <td className="py-3 px-4 text-gray-800">{item.service.name}</td>
                        <td className={`py-3 px-4 text-gray-800 ${isRTL ? 'text-left' : 'text-right'}`}>{item.quantity}</td>
                        <td className={`py-3 px-4 text-gray-800 ${isRTL ? 'text-left' : 'text-right'}`}>{item.service.estimatedTime || '-'}</td>
                        <td className={`py-3 px-4 font-medium ${isRTL ? 'text-left' : 'text-right'}`}><Currency amount={item.price * item.quantity} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {job.parts.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">{t.jobcards.parts}</h4>
                <table className="w-full table-fixed border-collapse text-sm text-left" dir={isRTL ? "rtl" : "ltr"}>
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className={`py-3 px-4 font-semibold text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}>{t.inventoryMod.partName || 'Part'}</th>
                      <th className={`py-3 px-4 font-semibold text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}>{t.inventoryMod.partNumber || 'Part No.'}</th>
                      <th className={`py-3 px-4 font-semibold text-gray-900 ${isRTL ? 'text-left' : 'text-right'}`}>{t.invoicesMod.qty || 'Qty.'}</th>
                      <th className={`py-3 px-4 font-semibold text-gray-900 ${isRTL ? 'text-left' : 'text-right'}`}>{t.invoicesMod.amount || 'Amount'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {job.parts.map((item: any) => (
                      <tr key={item.id} className="border-b border-gray-100 align-top">
                        <td className="py-3 px-4 text-gray-800">{item.batch.inventory.itemName}</td>
                        <td className="py-3 px-4 text-gray-800">{item.batch.inventory.partNumber}</td>
                        <td className={`py-3 px-4 text-gray-800 ${isRTL ? 'text-left' : 'text-right'}`}>{item.quantity}</td>
                        <td className={`py-3 px-4 font-medium ${isRTL ? 'text-left' : 'text-right'}`}><Currency amount={item.price * item.quantity} /></td>
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
            <p className="text-xs text-gray-500 uppercase">{isRTL ? 'توقيع العميل' : 'Customer Signature'}</p>
          </div>
          <div className="text-center">
            <div className="border-b border-gray-400 w-48 mx-auto mb-2"></div>
            <p className="text-xs text-gray-500 uppercase">{isRTL ? 'توقيع معتمد' : 'Authorized Signature'}</p>
          </div>
        </div>

      </div>

      <PrintButton />
    </div>
  )
}
