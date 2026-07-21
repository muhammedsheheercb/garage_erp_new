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
    <div className="min-h-screen bg-muted/40 p-4 md:p-8 print:bg-white print:p-0">
      <div className="max-w-screen-2xl mx-auto space-y-6 print:space-y-0">
        <div className="flex flex-col gap-4 print:hidden">
        </div>
        
        <ReportsDashboard />
      </div>
    </div>
  )
}
