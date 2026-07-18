"use client"

import { useEffect } from "react"
import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"

export function PrintButton() {
  useEffect(() => {
    // Automatically open print dialog when page loads
    setTimeout(() => {
      window.print()
    }, 500)
  }, [])

  return (
    <div className="fixed bottom-8 right-8 print:hidden">
      <Button onClick={() => window.print()} size="lg" className="shadow-lg rounded-full h-14 w-14 p-0">
        <Printer className="h-6 w-6" />
      </Button>
    </div>
  )
}
