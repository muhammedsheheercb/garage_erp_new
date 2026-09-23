import { notFound } from "next/navigation"
import { getQuotationById } from "@/features/quotations/actions"
import { getSettings } from "@/features/settings/actions"
import { QuotationPrintClient } from "./quotation-print-client"

export default async function QuotationPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [quotation, settings] = await Promise.all([getQuotationById(id), getSettings()])
  if (!quotation) notFound()
  return <QuotationPrintClient quotation={quotation} settings={settings} />
}
