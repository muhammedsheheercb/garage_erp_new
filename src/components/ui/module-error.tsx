"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertCircle, RotateCcw } from "lucide-react"

export default function ModuleError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Module Error:", error)
  }, [error])

  return (
    <div className="flex h-[50vh] w-full flex-col items-center justify-center space-y-4 p-8 text-center rounded-xl border bg-muted/20">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle className="h-6 w-6 text-destructive" />
      </div>
      
      <div className="space-y-1">
        <h3 className="text-xl font-semibold tracking-tight">Failed to load module data</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          An error occurred while loading this section. Please try again.
        </p>
      </div>

      <Button onClick={() => reset()} variant="outline" className="mt-2">
        <RotateCcw className="mr-2 h-4 w-4" />
        Retry
      </Button>
    </div>
  )
}
