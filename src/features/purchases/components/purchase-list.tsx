"use client"

import type { PurchaseView } from "@/lib/view-models"

import { refreshQueries } from "@/lib/refresh-queries"
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getPurchases, deletePurchase, cancelPurchase, getCancelledPurchases } from "../actions"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Plus, Trash, Eye, Edit, ChevronLeft, ChevronRight, Printer, Download, Ban } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { PurchaseForm } from "./purchase-form"
import { toast } from "sonner"
import { endOfDay } from "date-fns"
import { formatDisplayDate } from "@/lib/date-format"
import { useTranslation } from "@/i18n"
import { DatePickerWithRange } from "@/components/ui/date-range-picker"
import { DateRange } from "react-day-picker"
import { useRouter, useSearchParams } from "next/navigation"

export function PurchaseList() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const paramFrom = searchParams.get("from")
  const paramTo = searchParams.get("to")
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isCancelledOpen, setIsCancelledOpen] = useState(false)
  const [viewingPurchase, setViewingPurchase] = useState<PurchaseView | null>(null)
  const [editingPurchase, setEditingPurchase] = useState<PurchaseView | null>(null)
  const [cancelledIds, setCancelledIds] = useState<Set<string>>(() => new Set())
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    if (paramFrom) {
      return {
        from: new Date(paramFrom),
        to: paramTo ? new Date(paramTo) : new Date(paramFrom)
      }
    }
    return undefined
  })

  const fromDateStr = dateRange?.from?.toISOString()
  const toDateStr = dateRange?.to ? endOfDay(dateRange.to).toISOString() : undefined

  const { data, isLoading } = useQuery({
    queryKey: ['purchases', page, search, fromDateStr, toDateStr],
    queryFn: () => getPurchases(page, search, fromDateStr, toDateStr)
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePurchase(id),
    onSuccess: () => {
      void refreshQueries(queryClient, ["supplier", "suppliers", "report-totals", "report-details", "report-chart", "purchase-dropdowns", "direct-sale-stock", "parts-list"]);
      toast.success(t.purchases.purchaseDeletedSuccess)
      queryClient.invalidateQueries({ queryKey: ['purchases'] })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      queryClient.invalidateQueries({ queryKey: ['paymeters'] })
    },
    onError: (error) => {
      toast.error(error.message || t.common.somethingWrong)
    }
  })

  const { data: cancelledPurchases = [], isLoading: isCancelledLoading, isError: isCancelledError } = useQuery({
    queryKey: ['cancelled-purchases'], queryFn: getCancelledPurchases,
  })
  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await cancelPurchase(id)
      if (!result.success) throw new Error(result.error)
      return result
    },
    onSuccess: async (_result, id) => {
      setCancelledIds(previous => new Set(previous).add(id))
      setViewingPurchase(null)
      setEditingPurchase(null)
      await refreshQueries(queryClient, [
        'purchases', 'cancelled-purchases', 'inventory', 'paymeters', 'supplier', 'suppliers',
        'report-totals', 'report-details', 'report-chart', 'dashboard', 'dashboard-stats',
        'jobcards', 'jobcard', 'vehicles', 'invoices', 'payments', 'purchase-dropdowns',
        'direct-sale-stock', 'parts-list', 'pending-jobcards', 'pending-jobcards-dropdown',
        'invoice-dropdowns', 'jobcards-dropdowns',
      ])
      router.refresh()
      toast.success('Purchase cancelled. Stock, linked payments and balances were reversed.')
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const isPurchaseLocked = (id: string) => cancelledIds.has(id) || (cancelMutation.isPending && cancelMutation.variables === id)

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-center">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder={t.purchases.searchPurchases}
            className="pl-8" 
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>

        <DatePickerWithRange 
          date={dateRange} 
          setDate={(newDate) => { setDateRange(newDate); setPage(1); }} 
        />

        <Button variant="outline" className="w-full sm:w-auto" onClick={() => setIsCancelledOpen(true)}>
          <Ban className="mr-2 h-4 w-4" /> Cancelled Purchases
        </Button>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger render={
            <Button className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" /> {t.purchases.registerPurchase}</Button>
          } />
          <DialogContent className="h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-none overflow-y-auto p-3 sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-7xl sm:p-6">
            <DialogHeader>
              <DialogTitle>{t.purchases.registerNewPurchase}</DialogTitle>
            </DialogHeader>
            <PurchaseForm onSuccess={() => setIsAddOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-md overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.purchases.purchaseNo}</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>{t.suppliers.supplierTitle}</TableHead>
              <TableHead>Job Card Details</TableHead>
              <TableHead>Created By</TableHead>
              <TableHead>{t.payments.date}</TableHead>
              <TableHead>{t.invoicesMod.grandTotal}</TableHead>
              <TableHead>{t.purchases.paidAmount}</TableHead>
              <TableHead>{t.purchases.pending}</TableHead>
              <TableHead>{t.purchases.ledger}</TableHead>
              <TableHead className="text-right">{t.common.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={11} className="text-center h-24">{t.common.loading}</TableCell></TableRow>
            ) : !data || data.data.length === 0 ? (
              <TableRow><TableCell colSpan={11} className="text-center h-24">{t.purchases.noPurchases}</TableCell></TableRow>
            ) : (
              data.data.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-semibold">{p.purchaseNumber}</TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-1 rounded ${p.purchaseType === 'VEHICLE' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                      {p.purchaseType}
                    </span>
                  </TableCell>
                  <TableCell>{p.supplier?.name}</TableCell>
                  <TableCell>
                    {p.purchaseType === 'VEHICLE' && p.jobCard ? (
                      <div className="flex flex-col text-xs">
                        <span className="font-medium">{p.jobCard.vehicle.plateNumber}</span>
                        <span className="text-muted-foreground">{p.jobCard.customer.name}</span>
                      </div>
                    ) : '-'}
                  </TableCell>
                  <TableCell className="text-sm font-medium text-muted-foreground">{p.createdBy || "Admin"}</TableCell>
                  <TableCell>{formatDisplayDate(p.purchaseDate)}</TableCell>
                  <TableCell>{(p.grandTotal)} OMR</TableCell>
                  <TableCell className="text-green-600 font-medium">{(p.paidAmount)} OMR</TableCell>
                  <TableCell className={p.pendingAmount > 0 ? "text-destructive font-medium" : "text-muted-foreground"}>
                    {(p.pendingAmount)} OMR
                  </TableCell>
                  <TableCell>{p.paymentMethod?.name || '-'}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" disabled={isPurchaseLocked(p.id)} onClick={() => router.push(`/purchases/${p.id}/print`)} title={t.purchases.downloadInvoice || "Download Purchase Invoice"}>
                      <Printer className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" disabled={isPurchaseLocked(p.id)} onClick={() => setViewingPurchase(p)} title={t.purchases.viewDetails}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" disabled={isPurchaseLocked(p.id)} onClick={() => setEditingPurchase(p)} title={t.common.edit}>
                      <Edit className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger render={
                        <Button variant="ghost" size="icon" disabled={isPurchaseLocked(p.id) || cancelMutation.isPending || deleteMutation.isPending} className="text-destructive hover:text-destructive" title="Cancel Purchase" aria-label="Cancel Purchase">
                          <Ban className="h-4 w-4" />
                        </Button>
                      } />
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Cancel {p.purchaseNumber}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Reverse this {p.grandTotal} OMR purchase, its {p.paidAmount} OMR in linked payments,
                            and its {p.pendingAmount} OMR outstanding balance. Stock and vehicle costs will
                            be updated. Purchased pending parts will return to pending status.
                            This corrects the records; it does not refund money from the supplier.
                            The purchase will remain in cancellation history and cannot be restored.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Keep Purchase</AlertDialogCancel>
                          <AlertDialogAction disabled={isPurchaseLocked(p.id) || cancelMutation.isPending} onClick={() => cancelMutation.mutate(p.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Cancel Purchase
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <AlertDialog>
                      <AlertDialogTrigger render={
                        <Button variant="ghost" size="icon" disabled={isPurchaseLocked(p.id)} className="text-destructive hover:text-destructive" title={t.purchases.deletePurchase}>
                          <Trash className="h-4 w-4" />
                        </Button>
                      } />
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t.purchases.deleteConfirmTitle}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t.purchases.deleteConfirmDesc}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                          <AlertDialogAction disabled={isPurchaseLocked(p.id)} onClick={() => deleteMutation.mutate(p.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            {t.common.delete}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isCancelledOpen} onOpenChange={setIsCancelledOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] max-h-[90vh] overflow-y-auto sm:max-w-7xl">
          <DialogHeader>
            <DialogTitle>Cancelled Purchases</DialogTitle>
          </DialogHeader>
          <p className="my-3 text-sm text-muted-foreground">These original amounts were reversed and are excluded from active balances and reports.</p>
          <p className="text-sm text-muted-foreground">Showing the latest 50 cancellations.</p>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Purchase</TableHead><TableHead>Supplier</TableHead><TableHead>Original total</TableHead>
              <TableHead>Paid reversed</TableHead><TableHead>Balance cleared</TableHead><TableHead>Cancelled on</TableHead><TableHead>Cancelled by</TableHead><TableHead className="text-right">{t.common.actions}</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {isCancelledLoading ? (
                <TableRow><TableCell colSpan={8} className="h-24 text-center">{t.common.loading}</TableCell></TableRow>
              ) : isCancelledError ? (
                <TableRow><TableCell colSpan={8} className="h-24 text-center text-destructive">Unable to load cancelled purchases. Please try again.</TableCell></TableRow>
              ) : cancelledPurchases.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="h-24 text-center">No cancelled purchases.</TableCell></TableRow>
              ) : cancelledPurchases.map(p => (
              <TableRow key={p.id}>
                <TableCell>{p.purchaseNumber} <span className="text-xs text-destructive">CANCELLED</span></TableCell>
                <TableCell>{p.supplierName}</TableCell><TableCell>{p.grandTotal} OMR</TableCell>
                <TableCell>{p.paidAmount} OMR</TableCell><TableCell>{p.pendingAmount} OMR</TableCell>
                <TableCell>{formatDisplayDate(p.cancelledAt)}</TableCell><TableCell>{p.cancelledBy}</TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {[{ Icon: Printer, label: 'Print' }, { Icon: Eye, label: 'View' }, { Icon: Edit, label: 'Edit' }, { Icon: Ban, label: 'Cancel Purchase' }, { Icon: Trash, label: 'Delete' }].map(({ Icon, label }) => (
                    <Button key={label} variant="ghost" size="icon" disabled aria-label={label} title={`${label} unavailable: purchase cancelled`}>
                      <Icon className="h-4 w-4" />
                    </Button>
                  ))}
                </TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      {/* Pagination controls */}
      {data && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-end space-x-2 py-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> {t.common.previous}
          </Button>
          <span className="text-sm font-medium text-muted-foreground">
            {t.common.page} {page} {t.common.of} {data.meta.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(data.meta.totalPages, p + 1))}
            disabled={page === data.meta.totalPages}
          >
            {t.common.next} <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}

      {/* Detail Modal */}
      {viewingPurchase && (
        <Dialog open={!!viewingPurchase} onOpenChange={() => setViewingPurchase(null)}>
          <DialogContent className="max-w-[95vw] sm:max-w-5xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">{t.purchases.purchaseOrderDetails}: {viewingPurchase.purchaseNumber}</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-muted/30 p-4 rounded-lg">
                <div>
                  <span className="text-xs text-muted-foreground block">{t.suppliers.supplierTitle}</span>
                  <span className="font-semibold">{viewingPurchase.supplier?.name}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">{t.purchases.purchaseDate}</span>
                  <span className="font-semibold">{formatDisplayDate(viewingPurchase.purchaseDate)}</span>
                </div>
                {viewingPurchase.purchaseType === 'VEHICLE' && viewingPurchase.jobCard && (
                  <div>
                    <span className="text-xs text-muted-foreground block">Job Card Details</span>
                    <span className="font-semibold block">{viewingPurchase.jobCard.vehicle.plateNumber}</span>
                    <span className="text-xs text-muted-foreground">{viewingPurchase.jobCard.customer.name}</span>
                  </div>
                )}
                <div>
                  <span className="text-xs text-muted-foreground block">{t.purchases.ledgerAccount}</span>
                  <span className="font-semibold">{viewingPurchase.paymentMethod?.name || '-'}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">{t.common.status}</span>
                  <span className={`inline-block px-2 py-0.5 rounded text-xs mt-1 ${viewingPurchase.pendingAmount === 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {viewingPurchase.pendingAmount === 0 ? "PAID" : "PENDING PAYMENT"}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-base mb-2">{t.purchases.purchasedItems}</h4>
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t.purchases.partName}</TableHead>
                        <TableHead>{t.inventoryMod.partNo}</TableHead>
                        <TableHead className="text-center">{t.invoicesMod.qty}</TableHead>
                        <TableHead className="text-right">{t.purchases.purchasePrice}</TableHead>
                        <TableHead className="text-right">{t.purchases.sellingPrice}</TableHead>
                        <TableHead className="text-right">{t.purchases.productAmount || "Amount"}</TableHead>
                        <TableHead className="text-center">{t.purchases.taxRate || "Tax %"}</TableHead>
                        <TableHead className="text-right">{t.purchases.taxAmount || "Tax Amount"}</TableHead>
                        <TableHead className="text-right">{t.invoicesMod.grandTotal}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewingPurchase.items?.map((item) => {
                        const prodAmt = (item.quantity * item.purchasePrice)
                        const rate = Number(item.taxRate) || 0
                        const taxAmt = item.taxAmount ? (item.taxAmount) : ((prodAmt * rate) / 100)
                        const total = prodAmt + taxAmt

                        return (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.inventory?.itemName}</TableCell>
                            <TableCell>{item.inventory?.partNumber}</TableCell>
                            <TableCell className="text-center">{item.quantity}</TableCell>
                            <TableCell className="text-right">{(item.purchasePrice)} OMR</TableCell>
                            <TableCell className="text-right">{(item.sellingPrice)} OMR</TableCell>
                            <TableCell className="text-right font-medium">{prodAmt} OMR</TableCell>
                            <TableCell className="text-center">{rate}%</TableCell>
                            <TableCell className="text-right font-medium">+{taxAmt} OMR</TableCell>
                            <TableCell className="text-right font-semibold">{total} OMR</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <Button 
                  variant="outline" 
                  onClick={() => router.push(`/purchases/${viewingPurchase.id}/print`)}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  {t.purchases.downloadInvoice || "Download Purchase Invoice"}
                </Button>

                <div className="w-full sm:w-80 bg-muted/40 p-4 rounded-lg space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t.invoicesMod.subTotal}:</span>
                    <span>{(viewingPurchase.subTotal)} OMR</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t.purchases.totalTax || "Total Tax"}:</span>
                    <span>+{(viewingPurchase.taxAmount)} OMR</span>
                  </div>
                  {viewingPurchase.discount > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span className="text-muted-foreground">{t.invoicesMod.discount}:</span>
                      <span>-{(viewingPurchase.discount)} OMR</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-2 font-bold text-base">
                    <span>{t.invoicesMod.grandTotal}:</span>
                    <span className="text-primary">{(viewingPurchase.grandTotal)} OMR</span>
                  </div>
                  <div className="flex justify-between text-green-600 font-semibold border-t border-dashed pt-2">
                    <span>{t.purchases.paidAmount}:</span>
                    <span>{(viewingPurchase.paidAmount)} OMR</span>
                  </div>
                  <div className="flex justify-between text-destructive font-bold">
                    <span>{t.purchases.pendingAmount}:</span>
                    <span>{(viewingPurchase.pendingAmount)} OMR</span>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Modal */}
      {editingPurchase && (
        <Dialog open={!!editingPurchase} onOpenChange={(open) => !open && setEditingPurchase(null)}>
          <DialogContent className="h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-none overflow-y-auto p-3 sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-7xl sm:p-6">
            <DialogHeader>
              <DialogTitle>{t.common.edit}: {editingPurchase.purchaseNumber}</DialogTitle>
            </DialogHeader>
            <PurchaseForm 
              key={editingPurchase.id}
              initialData={editingPurchase} 
              onSuccess={() => setEditingPurchase(null)} 
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
