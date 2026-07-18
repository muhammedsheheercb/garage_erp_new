import { ReportsDashboard } from "@/features/reports/components/reports-dashboard"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Reports & Analytics - Garage ERP",
  description: "View garage performance reports and analytics",
}

export default async function ReportsPage() {
  const session = await auth()
  
  if (!session) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-muted/40 p-4 md:p-8 print:bg-white print:p-0">
      <div className="max-w-screen-2xl mx-auto space-y-6 print:space-y-0">
        <div className="flex flex-col gap-4 print:hidden">
          <div>
            <Link href="/" passHref>
              <Button variant="ghost" size="sm" className="pl-0 gap-1 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" /> Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>
        
        <ReportsDashboard />
      </div>
    </div>
  )
}
