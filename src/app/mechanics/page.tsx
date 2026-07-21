import { MechanicList } from "@/features/mechanics/components/mechanic-list"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import { ModulePageWrapper } from "@/components/module-page-wrapper"

export default async function MechanicsPage() {
  const session = await getSession()
  
  if (!session) {
    redirect('/login')
  }

  return (
    <ModulePageWrapper titleKey="mechanics.title" descriptionKey="mechanics.description">
      <MechanicList />
    </ModulePageWrapper>
  )
}
