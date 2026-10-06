"use client"

import Image from "next/image"

import type { JobCardView } from "@/lib/view-models";

import { Currency } from "@/components/currency";
import { PrintButton } from "./print-button";
import { JobCardTermsAndConditions } from "./job-card-terms-and-conditions";
import { formatDisplayDate } from "@/lib/date-format";
import { useEffect, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "@/i18n";

const dash = (value: unknown) => value === null || value === undefined || value === "" ? "—" : String(value);

function Field({ label, value }: { label: string; value: ReactNode }) {
  return <div className="jc-field"><span>{label}</span><strong>{value === null || value === undefined || value === "" ? "—" : value}</strong></div>;
}

export function JobCardPrintClient({ job }: { job: JobCardView }) {
  const { isRTL } = useTranslation();
  const isHydrated = useSyncExternalStore(() => () => {}, () => true, () => false);

  useEffect(() => { document.documentElement.dir = isRTL ? "rtl" : "ltr"; }, [isRTL]);
  if (!isHydrated) return null;

  const servicesTotal = job.services.reduce((sum: number, item) => sum + (item.price || 0), 0);
  const partsTotal = job.parts.reduce((sum: number, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
  const otherCharges: Array<{ description: string; amount: number }> = (() => { try { return JSON.parse(job.otherCharges || "[]") } catch { return [] } })();
  const otherChargesTotal = otherCharges.reduce((sum: number, charge) => sum + (Number(charge.amount) || 0), 0);
  const grandTotal = job.grandTotal ?? servicesTotal + partsTotal + otherChargesTotal;
  const balance = Math.max(0, grandTotal - (job.advancePaid || 0));
  const items = [
    ...(job.workDone ? [{ type: "Work done / العمل المنجز", name: job.workDone, quantity: 1, price: job.estimatedCost || 0, id: "work" }] : []),
    ...(job.services || []).map((item) => ({ type: "Service / خدمة", name: item.service?.name, quantity: item.quantity || 1, price: (item.price || 0) / (item.quantity || 1), amount: item.price || 0, id: `service-${item.id}` })),
    ...(!job.hideServicePartsAmounts ? (job.parts || []).map((item) => ({ type: "Part / قطعة", name: `${item.batch?.inventory?.itemName || item.inventory?.itemName || "Pending part"}${(item.batch?.inventory?.partNumber || item.inventory?.partNumber) ? ` (${item.batch?.inventory?.partNumber || item.inventory?.partNumber})` : ""}`, quantity: item.quantity || 1, price: item.price || 0, id: `part-${item.id}` })) : []),
  ];

  return (
    <main className="jc-page-shell" dir={isRTL ? "rtl" : "ltr"}>
      <style dangerouslySetInnerHTML={{ __html: `
        @page { size: A4 portrait; margin: 7mm; }
        * { box-sizing: border-box; }
        .jc-page-shell { padding:80px 0 24px; }
        .jc-page { width:196mm; min-height:283mm; margin:0 auto; padding:4mm; color:#281315; background:#fff1f2; border:.55mm solid #551d25; font-family:Arial, "Noto Sans Arabic", sans-serif; font-size:13.54px; line-height:1.24; overflow-wrap:anywhere; }
        .jc-page-one { display:flex; flex-direction:column; break-after:page; page-break-after:always; }
        .jc-page *, .jc-page *::before, .jc-page *::after { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        .jc-header { display:flex; align-items:center; gap:4mm; padding:2.2mm 3mm; background:#8d2634; color:#fff; border: .35mm solid #551d25; }
        .jc-logo { width:29mm; height:15mm; object-fit:contain; background:#fff; padding:1.5mm; }
        .jc-title { flex:1; text-align:center; font-size:28.80px; line-height:1; font-weight:900; letter-spacing:1px; }
        .jc-title small { display:block; margin-top:.7mm; font-size:12.96px; letter-spacing:.5px; font-weight:700; }
        .jc-number { min-width:37mm; border-left:.25mm solid #f7cbd0; padding-left:3mm; font-size:12.96px; }
        .jc-number strong { display:block; font-size:15.84px; margin-top:.7mm; }
        .jc-section { margin-top:1.6mm; border:.3mm solid #6d2931; background:#fffafb; break-inside:avoid; page-break-inside:avoid; }
        .jc-section-title { padding:1mm 2mm; color:#fff; background:#9d3543; font-size:12.96px; font-weight:800; letter-spacing:.35px; text-transform:uppercase; }
        .jc-grid { display:grid; grid-template-columns:repeat(4, 1fr); }
        .jc-vehicle-grid { display:grid; grid-template-columns:repeat(3, 1fr); }
        .jc-field { min-height:9.5mm; padding:1mm 2mm; border-right:.2mm solid #c58d94; border-top:.2mm solid #c58d94; overflow-wrap:anywhere; }
        .jc-grid .jc-field:nth-child(4n), .jc-vehicle-grid .jc-field:nth-child(3n) { border-right:0; }
        .jc-field span { display:block; margin-bottom:.5mm; color:#762c35; font-size:10.80px; font-weight:800; text-transform:uppercase; }
        .jc-field strong { display:block; font-size:14.11px; font-weight:700; }
        .jc-text { padding:1.1mm 2mm; min-height:9.5mm; white-space:pre-wrap; overflow-wrap:anywhere; font-size:13.25px; border-top:.2mm solid #c58d94; }
        .jc-text b { color:#762c35; font-size:11.52px; text-transform:uppercase; }
        .jc-items { width:100%; border-collapse:collapse; table-layout:fixed; }
        .jc-items th { padding:1.1mm; background:#f4c9cf; color:#4c1720; border:.2mm solid #8e4751; font-size:11.52px; text-transform:uppercase; }
        .jc-items td { padding:1mm 1.3mm; border:.2mm solid #c58d94; vertical-align:top; font-size:12.67px; overflow-wrap:anywhere; }.jc-items tr { break-inside:avoid; page-break-inside:avoid; }
        .jc-items .number { text-align:center; width:7mm; }.jc-items .type { width:25mm; }.jc-items .qty { width:12mm; text-align:center; }.jc-items .money { width:35mm; text-align:right; white-space:nowrap; overflow-wrap:normal; word-break:normal; }
        .jc-totals { display:grid; grid-template-columns:1fr 51mm; border-top:.25mm solid #6d2931; }.jc-totals-note { padding:1.5mm 2mm; color:#6a3037; font-size:11.52px; }.jc-totals-values { border-left:.25mm solid #6d2931; }.jc-total { display:flex; justify-content:space-between; padding:1.1mm 2mm; font-size:12.53px; border-bottom:.2mm solid #c58d94; }.jc-total:last-child { border-bottom:0; background:#f1b8c0; font-weight:900; font-size:14.40px; }
        .jc-terms { padding:1.6mm 2mm; }.jc-ar { direction:rtl; text-align:right; font-weight:700; }.jc-notice { padding-bottom:1.1mm; margin-bottom:1.1mm; border-bottom:.2mm solid #d5a1a7; font-size:12.10px; }.jc-notice:last-of-type { border:0; }.jc-ack { padding:1.2mm; margin-top:1.1mm; background:#f8d9dd; border:.2mm solid #b35d68; font-size:11.95px; font-weight:700; }.jc-approval { margin-top:1.1mm; font-size:11.81px; }.jc-sign-line { display:inline-block; min-width:45mm; margin-left:2mm; border-bottom:.25mm solid #59212a; height:4mm; vertical-align:bottom; }
        .jc-footer { margin-top:auto; }.jc-signatures { display:grid; grid-template-columns:repeat(3, 1fr); gap:4mm; padding:2.4mm 2mm 1.8mm; }.jc-signature { padding-top:6mm; text-align:center; border-top:.25mm solid #59212a; font-size:12.24px; font-weight:800; }.jc-signature-approval { grid-column:1 / -1; display:grid; grid-template-columns:1fr 1fr; gap:8mm; padding-bottom:1.8mm; font-size:12.10px; font-weight:800; }.jc-signature-field { min-height:11mm; padding-top:5mm; border-bottom:.25mm solid #59212a; }
        .jc-damage-page { height:283mm; display:flex; align-items:center; justify-content:center; break-inside:avoid; page-break-inside:avoid; }.jc-damage-page img { display:block; width:100%; height:auto; max-width:100%; max-height:100%; object-fit:contain; }
        @media screen and (max-width:768px) { .jc-page-shell { display:flex; flex-direction:column; align-items:center; overflow-x:hidden; } .jc-page { margin:0 !important; } }
        @media screen and (max-width:768px) and (min-width:601px) { .jc-page { zoom:.85; } }
        @media screen and (max-width:600px) and (min-width:421px) { .jc-page { zoom:.6; } }
        @media screen and (max-width:420px) { .jc-page { zoom:.45; } }
        @media print { html, body { width:210mm; min-height:297mm; margin:0 !important; padding:0 !important; background:#fff !important; } .jc-page-shell { width:196mm !important; margin:0 auto !important; padding:0 !important; } .jc-page { margin:0 !important; } .print-hidden { display:none !important; } }
      ` }} />
      <article className="jc-page jc-page-one">
        <header className="jc-header">
          <Image unoptimized width={559} height={157} loading="eager" src="/images/logo.webp" alt="Workshop logo" className="jc-logo" />
          <div className="jc-title">JOB CARD<small>بطاقة عمل · WORKSHOP SERVICE RECORD</small></div>
          <div className="jc-number">JOB NO. / رقم البطاقة<strong>{job.id?.slice(-8)?.toUpperCase() || "—"}</strong></div>
        </header>

        <section className="jc-section"><div className="jc-section-title">Customer & Job Details / بيانات العميل والبطاقة</div><div className="jc-grid">
          <Field label="Customer / العميل" value={job.customer?.name} /><Field label="Phone / الهاتف" value={job.customer?.phone} /><Field label="Date / التاريخ" value={formatDisplayDate(job.date || job.createdAt)} /><Field label="Expected completion / التسليم المتوقع" value={job.expectedFinishDate ? formatDisplayDate(job.expectedFinishDate) : null} />
        </div></section>

        <section className="jc-section"><div className="jc-section-title">Vehicle Details / بيانات المركبة</div><div className="jc-vehicle-grid">
          <Field label="Vehicle / المركبة" value={`${job.vehicle?.brand || ""} ${job.vehicle?.model || ""}`.trim()} /><Field label="Plate no. / رقم اللوحة" value={job.vehicle?.plateNumber} /><Field label="Vehicle KM / كيلومترات المركبة" value={job.vehicleKm} />
        </div><div className="jc-text"><b>Complaint / الشكوى:</b><br />{dash(job.complaint)}</div>{job.notes && <div className="jc-text"><b>Notes & remarks / ملاحظات:</b><br />{job.notes}</div>}</section>

        <section className="jc-section"><div className="jc-section-title">Service & Parts Details / تفاصيل الخدمات والقطع</div><table className="jc-items"><thead><tr><th className="number">#</th><th className="type">Type / النوع</th><th>Description / الوصف</th><th className="qty">Qty / الكمية</th>{!job.hideServicePartsAmounts && <><th className="money">Rate / السعر</th><th className="money">Amount / الإجمالي</th></>}</tr></thead><tbody>
          {items.length ? items.map((item, index: number) => <tr key={item.id}><td className="number">{index + 1}</td><td className="type">{item.type}</td><td>{item.name}</td><td className="qty">{item.quantity}</td>{!job.hideServicePartsAmounts && <><td className="money"><Currency amount={item.price} /></td><td className="money"><Currency amount={("amount" in item ? item.amount : item.price * item.quantity)} /></td></>}</tr>) : <tr><td colSpan={job.hideServicePartsAmounts ? 4 : 6} style={{ textAlign: "center" }}>No services or parts listed / لا توجد خدمات أو قطع مضافة</td></tr>}
        </tbody></table>{otherCharges.length > 0 && <div className="jc-text"><b>Other charges / رسوم أخرى:</b><br />{otherCharges.map((charge, index: number) => <div key={index}>{charge.description} — <Currency amount={Number(charge.amount) || 0} /></div>)}</div>}<div className="jc-totals">{!job.hideServicePartsAmounts && <div className="jc-totals-note">Service total: <Currency amount={servicesTotal} /> &nbsp;·&nbsp; Parts total: <Currency amount={partsTotal} /> &nbsp;·&nbsp; Other charges: <Currency amount={otherChargesTotal} /></div>}<div className="jc-totals-values" style={job.hideServicePartsAmounts ? { gridColumn: "1 / -1", borderLeft: 0 } : undefined}><div className="jc-total"><span>Grand total</span><Currency amount={grandTotal} /></div><div className="jc-total"><span>Advance paid</span><Currency amount={job.advancePaid || 0} /></div><div className="jc-total"><span>Balance amount</span><Currency amount={balance} /></div></div></div></section>

        <JobCardTermsAndConditions />
        <footer className="jc-section jc-footer"><div className="jc-signatures"><div className="jc-signature-approval"><div className="jc-signature-field">Customer signature / توقيع العميل</div><div className="jc-signature-field">Authorized signature / توقيع معتمد</div></div><div className="jc-signature">Foreman / الملاحظ</div><div className="jc-signature">Receptionist / موظف الاستقبال</div><div className="jc-signature">Workshop Manager / مدير الورشة</div></div></footer>
      </article>
      <article className="jc-page jc-damage-page"><Image unoptimized width={1054} height={1492} loading="eager" src="/images/jobcard/car.webp" alt="Vehicle damage inspection diagram" /></article>
      <div className="print-hidden"><PrintButton /></div>
    </main>
  );
}
