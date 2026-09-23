import { getPaymentBill } from "@/features/payments/actions"
import { InvoicePrintClient } from "@/app/invoices/[id]/print/invoice-print-client"
import { notFound } from "next/navigation"

export default async function PaymentInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const payment = await getPaymentBill(id)
  if (!payment?.jobCard) notFound()
  const job = payment.jobCard
  let otherChargesList: Array<{ name: string; amount: number }> = []
  try { otherChargesList = JSON.parse(job.otherCharges || "[]").map((charge: any) => ({ name: charge.description, amount: Number(charge.amount) || 0 })) } catch {}
  return <InvoicePrintClient invoice={{
    id: payment.id, createdAt: payment.createdAt, payments: job.payments, grandTotal: job.grandTotal,
    serviceCharge: job.serviceTotal, labourCharge: 0, partsCost: job.partsTotal,
    subTotal: job.serviceTotal + job.partsTotal + otherChargesList.reduce((sum, charge) => sum + charge.amount, 0),
    discount: job.discount, tax: job.tax,
    servicesDetails: job.services.map(item => item.service.name).join("\n"),
    partsDetails: job.parts.map(item => `${item.batch?.inventory.itemName || "Pending part"} (${item.quantity})`).join("\n"),
    customer: job.customer, jobCard: { complaint: job.complaint, workDone: job.workDone, vehicle: job.vehicle, tax: job.tax, hideServicePartsAmounts: job.hideServicePartsAmounts },
  }} otherChargesList={otherChargesList} />
}
