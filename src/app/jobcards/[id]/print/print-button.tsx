"use client"

import { ArrowLeft, Printer } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export function PrintButton() {
  const router = useRouter()
  return <>
    <style dangerouslySetInnerHTML={{ __html: `
      .print-preview-actions { position:fixed; top:16px; left:16px; right:16px; z-index:9999; display:flex; align-items:center; justify-content:space-between; gap:12px; } .print-preview-actions button:first-child { background:#fff!important; border-color:#6d2931!important; color:#281315!important; } .print-preview-actions button:last-child { background:#8d2634!important; color:#fff!important; }  screen { .jc-page-shell { padding-top:128px!important; } }
      @media (max-width:640px) { .print-preview-actions { align-items:stretch; flex-direction:column; } .print-preview-actions > button { width:100%; } }
      @media print { .print-preview-actions { display:none!important; } }
    ` }} />
    <div className="print-preview-actions">
      <Button type="button" variant="outline" className="bg-background shadow-lg" onClick={() => router.back()}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
      <Button type="button" className="shadow-lg" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print</Button>
    </div>
  </>
}
