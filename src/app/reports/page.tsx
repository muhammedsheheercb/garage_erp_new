import { ReportsDashboard } from "@/features/reports/components/reports-dashboard"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import { ModulePageWrapper } from "@/components/module-page-wrapper"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Reports & Analytics - Garage ERP",
  description: "View garage performance reports and analytics",
}

export default async function ReportsPage() {
  const session = await getSession()
  
  if (!session) {
    redirect('/login')
  }

  return (
    <ModulePageWrapper titleKey="reportsMod.title" descriptionKey="reportsMod.description">
      <ReportsDashboard />
    </ModulePageWrapper>
  )
}
