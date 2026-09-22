"use client"

import { useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"

export function PrintButton() {
  useEffect(() => {
    // Automatically open print dialog when page loads
    setTimeout(() => {
      window.print()
    }, 500)
  }, [])

  return (
    <div className="fixed top-4 left-4 right-4 z-50 flex justify-between gap-3 print:hidden sm:left-8 sm:right-8">
      <Link href="/jobcards">
        <Button variant="outline" className="flex-1 bg-background shadow-lg sm:flex-none">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
      </Link>
      <Button onClick={() => window.print()} className="flex-1 shadow-lg sm:flex-none">
        <Printer className="mr-2 h-4 w-4" /> Print
      </Button>
    </div>
  )
}
