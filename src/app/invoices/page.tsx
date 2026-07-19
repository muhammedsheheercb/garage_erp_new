import { InvoiceList } from "@/features/invoices/components/invoice-list"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

export const metadata = {
  title: "Invoices | Garage ERP",
  description: "Manage your garage invoices",
}

export default async function InvoicesPage() {
  const session = await getSession()
  
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
            <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
            <p className="text-muted-foreground mt-1">
              Create, view, and manage customer invoices.
            </p>
          </div>
        </div>
        
        <InvoiceList />
      </div>
    </div>
  )
}
