import { getJobCardBill } from "@/features/payments/actions"
import { InvoicePrintClient } from "@/app/invoices/[id]/print/invoice-print-client"
import { notFound } from "next/navigation"

export default async function JobCardInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const job = await getJobCardBill(id)
  if (!job) notFound()
  let otherChargesList: Array<{ name: string; amount: number }> = []
  try { otherChargesList = JSON.parse(job.otherCharges || "[]").map((charge: any) => ({ name: charge.description, amount: Number(charge.amount) || 0 })) } catch {}
  return <InvoicePrintClient invoice={{
    id: job.id, createdAt: job.createdAt, payments: job.payments, grandTotal: job.grandTotal,
    serviceCharge: job.serviceTotal, labourCharge: 0, partsCost: job.partsTotal,
    subTotal: job.serviceTotal + job.partsTotal + otherChargesList.reduce((sum, charge) => sum + charge.amount, 0),
    discount: job.discount, tax: job.tax,
    servicesDetails: job.services.map(item => item.service.name).join("\n"),
    partsDetails: job.parts.map(item => `${item.batch.inventory.itemName} (${item.quantity})`).join("\n"),
    customer: job.customer,
    jobCard: { complaint: job.complaint, workDone: job.workDone, vehicle: job.vehicle, tax: job.tax, hideServicePartsAmounts: job.hideServicePartsAmounts },
  }} otherChargesList={otherChargesList} />
}
