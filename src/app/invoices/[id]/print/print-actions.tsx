"use client"

import { Button } from "@/components/ui/button"
import { Printer, ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"

export function PrintActions() {
  const router = useRouter()
  return (
    <div className="flex justify-between print:hidden mb-8 gap-4">
      <Button variant="outline" onClick={() => router.back()}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>
      <Button onClick={() => window.print()}>
        <Printer className="mr-2 h-4 w-4" /> Print / Download PDF
      </Button>
    </div>
  )
}
