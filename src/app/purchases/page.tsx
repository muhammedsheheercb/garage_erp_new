import { PurchaseList } from "@/features/purchases/components/purchase-list"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import { ModulePageWrapper } from "@/components/module-page-wrapper"

export default async function PurchasesPage() {
  const session = await getSession()
  
  if (!session) {
    redirect('/login')
  }

  return (
    <ModulePageWrapper titleKey="purchasesMod.title" descriptionKey="purchasesMod.description">
      <PurchaseList />
    </ModulePageWrapper>
  )
}
