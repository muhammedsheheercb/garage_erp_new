import { InventoryList } from "@/features/inventory/components/inventory-list"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import { ModulePageWrapper } from "@/components/module-page-wrapper"

export const metadata = {
  title: "Inventory | Garage ERP",
  description: "Manage your garage inventory and parts",
}

export default async function InventoryPage() {
  const session = await getSession()
  
  if (!session) {
    redirect('/login')
  }

  return (
    <ModulePageWrapper titleKey="inventoryMod.title" descriptionKey="inventoryMod.description">
      <InventoryList />
    </ModulePageWrapper>
  )
}
