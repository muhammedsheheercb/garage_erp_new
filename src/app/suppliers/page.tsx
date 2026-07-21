import { SupplierList } from "@/features/suppliers/components/supplier-list"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import { ModulePageWrapper } from "@/components/module-page-wrapper"

export const metadata = {
  title: "Suppliers | Garage ERP",
  description: "Manage your garage suppliers",
}

export default async function SuppliersPage() {
  const session = await getSession()
  
  if (!session) {
    redirect('/login')
  }

  return (
    <ModulePageWrapper titleKey="suppliersMod.title" descriptionKey="suppliersMod.description">
      <SupplierList />
    </ModulePageWrapper>
  )
}
