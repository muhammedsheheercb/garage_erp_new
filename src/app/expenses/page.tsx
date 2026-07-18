import { ExpenseList } from "@/features/expenses/components/expense-list"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Expenses - Garage ERP",
  description: "Manage garage expenses and reports",
}

export default async function ExpensesPage() {
  const session = await auth()
  
  if (!session) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-muted/40 p-4 md:p-8">
      <div className="max-w-screen-2xl mx-auto space-y-6">
        <div className="flex flex-col gap-4">
          <div>
            <Link href="/" passHref>
              <Button variant="ghost" size="sm" className="pl-0 gap-1 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" /> Back to Dashboard
              </Button>
            </Link>
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Expenses</h1>
            <p className="text-muted-foreground mt-1">
              Manage your garage expenses and view monthly reports.
            </p>
          </div>
        </div>
        
        <ExpenseList />
      </div>
    </div>
  )
}
