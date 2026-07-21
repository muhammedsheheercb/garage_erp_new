import { VehicleList } from "@/features/vehicles/components/vehicle-list"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import { ModulePageWrapper } from "@/components/module-page-wrapper"

export default async function VehiclesPage() {
  const session = await getSession()
  
  if (!session) {
    redirect('/login')
  }

  return (
    <ModulePageWrapper titleKey="vehicles.title" descriptionKey="vehicles.description">
      <VehicleList />
    </ModulePageWrapper>
  )
}
