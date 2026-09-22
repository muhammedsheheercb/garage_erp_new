"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { endOfDay } from "date-fns"
import { DateRange } from "react-day-picker"
import { deleteDirectSale, getDirectSaleById, getDirectSales } from "../actions"
import { DirectSaleForm } from "./direct-sale-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DatePickerWithRange } from "@/components/ui/date-range-picker"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Edit, Eye, Plus, Printer, Search, Trash, X } from "lucide-react"
import { toast } from "sonner"
import { formatDisplayDate } from "@/lib/date-format"
import { useRouter } from "next/navigation"

export function DirectSaleList() {
  const router = useRouter()
  const client = useQueryClient()
  const [search, setSearch] = useState("")
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [createOpen, setCreateOpen] = useState(false)
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const fromDate = dateRange?.from?.toISOString()
  const toDate = dateRange?.to ? endOfDay(dateRange.to).toISOString() : undefined
  const { data, isLoading } = useQuery({ queryKey: ["direct-sales", search, fromDate, toDate], queryFn: () => getDirectSales(1, search, fromDate, toDate) })
  const { data: editing } = useQuery({ queryKey: ["direct-sale", editingId], queryFn: () => getDirectSaleById(editingId!), enabled: !!editingId })
  const { data: viewing } = useQuery({ queryKey: ["direct-sale", viewingId], queryFn: () => getDirectSaleById(viewingId!), enabled: !!viewingId })
  const deletion = useMutation({ mutationFn: deleteDirectSale, onSuccess: () => { toast.success("Direct sale deleted and stock restored."); client.invalidateQueries({ queryKey: ["direct-sales"] }) }, onError: (error: Error) => toast.error(error.message) })
  const resetFilters = () => { setSearch(""); setDateRange(undefined) }
  const openBill = (id: string) => router.push(`/direct-sales/${id}/print`)
  return <div className="space-y-5">
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-4 shadow-sm lg:flex-row lg:items-end lg:justify-between">
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end lg:max-w-3xl">
        <div className="w-full space-y-1.5 sm:max-w-sm"><label className="text-xs font-medium text-muted-foreground">Search</label><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Customer, mobile, or vehicle..." value={search} onChange={event => setSearch(event.target.value)} /></div></div>
        <div className="w-full space-y-1.5 sm:w-auto"><label className="text-xs font-medium text-muted-foreground">Sale Date</label><DatePickerWithRange date={dateRange} setDate={setDateRange} /></div>
        {(search || dateRange) && <Button variant="outline" className="shrink-0" onClick={resetFilters}><X className="mr-2 h-4 w-4" />Clear</Button>}
      </div>
      <Button className="w-full shrink-0 lg:w-auto" onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" />Direct Sale</Button>
    </div>
    <div className="overflow-x-auto rounded-lg border bg-card shadow-sm"><table className="w-full min-w-[760px] text-sm"><thead className="bg-muted/70"><tr className="border-b"><th className="p-3 text-left font-semibold">Sale #</th><th className="text-left font-semibold">Sale Date</th><th className="text-left font-semibold">Customer</th><th className="text-left font-semibold">Vehicle</th><th className="text-right font-semibold">Grand Total</th><th className="p-3 text-right font-semibold">Actions</th></tr></thead><tbody>{isLoading ? <tr><td className="h-24 p-3 text-center text-muted-foreground" colSpan={6}>Loading...</td></tr> : !data?.data.length ? <tr><td className="h-24 p-3 text-center text-muted-foreground" colSpan={6}>No direct sales found.</td></tr> : data.data.map(sale => <tr className="border-b border-border/70 bg-card transition-colors hover:bg-muted/40" key={sale.id}><td className="p-3 font-medium">DS-{sale.id.split("-")[0].toUpperCase()}</td><td>{formatDisplayDate(sale.saleDate)}</td><td>{sale.customerName}<span className="block text-xs text-muted-foreground">{sale.customerMobile || "—"}</span></td><td>{sale.vehicleNumber}</td><td className="text-right font-medium">{sale.grandTotal}</td><td className="p-2 text-right whitespace-nowrap"><Button variant="ghost" size="icon" title="View bill" onClick={() => setViewingId(sale.id)}><Eye className="h-4 w-4" /></Button><Button variant="ghost" size="icon" title="Edit" onClick={() => setEditingId(sale.id)}><Edit className="h-4 w-4" /></Button><Button variant="ghost" size="icon" title="Print bill" onClick={() => openBill(sale.id)}><Printer className="h-4 w-4" /></Button><AlertDialog><AlertDialogTrigger render={<Button variant="ghost" size="icon" className="text-destructive"><Trash className="h-4 w-4" /></Button>} /><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete this direct sale?</AlertDialogTitle><AlertDialogDescription>This permanently removes the bill and restores its quantities to inventory.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive" onClick={() => deletion.mutate(sale.id)}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></td></tr>)}</tbody></table></div>
    <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent className="max-h-[92dvh] overflow-y-auto"><DialogHeader><DialogTitle>New Direct Sale</DialogTitle></DialogHeader><DirectSaleForm onSuccess={() => setCreateOpen(false)} /></DialogContent></Dialog>
    <Dialog open={!!viewingId} onOpenChange={open => !open && setViewingId(null)}><DialogContent className="max-h-[85dvh] max-w-5xl overflow-y-auto sm:max-w-5xl"><DialogHeader><DialogTitle>Direct Sale Bill</DialogTitle></DialogHeader>{viewing && <SaleDetails sale={viewing} />}</DialogContent></Dialog>
    <Dialog open={!!editingId} onOpenChange={open => !open && setEditingId(null)}><DialogContent className="max-h-[92dvh] overflow-y-auto"><DialogHeader><DialogTitle>Edit Direct Sale</DialogTitle></DialogHeader>{editing && <DirectSaleForm initialData={editing} onSuccess={() => setEditingId(null)} />}</DialogContent></Dialog>
  </div>
}

function SaleDetails({ sale }: { sale: any }) { return <div className="space-y-4"><div className="grid gap-3 rounded-lg bg-muted/50 p-4 sm:grid-cols-3"><div><p className="text-xs text-muted-foreground">Customer</p><p className="font-medium">{sale.customerName}</p></div><div><p className="text-xs text-muted-foreground">Vehicle Number</p><p className="font-medium">{sale.vehicleNumber}</p></div><div><p className="text-xs text-muted-foreground">Sale Date</p><p className="font-medium">{formatDisplayDate(sale.saleDate)}</p></div></div><div className="overflow-x-auto rounded-md border"><table className="w-full min-w-[700px] text-sm"><thead className="bg-muted"><tr><th className="p-3 text-left">Product / Batch</th><th>Qty</th><th>Sales Price</th><th>VAT %</th><th>VAT Amount</th><th className="text-right">Total</th></tr></thead><tbody>{sale.items.map((item: any) => { const vat = item.quantity * item.salesPrice * item.vat / 100; return <tr className="border-t" key={item.id}><td className="p-3">{item.batch.inventory.itemName}<span className="block text-xs text-muted-foreground">{item.batch.inventory.partNumber} · Batch {item.batch.batchNumber}</span></td><td className="text-center">{item.quantity}</td><td className="text-center">{item.salesPrice}</td><td className="text-center">{item.vat}%</td><td className="text-center">{vat}</td><td className="pr-3 text-right font-medium">{item.totalAmount}</td></tr> })}</tbody></table></div><div className="ml-auto max-w-xs space-y-1 text-sm"><div className="flex justify-between"><span>Subtotal</span><span>{sale.subTotal}</span></div><div className="flex justify-between"><span>Discount</span><span>-{sale.discount}</span></div><div className="flex justify-between"><span>Total VAT</span><span>{sale.tax}</span></div><div className="flex justify-between border-t pt-2 font-bold"><span>Grand Total</span><span>{sale.grandTotal}</span></div></div></div> }
