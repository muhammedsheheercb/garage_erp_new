"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getPurchases, deletePurchase } from "../actions"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Plus, Trash, Eye, ChevronLeft, ChevronRight } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { PurchaseForm } from "./purchase-form"
import { toast } from "sonner"
import { format } from "date-fns"
import { useTranslation } from "@/i18n"

export function PurchaseList() {
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [viewingPurchase, setViewingPurchase] = useState<any>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['purchases', page, search],
    queryFn: () => getPurchases(page, search)
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePurchase(id),
    onSuccess: () => {
      toast.success(t.purchases.purchaseDeletedSuccess)
      queryClient.invalidateQueries({ queryKey: ['purchases'] })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      queryClient.invalidateQueries({ queryKey: ['paymeters'] })
    },
    onError: (error: any) => {
      toast.error(error.message || t.common.somethingWrong)
    }
  })

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

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger render={
            <Button className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" /> {t.purchases.registerPurchase}</Button>
          } />
          <DialogContent className="max-w-[95vw] sm:max-w-7xl max-h-[90vh] overflow-y-auto">
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
              <TableHead>{t.suppliers.supplierTitle}</TableHead>
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
              <TableRow><TableCell colSpan={8} className="text-center h-24">{t.common.loading}</TableCell></TableRow>
            ) : !data || data.data.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center h-24">{t.purchases.noPurchases}</TableCell></TableRow>
            ) : (
              data.data.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-semibold">{p.purchaseNumber}</TableCell>
                  <TableCell>{p.supplier?.name}</TableCell>
                  <TableCell>{format(new Date(p.purchaseDate), 'dd-MM-yyyy')}</TableCell>
                  <TableCell>{p.grandTotal.toFixed(3)} OMR</TableCell>
                  <TableCell className="text-green-600 font-medium">{p.paidAmount.toFixed(3)} OMR</TableCell>
                  <TableCell className={p.pendingAmount > 0 ? "text-destructive font-medium" : "text-muted-foreground"}>
                    {p.pendingAmount.toFixed(3)} OMR
                  </TableCell>
                  <TableCell>{p.paymentMethod?.name || '-'}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => setViewingPurchase(p)} title={t.purchases.viewDetails}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger render={
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" title={t.purchases.deletePurchase}>
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
                          <AlertDialogAction onClick={() => deleteMutation.mutate(p.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
                  <span className="font-semibold">{format(new Date(viewingPurchase.purchaseDate), 'dd-MM-yyyy')}</span>
                </div>
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
                        <TableHead>{t.invoicesMod.qty}</TableHead>
                        <TableHead>{t.purchases.purchasePrice}</TableHead>
                        <TableHead>{t.purchases.sellingPrice}</TableHead>
                        <TableHead className="text-right">{t.invoicesMod.grandTotal}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewingPurchase.items?.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.inventory?.itemName}</TableCell>
                          <TableCell>{item.inventory?.partNumber}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>{item.purchasePrice.toFixed(3)} OMR</TableCell>
                          <TableCell>{item.sellingPrice.toFixed(3)} OMR</TableCell>
                          <TableCell className="text-right font-medium">{item.itemTotal.toFixed(3)} OMR</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="flex justify-end">
                <div className="w-full sm:w-80 bg-muted/40 p-4 rounded-lg space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t.invoicesMod.subTotal}:</span>
                    <span>{viewingPurchase.subTotal.toFixed(3)} OMR</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t.invoicesMod.discount}:</span>
                    <span>-{viewingPurchase.discount.toFixed(3)} OMR</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t.invoicesMod.tax} ({t.settings.taxTab.taxName} {viewingPurchase.taxRate}%):</span>
                    <span>+{viewingPurchase.taxAmount.toFixed(3)} OMR</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 font-bold text-base">
                    <span>{t.invoicesMod.grandTotal}:</span>
                    <span className="text-primary">{viewingPurchase.grandTotal.toFixed(3)} OMR</span>
                  </div>
                  <div className="flex justify-between text-green-600 font-semibold border-t border-dashed pt-2">
                    <span>{t.purchases.paidAmount}:</span>
                    <span>{viewingPurchase.paidAmount.toFixed(3)} OMR</span>
                  </div>
                  <div className="flex justify-between text-destructive font-bold">
                    <span>{t.purchases.pendingAmount}:</span>
                    <span>{viewingPurchase.pendingAmount.toFixed(3)} OMR</span>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
