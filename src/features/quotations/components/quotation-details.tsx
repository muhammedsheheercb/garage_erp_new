"use client"

import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const money = (amount: number) => `${Number(amount || 0).toFixed(3)} OMR`
const date = (value: string | Date) => new Date(value).toLocaleDateString()

export function QuotationDetails({ quotation, onPrint }: { quotation: any; onPrint: () => void }) {
  const services = quotation.services || []
  const parts = quotation.parts || []
  const subtotal = Number(quotation.serviceTotal || 0) + Number(quotation.partsTotal || 0)

  return <div className="space-y-5 text-sm">
    <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between">
      <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Quotation</p><p className="font-mono text-lg font-semibold">{quotation.id.slice(-8).toUpperCase()}</p></div>
      <div className="flex items-center gap-3"><Badge variant={quotation.status === "PENDING" ? "outline" : "default"}>{quotation.status}</Badge><Button type="button" onClick={onPrint}><Printer className="mr-2 h-4 w-4" />Print Quotation</Button></div>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <section className="rounded-md border p-3"><h3 className="mb-2 font-semibold">Customer Details</h3><p>{quotation.customer?.name}</p><p className="text-muted-foreground">{quotation.customer?.phone || "No mobile number"}</p><p className="mt-3 text-xs font-medium uppercase text-muted-foreground">Quotation Date</p><p>{date(quotation.date)}</p></section>
      <section className="rounded-md border p-3"><h3 className="mb-2 font-semibold">Vehicle Details</h3><p>{quotation.vehicle?.brand} {quotation.vehicle?.model}</p><p className="font-mono text-muted-foreground">{quotation.vehicle?.plateNumber}</p><p className="mt-3 text-xs font-medium uppercase text-muted-foreground">Valid Until</p><p>{date(quotation.validUntil)}</p></section>
    </div>
    <section className="rounded-md border"><div className="border-b p-3"><h3 className="font-semibold">Services & Parts</h3></div><div className="overflow-x-auto"><Table className="min-w-[560px]"><TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Price</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader><TableBody>{services.map((item: any) => <TableRow key={item.id}><TableCell>Service</TableCell><TableCell>{item.service?.name}</TableCell><TableCell className="text-right">{item.quantity}</TableCell><TableCell className="text-right">{money(item.price)}</TableCell><TableCell className="text-right">{money(item.quantity * item.price)}</TableCell></TableRow>)}{parts.map((item: any) => <TableRow key={item.id}><TableCell>Part</TableCell><TableCell>{item.inventory?.itemName}{item.inventory?.partNumber ? ` (${item.inventory.partNumber})` : ""}</TableCell><TableCell className="text-right">{item.quantity}</TableCell><TableCell className="text-right">{money(item.price)}</TableCell><TableCell className="text-right">{money(item.quantity * item.price)}</TableCell></TableRow>)}{!services.length && !parts.length && <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No services or parts selected.</TableCell></TableRow>}</TableBody></Table></div></section>
    <div className="grid gap-4 sm:grid-cols-[1fr_18rem]"><div className="rounded-md border p-3"><p className="font-medium">Complaint / Issue</p><p className="mt-1 whitespace-pre-wrap text-muted-foreground">{quotation.complaint}</p>{quotation.notes && <><p className="mt-3 font-medium">Notes</p><p className="mt-1 whitespace-pre-wrap text-muted-foreground">{quotation.notes}</p></>}</div><section className="rounded-md border p-3"><div className="flex justify-between py-1"><span>Services</span><span>{money(quotation.serviceTotal)}</span></div><div className="flex justify-between py-1"><span>Parts</span><span>{money(quotation.partsTotal)}</span></div><div className="flex justify-between py-1"><span>Discount</span><span>Not applied</span></div><div className="mt-2 flex justify-between border-t pt-3 font-semibold"><span>Subtotal</span><span>{money(subtotal)}</span></div><div className="mt-2 flex justify-between text-base font-bold"><span>Grand Total</span><span>{money(quotation.grandTotal)}</span></div></section></div>
  </div>
}
