import { JobCardList } from "@/features/jobcards/components/jobcard-list"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import { ModulePageWrapper } from "@/components/module-page-wrapper"

export default async function JobCardsPage() {
  const session = await getSession()
  
  if (!session) {
    redirect('/login')
  }

  return (
    <ModulePageWrapper titleKey="jobcards.title" descriptionKey="jobcards.description">
      <JobCardList />
    </ModulePageWrapper>
  )
}
