import { ServiceList } from "@/features/services/components/service-list"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import { ModulePageWrapper } from "@/components/module-page-wrapper"

export default async function ServicesPage() {
  const session = await getSession()
  
  if (!session) {
    redirect('/login')
  }

  return (
    <ModulePageWrapper titleKey="services.title" descriptionKey="services.description">
      <ServiceList />
    </ModulePageWrapper>
  )
}
