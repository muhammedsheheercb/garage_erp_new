import { TableSkeleton } from "@/components/ui/skeleton-loaders"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function TableModuleLoading() {
  return (
    <div className="min-h-screen bg-muted/40 p-4 md:p-8">
      <div className="max-w-screen-2xl mx-auto space-y-6">
        <div className="flex flex-col gap-4">
          <div>
            <Button variant="ghost" size="sm" className="pl-0 gap-1 text-muted-foreground" disabled>
              <ArrowLeft className="h-4 w-4" /> Back to Dashboard
            </Button>
          </div>
          <div>
            <div className="h-9 w-48 bg-muted animate-pulse rounded-md mb-2"></div>
            <div className="h-5 w-96 bg-muted animate-pulse rounded-md"></div>
          </div>
        </div>
        
        <TableSkeleton />
      </div>
    </div>
  )
}
