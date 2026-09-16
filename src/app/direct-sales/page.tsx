import { DirectSaleList } from "@/features/direct-sales/components/direct-sale-list"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import { ModulePageWrapper } from "@/components/module-page-wrapper"

export default async function DirectSalesPage() {
  if (!await getSession()) redirect("/login")
  return <ModulePageWrapper titleKey="nav.directSales" descriptionKey="directSales.description"><DirectSaleList /></ModulePageWrapper>
}
