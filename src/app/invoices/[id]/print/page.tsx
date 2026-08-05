import { getInvoiceById } from "@/features/invoices/actions"
import { notFound } from "next/navigation"
import { InvoicePrintClient } from "./invoice-print-client"

export default async function PrintInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const invoice = await getInvoiceById(id)
  if (!invoice) return notFound()

  let otherChargesList: Array<{ name: string; amount: number }> = []
  if (invoice.otherCharges) {
    try {
      const parsed = JSON.parse(invoice.otherCharges)
      if (Array.isArray(parsed)) otherChargesList = parsed
    } catch {}
  }

  return <InvoicePrintClient invoice={invoice} otherChargesList={otherChargesList} />
}
