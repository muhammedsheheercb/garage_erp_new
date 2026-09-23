"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { endOfDay } from "date-fns"
import { type DateRange } from "react-day-picker"
import { Check, Edit, Eye, Plus, Printer, Search, Trash, X } from "lucide-react"
import { toast } from "sonner"
import { acceptQuotation, deleteQuotation, getQuotationById, getQuotations } from "../actions"
import { QuotationForm } from "./quotation-form"
import { QuotationDetails } from "./quotation-details"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { DatePickerWithRange } from "@/components/ui/date-range-picker"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"

type QuotationStatusFilter = "" | "PENDING" | "CONVERTED"

export function QuotationList() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<QuotationStatusFilter>("")
  const [quotationDateRange, setQuotationDateRange] = useState<DateRange | undefined>()
  const [validUntilDateRange, setValidUntilDateRange] = useState<DateRange | undefined>()
  const [addOpen, setAddOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [viewId, setViewId] = useState<string | null>(null)

  const quotationFromDate = quotationDateRange?.from?.toISOString()
  const quotationToDate = quotationDateRange?.to ? endOfDay(quotationDateRange.to).toISOString() : undefined
  const validUntilFromDate = validUntilDateRange?.from?.toISOString()
  const validUntilToDate = validUntilDateRange?.to ? endOfDay(validUntilDateRange.to).toISOString() : undefined
  const hasActiveFilters = Boolean(status || quotationDateRange?.from || validUntilDateRange?.from)

  const { data: quotations = [], isLoading } = useQuery({
    queryKey: ["quotations", search, status, quotationFromDate, quotationToDate, validUntilFromDate, validUntilToDate],
    queryFn: () => getQuotations(search, status, quotationFromDate, quotationToDate, validUntilFromDate, validUntilToDate),
  })
  const { data: editing } = useQuery({ queryKey: ["quotation", editId], queryFn: () => getQuotationById(editId!), enabled: Boolean(editId) })
  const { data: viewing, isLoading: isViewing } = useQuery({ queryKey: ["quotation", viewId], queryFn: () => getQuotationById(viewId!), enabled: Boolean(viewId) })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["quotations"] })
  const reject = useMutation({ mutationFn: deleteQuotation, onSuccess: () => { toast.success("Quotation rejected and removed"); refresh() }, onError: () => toast.error("Unable to reject quotation") })
  const accept = useMutation({ mutationFn: acceptQuotation, onSuccess: (_, id) => { toast.success("Quotation accepted"); refresh(); router.push(`/jobcards?quotation=${id}`) }, onError: () => toast.error("Unable to accept quotation") })

  const resetFilters = () => {
    setStatus("")
    setQuotationDateRange(undefined)
    setValidUntilDateRange(undefined)
  }

  return <div className="space-y-4">
    <div className="flex flex-col justify-between gap-3 sm:flex-row">
      <div className="relative w-full sm:max-w-sm"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-8" placeholder="Search quotations" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
      <Dialog open={addOpen} onOpenChange={setAddOpen}><DialogTrigger render={<Button className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" />Create Quotation</Button>} /><DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-7xl overflow-x-hidden overflow-y-auto p-3 sm:max-h-[90vh] sm:w-[calc(100vw-2rem)] sm:max-w-7xl sm:p-6"><DialogHeader><DialogTitle>New Quotation</DialogTitle></DialogHeader><QuotationForm onSuccess={() => setAddOpen(false)} /></DialogContent></Dialog>
    </div>

    <div className="rounded-md border bg-card p-3 sm:p-4">
      <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(10rem,1fr)_auto_auto_auto]">
        <div className="w-full space-y-1.5"><label className="px-1 text-xs font-medium text-muted-foreground">Status</label><Select value={status} onValueChange={(value) => setStatus(value as QuotationStatusFilter)}><SelectTrigger className="w-full"><SelectValue placeholder="All statuses" /></SelectTrigger><SelectContent><SelectItem value="">All</SelectItem><SelectItem value="PENDING">Pending</SelectItem><SelectItem value="CONVERTED">Accepted</SelectItem></SelectContent></Select></div>
        <div className="w-full space-y-1.5 sm:w-auto"><label className="px-1 text-xs font-medium text-muted-foreground">Quotation Date</label><DatePickerWithRange date={quotationDateRange} setDate={setQuotationDateRange} placeholder="Quotation date range" /></div>
        <div className="w-full space-y-1.5 sm:w-auto"><label className="px-1 text-xs font-medium text-muted-foreground">Valid Until</label><DatePickerWithRange date={validUntilDateRange} setDate={setValidUntilDateRange} placeholder="Valid until date range" /></div>
        <Button type="button" variant="outline" className="w-full sm:w-auto" disabled={!hasActiveFilters} onClick={resetFilters}><X className="mr-2 h-4 w-4" />Clear filters</Button>
      </div>
    </div>

    <div className="overflow-x-auto rounded-md border bg-card"><Table><TableHeader><TableRow><TableHead>Quotation</TableHead><TableHead>Customer / Vehicle</TableHead><TableHead>Valid Until</TableHead><TableHead>Status</TableHead><TableHead>Estimated Price</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{isLoading ? <TableRow><TableCell colSpan={6} className="h-24 text-center">Loading...</TableCell></TableRow> : !quotations.length ? <TableRow><TableCell colSpan={6} className="h-24 text-center">No quotations found</TableCell></TableRow> : quotations.map((quote) => <TableRow key={quote.id}><TableCell className="font-mono font-medium">{quote.id.slice(-8).toUpperCase()}</TableCell><TableCell><div>{quote.customer.name}</div><div className="text-sm text-muted-foreground">{quote.vehicle.plateNumber} · {quote.vehicle.brand} {quote.vehicle.model}</div></TableCell><TableCell>{new Date(quote.validUntil).toLocaleDateString()}</TableCell><TableCell><Badge variant={quote.status === "PENDING" ? "outline" : "default"}>{quote.status}</Badge></TableCell><TableCell>{quote.grandTotal.toFixed(3)} OMR</TableCell><TableCell className="space-x-1 text-right"><Dialog open={viewId === quote.id} onOpenChange={(open) => !open && setViewId(null)}><DialogTrigger render={<Button variant="ghost" size="icon" title="View quotation" aria-label="View quotation" onClick={() => setViewId(quote.id)}><Eye className="h-4 w-4" /></Button>} />{viewId === quote.id && <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] overflow-y-auto p-4 sm:max-w-4xl sm:p-6"><DialogHeader><DialogTitle>Quotation Details</DialogTitle></DialogHeader>{isViewing ? <div className="py-12 text-center text-muted-foreground">Loading quotation details...</div> : viewing && <QuotationDetails quotation={viewing} onPrint={() => router.push("/quotations/" + viewing.id + "/print")} />}</DialogContent>}</Dialog><Button variant="outline" size="sm" title="Print quotation" onClick={() => router.push("/quotations/" + quote.id + "/print")}><Printer className="mr-2 h-4 w-4" />Print</Button>
      {quote.status === "PENDING" && <><AlertDialog><AlertDialogTrigger render={<Button variant="ghost" size="icon" title="Accept quotation"><Check className="h-4 w-4 text-green-600" /></Button>} /><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Accept this quotation?</AlertDialogTitle><AlertDialogDescription>The Job Card form will open with the quotation details. Current stock will be checked there.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => accept.mutate(quote.id)}>Accept Quotation</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog><AlertDialog><AlertDialogTrigger render={<Button variant="ghost" size="icon" title="Reject quotation"><X className="h-4 w-4 text-destructive" /></Button>} /><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Reject this quotation?</AlertDialogTitle><AlertDialogDescription>This permanently deletes the quotation.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => reject.mutate(quote.id)}>Reject & Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></>}
      {quote.status === "PENDING" && <Dialog open={editId === quote.id} onOpenChange={(open) => !open && setEditId(null)}><DialogTrigger render={<Button variant="ghost" size="icon" onClick={() => setEditId(quote.id)}><Edit className="h-4 w-4" /></Button>} />{editId === quote.id && <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-7xl overflow-x-hidden overflow-y-auto p-3 sm:max-h-[90vh] sm:w-[calc(100vw-2rem)] sm:max-w-7xl sm:p-6"><DialogHeader><DialogTitle>Edit Quotation</DialogTitle></DialogHeader>{editing && <QuotationForm initialData={editing} onSuccess={() => setEditId(null)} />}</DialogContent>}</Dialog>}
      <AlertDialog><AlertDialogTrigger render={<Button variant="ghost" size="icon"><Trash className="h-4 w-4 text-destructive" /></Button>} /><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete quotation?</AlertDialogTitle><AlertDialogDescription>This permanently deletes the quotation.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => reject.mutate(quote.id)}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </TableCell></TableRow>)}</TableBody></Table></div>
  </div>
}
