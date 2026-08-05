"use client";

import { useTranslation } from "@/i18n";
import { Currency } from "@/components/currency";
import { PrintButton } from "./print-button";
import { useEffect, useSyncExternalStore } from "react";

export function JobCardPrintClient({ job }: { job: any }) {
  const { t, isRTL } = useTranslation();
  const isHydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  useEffect(() => {
    document.documentElement.dir = isRTL ? "rtl" : "ltr";
  }, [isRTL]);

  // The selected language is restored from localStorage on the client.
  // Wait for that value before rendering so the server and client markup match.
  if (!isHydrated) {
    return null;
  }

  // Calculate totals
  const servicesTotal = job.services.reduce(
    (sum: number, item: any) => sum + (item.price || 0) * (item.quantity || 1),
    0
  );
  const partsTotal = job.parts.reduce(
    (sum: number, item: any) => sum + (item.price || 0) * (item.quantity || 1),
    0
  );
  const grandTotal = servicesTotal + partsTotal + (job.estimatedCost || 0);

  return (
    <div
      className={`min-h-screen bg-white text-black p-4 print:p-0 ${isRTL ? "font-cairo" : ""
        }`}
      dir={isRTL ? "rtl" : "ltr"}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-container {
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            width: 100% !important;
            max-width: 100% !important;
            min-height: calc(297mm - 16mm) !important;
            box-sizing: border-box !important;
            display: flex !important;
            flex-direction: column !important;
            font-size: 15px !important;
            font-weight: 700 !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
          }
          .print-container table {
            font-size: 15px !important;
          }
          .print-container td,
          .print-container th,
          .print-container p,
          .print-container span {
            font-weight: 800 !important;
          }
          .print-signatures {
            margin-top: auto !important;
            padding-top: 24px !important;
            padding-bottom: 4px !important;
          }
          .print-signatures p {
            font-size: 15px !important;
          }
          .print-container.font-cairo,
          .print-container.font-cairo table,
          .print-container.font-cairo td,
          .print-container.font-cairo th,
          .print-container.font-cairo p,
          .print-container.font-cairo span {
            font-size: 17px !important;
          }
        }
      `,
        }}
      />
      <div className="print-container max-w-3xl mx-auto border border-gray-200 p-6 rounded-lg bg-white">
        {/* Top Centered Logo */}
        <div className="flex justify-center items-center mb-6">
          <img
            src="/images/logo.webp"
            alt="Logo"
            className="h-16 object-contain"
          />
        </div>

        {/* Customer & Vehicle Info Header Table */}
        <div className="mb-6 border border-gray-300 rounded-md overflow-hidden">
          <div className="bg-gray-100 px-4 py-2 font-bold text-sm text-gray-800 border-b border-gray-300 uppercase tracking-wider text-center">
            {t.jobcards.title || "Job Card"}
          </div>
          <table className="w-full text-xs text-left" dir={isRTL ? "rtl" : "ltr"}>
            <tbody>
              <tr className="border-b border-gray-200">
                <td className="p-2.5 font-bold bg-gray-50 border-r border-gray-200 w-1/4">
                  {t.jobcards.customer || "Customer Name"}
                </td>
                <td className="p-2.5 w-1/4 border-r border-gray-200 font-semibold text-gray-900">
                  {job.customer?.name}
                </td>
                <td className="p-2.5 font-bold bg-gray-50 border-r border-gray-200 w-1/4">
                  {t.jobcards.vehicle || "Vehicle"}
                </td>
                <td className="p-2.5 w-1/4 font-semibold text-gray-900">
                  {job.vehicle?.brand} {job.vehicle?.model}
                </td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="p-2.5 font-bold bg-gray-50 border-r border-gray-200">
                  {isRTL ? "رقم الهاتف" : "Phone"}
                </td>
                <td className="p-2.5 border-r border-gray-200">
                  {job.customer?.phone || "-"}
                </td>
                <td className="p-2.5 font-bold bg-gray-50 border-r border-gray-200">
                  {isRTL ? "اللوحة" : "Plate No."}
                </td>
                <td className="p-2.5 font-mono font-semibold text-gray-900">
                  {job.vehicle?.plateNumber}
                </td>
              </tr>
              {job.complaint && (
                <tr>
                  <td className="p-2.5 font-bold bg-gray-50 border-r border-gray-200">
                    {t.jobcards.complaint || (isRTL ? "الشكوى / المشكلة" : "Complaint / Issue")}
                  </td>
                  <td colSpan={3} className="p-2.5 text-gray-800 font-medium whitespace-pre-wrap">
                    {job.complaint}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Combined Items Bill Table */}
        <div className="mb-6">
          <table
            className="w-full border-collapse border border-gray-300 text-xs"
            dir={isRTL ? "rtl" : "ltr"}
          >
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300 text-gray-800">
                <th className="p-2.5 border-r border-gray-300 w-12 text-center">
                  #
                </th>
                <th
                  className={`p-2.5 border-r border-gray-300 ${isRTL ? "text-right" : "text-left"
                    }`}
                >
                  {isRTL ? "الوصف / الخدمة / القطعة" : "Description / Service / Part"}
                </th>
                <th className="p-2.5 border-r border-gray-300 w-20 text-center">
                  {t.invoicesMod?.qty || "Qty"}
                </th>
                <th
                  className={`p-2.5 border-r border-gray-300 w-28 ${isRTL ? "text-left" : "text-right"
                    }`}
                >
                  {isRTL ? "سعر الوحدة" : "Unit Price"}
                </th>
                <th
                  className={`p-2.5 ${isRTL ? "text-left" : "text-right"
                    } w-28`}
                >
                  {t.invoicesMod?.amount || "Total"}
                </th>
              </tr>
            </thead>
            <tbody>
              {job.workDone && (
                <tr className="border-b border-gray-200 align-top">
                  <td className="p-2.5 border-r border-gray-200 text-center font-medium">
                    1
                  </td>
                  <td className="p-2.5 border-r border-gray-200">
                    <span className="font-semibold text-gray-900">
                      {isRTL ? "عمل منجز / تقييم الخدمة:" : "Work Done / Assessment:"}
                    </span>
                    <p className="mt-1 text-gray-700 whitespace-pre-wrap">
                      {job.workDone}
                    </p>
                  </td>
                  <td className="p-2.5 border-r border-gray-200 text-center">1</td>
                  <td className={`p-2.5 border-r border-gray-200 ${isRTL ? "text-left" : "text-right"}`}>
                    {job.estimatedCost ? <Currency amount={job.estimatedCost} /> : "-"}
                  </td>
                  <td className={`p-2.5 font-medium ${isRTL ? "text-left" : "text-right"}`}>
                    {job.estimatedCost ? <Currency amount={job.estimatedCost} /> : "-"}
                  </td>
                </tr>
              )}

              {/* Services */}
              {job.services?.map((item: any, idx: number) => {
                const rowNum = (job.workDone ? 1 : 0) + idx + 1;
                return (
                  <tr key={`srv-${item.id}`} className="border-b border-gray-200 align-top">
                    <td className="p-2.5 border-r border-gray-200 text-center font-medium">
                      {rowNum}
                    </td>
                    <td className="p-2.5 border-r border-gray-200">
                      <span className="font-medium text-gray-900">
                        {item.service?.name}
                      </span>
                    </td>
                    <td className="p-2.5 border-r border-gray-200 text-center">
                      {item.quantity}
                    </td>
                    <td className={`p-2.5 border-r border-gray-200 ${isRTL ? "text-left" : "text-right"}`}>
                      <Currency amount={item.price || 0} />
                    </td>
                    <td className={`p-2.5 font-medium ${isRTL ? "text-left" : "text-right"}`}>
                      <Currency amount={(item.price || 0) * (item.quantity || 1)} />
                    </td>
                  </tr>
                );
              })}

              {/* Parts */}
              {job.parts?.map((item: any, idx: number) => {
                const rowNum = (job.workDone ? 1 : 0) + (job.services?.length || 0) + idx + 1;
                return (
                  <tr key={`prt-${item.id}`} className="border-b border-gray-200 align-top">
                    <td className="p-2.5 border-r border-gray-200 text-center font-medium">
                      {rowNum}
                    </td>
                    <td className="p-2.5 border-r border-gray-200">
                      <span className="font-medium text-gray-900">
                        {item.batch?.inventory?.itemName}
                      </span>
                      {item.batch?.inventory?.partNumber && (
                        <span className="text-gray-500 text-[11px] block">
                          {isRTL ? "رقم القطعة:" : "PN:"} {item.batch.inventory.partNumber}
                        </span>
                      )}
                    </td>
                    <td className="p-2.5 border-r border-gray-200 text-center">
                      {item.quantity}
                    </td>
                    <td className={`p-2.5 border-r border-gray-200 ${isRTL ? "text-left" : "text-right"}`}>
                      <Currency amount={item.price || 0} />
                    </td>
                    <td className={`p-2.5 font-medium ${isRTL ? "text-left" : "text-right"}`}>
                      <Currency amount={(item.price || 0) * (item.quantity || 1)} />
                    </td>
                  </tr>
                );
              })}

              {/* Empty state if nothing */}
              {!job.workDone && (!job.services || job.services.length === 0) && (!job.parts || job.parts.length === 0) && (
                <tr className="border-b border-gray-200">
                  <td colSpan={5} className="p-4 text-center text-gray-500">
                    {isRTL ? "لا توجد عناصر مضافة" : "No items listed."}
                  </td>
                </tr>
              )}
            </tbody>
            {grandTotal > 0 && (
              <tfoot>
                <tr className="bg-gray-50 font-bold border-t border-gray-300 text-xs">
                  <td colSpan={4} className={`p-2.5 border-r border-gray-300 ${isRTL ? "text-left" : "text-right"}`}>
                    {isRTL ? "الإجمالي:" : "Total Amount:"}
                  </td>
                  <td className={`p-2.5 ${isRTL ? "text-left" : "text-right"}`}>
                    <Currency amount={grandTotal} />
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Footer Signatures */}
        <div className="print-signatures grid grid-cols-2 gap-8 mt-12 pt-6 border-t border-gray-300">
          <div className="text-center">
            <div className="border-b border-gray-400 w-44 mx-auto mb-2"></div>
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
              {isRTL ? "توقيع العميل" : "Customer Signature"}
            </p>
          </div>
          <div className="text-center">
            <div className="border-b border-gray-400 w-44 mx-auto mb-2"></div>
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
              {isRTL ? "توقيع معتمد" : "Authorized Signature"}
            </p>
          </div>
        </div>
      </div>

      <PrintButton />
    </div>
  );
}
