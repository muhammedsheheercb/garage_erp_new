"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle, RotateCcw } from "lucide-react"
import "@/app/globals.css" // Ensure styles are loaded for global error

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Global Application Error:", error)
  }, [error])

  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        <div className="flex w-full max-w-md flex-col items-center justify-center space-y-6 text-center border rounded-xl p-8 shadow-lg bg-card">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">A Critical Error Occurred</h1>
            <p className="text-sm text-muted-foreground">
              We encountered a severe problem preventing the application from loading.
            </p>
          </div>

          <Button onClick={() => reset()} size="lg" className="w-full mt-4">
            <RotateCcw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </div>
      </body>
    </html>
  )
}
