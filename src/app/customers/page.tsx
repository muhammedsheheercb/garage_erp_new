import { CustomerList } from "@/features/customers/components/customer-list"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import { ModulePageWrapper } from "@/components/module-page-wrapper"

export default async function CustomersPage() {
  const session = await getSession()
  
  if (!session) {
    redirect('/login')
  }

  return (
    <ModulePageWrapper titleKey="customers.title" descriptionKey="customers.description">
      <CustomerList />
    </ModulePageWrapper>
  )
}
