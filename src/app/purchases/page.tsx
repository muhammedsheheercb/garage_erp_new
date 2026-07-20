import { PurchaseList } from "@/features/purchases/components/purchase-list"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

export default async function PurchasesPage() {
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
            <h1 className="text-3xl font-bold tracking-tight">Purchases</h1>
            <p className="text-muted-foreground mt-1">
              Manage inventory purchase orders, track supplier invoices, adjust ledger balances, and automatically recalculate inventory stock levels and pricing.
            </p>
          </div>
        </div>
        
        <PurchaseList />
      </div>
    </div>
  )
}
