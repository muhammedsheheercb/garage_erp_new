import { InvoiceList } from "@/features/invoices/components/invoice-list"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import { ModulePageWrapper } from "@/components/module-page-wrapper"

export const metadata = {
  title: "Invoices | Garage ERP",
  description: "Manage your garage invoices",
}

export default async function InvoicesPage() {
  const session = await getSession()
  
  if (!session) {
    redirect('/login')
  }

  return (
    <ModulePageWrapper titleKey="invoicesMod.title" descriptionKey="invoicesMod.description">
      <InvoiceList />
    </ModulePageWrapper>
  )
}
