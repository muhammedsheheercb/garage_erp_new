import { ModulePageWrapper } from "@/components/module-page-wrapper"
import { QuotationList } from "@/features/quotations/components/quotation-list"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"

export default async function QuotationsPage() {
  if (!await getSession()) redirect("/login")
  return <ModulePageWrapper titleKey="Quotations" descriptionKey="Create and manage service quotations"><QuotationList /></ModulePageWrapper>
}
