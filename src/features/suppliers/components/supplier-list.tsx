"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query"
import { getSuppliers, deleteSupplier, getSupplierDetails } from "../actions"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Plus, Edit, Trash, ChevronLeft, ChevronRight, Eye, Package } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { SupplierForm } from "./supplier-form"
import { SupplierPaymentForm } from "./supplier-payment-form"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { useTranslation } from "@/i18n"
import { usePermissions } from "@/lib/use-permissions"
import { DatePickerWithRange } from "@/components/ui/date-range-picker"
import { DateRange } from "react-day-picker"
import { endOfDay, format } from "date-fns"
import { formatDisplayDate } from "@/lib/date-format"
import { useEffect } from "react"

// Custom hook for debouncing search input
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}

function DetailPagination({ page, setPage, total }: { page: number; setPage: (page: number) => void; total: number }) {
  const totalPages = Math.ceil(total / 5)
  if (totalPages <= 1) return null
  return <div className="flex items-center justify-end gap-2 pt-2 text-sm">
    <Button variant="outline" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}><ChevronLeft className="h-4 w-4" /></Button>
    <span className="text-muted-foreground">{page} / {totalPages}</span>
    <Button variant="outline" size="sm" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}><ChevronRight className="h-4 w-4" /></Button>
  </div>
}

function SupplierDetails({ supplierId }: { supplierId: string }) {
  const [isPaymentOpen, setIsPaymentOpen] = useState(false)
  const [purchasePage, setPurchasePage] = useState(1)
  const [paymentPage, setPaymentPage] = useState(1)
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const { t } = useTranslation()
  const getPaymentMethodLabel = (name: string) => ({
    "Direct Cash": t.payments.cash,
    "Direct Bank Transfer": t.payments.bankTransfer,
    "Direct Card": t.payments.card,
    CASH: t.payments.cash,
    BANK_TRANSFER: t.payments.bankTransfer,
    CARD: t.payments.card,
  }[name] || name)

  const { data: details, isLoading } = useQuery({
    queryKey: ['supplier', supplierId],
    queryFn: () => getSupplierDetails(supplierId)
  })

  if (isLoading) return <div className="p-8 text-center">{t.common.loading}</div>
  if (!details) return <div className="p-8 text-center text-destructive">{t.suppliers.supplierNotFound}</div>

  const totalPaid = details.purchases.reduce((acc: number, purchase: any) => acc + purchase.paidAmount, 0)
  const pendingAmount = details.purchases.reduce((acc: number, purchase: any) => acc + purchase.pendingAmount, 0)
  // Compare calendar dates, including both endpoints and single-day selections.
  const matchesDateRange = (value: Date | string) => {
    if (!dateRange?.from) return true
    const date = format(new Date(value), "yyyy-MM-dd")
    return date >= format(dateRange.from, "yyyy-MM-dd")
      && date <= format(dateRange.to ?? dateRange.from, "yyyy-MM-dd")
  }
  const purchaseHistory = details.purchases.filter((purchase) => matchesDateRange(purchase.purchaseDate))
  const paymentHistory = [
    ...details.purchases.flatMap((purchase: any) =>
      purchase.purchasePayments.map((payment: any) => ({
        ...payment,
        purchaseNumber: purchase.purchaseNumber,
        method: payment.paymeter ? getPaymentMethodLabel(payment.paymeter.name) : '-',
      }))
    ),
    ...details.payments.map((payment: any) => ({
      ...payment,
      purchaseNumber: payment.reference || '—',
      method: getPaymentMethodLabel(payment.method),
    })),
  ].filter((payment) => matchesDateRange(payment.date)).sort((a: any, b: any) => {
    const dateDifference = new Date(b.date).getTime() - new Date(a.date).getTime()
    return dateDifference || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg bg-muted/50 p-4">
          <div className="mb-1 flex text-sm text-muted-foreground"><Package className="mr-1 h-4 w-4" /> {t.suppliers.purchases}</div>
          <div className="text-xl font-bold">{details.purchases.length}</div>
        </div>
        <div className="rounded-lg bg-muted/50 p-4">
          <div className="mb-1 flex text-sm text-muted-foreground"><img src="/Omr_symbol.svg" alt="OMR" className="mr-1 h-4 w-4 object-contain" /> {t.suppliers.totalPaid}</div>
          <div className="text-xl font-bold text-green-600">{totalPaid} OMR</div>
        </div>
        <div className="rounded-lg bg-muted/50 p-4">
          <div className="mb-1 flex text-sm text-muted-foreground"><img src="/Omr_symbol.svg" alt="OMR" className="mr-1 h-4 w-4 object-contain" /> {t.suppliers.pendingAmount}</div>
          <div className="text-xl font-bold text-destructive">{pendingAmount} OMR</div>
        </div>
      </div>

      <div className="grid gap-3 rounded-md border p-4 text-sm sm:grid-cols-2">
        <div><span className="text-muted-foreground">{t.suppliers.contact}: </span>{details.contact || '—'}</div>
        <div><span className="text-muted-foreground">Email: </span>{details.email || '—'}</div>
        <div className="sm:col-span-2"><span className="text-muted-foreground">Address: </span>{details.address || '—'}</div>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium">Date Filter</span>
          <DatePickerWithRange
            date={dateRange}
            setDate={(range) => {
              setDateRange(range)
              setPurchasePage(1)
              setPaymentPage(1)
            }}
          />
        </div>
        <h3 className="font-medium">Purchase History</h3>
        <div className="max-h-80 overflow-y-auto rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead>{t.expensesMod.date}</TableHead>
                <TableHead>{t.suppliers.refNo}</TableHead>
                <TableHead>{t.suppliers.items}</TableHead>
                <TableHead className="text-right">{t.suppliers.grandTotal}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchaseHistory.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">{t.suppliers.noPurchases}</TableCell></TableRow>
              ) : (
                purchaseHistory.slice((purchasePage - 1) * 5, purchasePage * 5).map((purchase: any) => (
                  <TableRow key={purchase.id}>
                    <TableCell>{formatDisplayDate(purchase.purchaseDate)}</TableCell>
                    <TableCell className="font-medium">{purchase.purchaseNumber}</TableCell>
                    <TableCell>{purchase.items.length} {t.suppliers.items}</TableCell>
                    <TableCell className="text-right font-medium">{purchase.grandTotal} OMR</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <DetailPagination page={purchasePage} setPage={setPurchasePage} total={purchaseHistory.length} />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h3 className="font-medium">{t.suppliers.paymentHistory}</h3>
          {details.purchases.some((purchase: any) => purchase.pendingAmount > 0) && (
            <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
              <DialogTrigger render={<Button size="sm"><Plus className="mr-2 h-4 w-4" /> {t.suppliers.addPayment}</Button>} />
              <DialogContent className="sm:max-w-4xl">
                <DialogHeader><DialogTitle>{t.suppliers.recordPayment} {details.name}</DialogTitle></DialogHeader>
                <SupplierPaymentForm supplierId={details.id} purchases={details.purchases} paymentMethods={details.paymentMethods} onSuccess={() => setIsPaymentOpen(false)} />
              </DialogContent>
            </Dialog>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead>{t.expensesMod.date}</TableHead>
                <TableHead>{t.suppliers.reference}</TableHead>
                <TableHead>{t.suppliers.method}</TableHead>
                <TableHead className="text-right">{t.expensesMod.amount}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paymentHistory.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">{t.suppliers.noPayments}</TableCell></TableRow>
              ) : (
                paymentHistory.slice((paymentPage - 1) * 5, paymentPage * 5).map((payment: any) => (
                  <TableRow key={payment.id}>
                    <TableCell>{formatDisplayDate(payment.date)}</TableCell>
                    <TableCell className="font-medium">{payment.purchaseNumber}</TableCell>
                    <TableCell>{payment.method}</TableCell>
                    <TableCell className="text-right font-medium text-green-600">{payment.amount}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <DetailPagination page={paymentPage} setPage={setPaymentPage} total={paymentHistory.length} />
        </div>
      </section>
    </div>
  )
}

export function SupplierList() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<any>(null)
  const [viewingSupplier, setViewingSupplier] = useState<string | null>(null)
  const debouncedSearch = useDebounce(search, 400)
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const { t } = useTranslation()
  const { can } = usePermissions()

  const fromDateStr = dateRange?.from?.toISOString()
  const toDateStr = dateRange?.to ? endOfDay(dateRange.to).toISOString() : undefined

  const { data, isLoading } = useQuery({
    queryKey: ['suppliers', page, debouncedSearch, fromDateStr, toDateStr],
    queryFn: () => getSuppliers(page, debouncedSearch, fromDateStr, toDateStr),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSupplier(id),
    onSuccess: () => {
      toast.success(t.suppliers.supplierDeleted)
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
    }
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-center">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder={t.suppliers.searchSuppliers}
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

        {can("suppliers", "create") && (
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger render={
              <Button className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" /> {t.suppliers.addSupplier}</Button>
            } />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t.suppliers.addNewSupplier}</DialogTitle>
              </DialogHeader>
              <SupplierForm onSuccess={() => setIsAddOpen(false)} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="border rounded-md overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.common.name}</TableHead>
              <TableHead>{t.suppliers.contactInfo}</TableHead>

              <TableHead className="text-center">{t.suppliers.purchases}</TableHead>
              <TableHead className="text-right">{t.common.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center h-24">{t.common.loading}</TableCell></TableRow>
            ) : data?.data.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center h-24">{t.suppliers.noSuppliers}</TableCell></TableRow>
            ) : (
              data?.data.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell className="font-medium">{supplier.name}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm">{supplier.contact || '-'}</span>
                      <span className="text-xs text-muted-foreground">{supplier.email || '-'}</span>
                    </div>
                  </TableCell>

                  <TableCell className="text-center">
                    <Badge variant="secondary">{supplier._count.purchases}</Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    
                    <Dialog open={viewingSupplier === supplier.id} onOpenChange={(open) => setViewingSupplier(open ? supplier.id : null)}>
                      <DialogTrigger render={
                        <Button variant="ghost" size="icon">
                          <Eye className="h-4 w-4" />
                        </Button>
                      } />
                      {viewingSupplier === supplier.id && (
                        <DialogContent className="sm:max-w-7xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>{supplier.name} - {t.suppliers.details}</DialogTitle>
                          </DialogHeader>
                          <SupplierDetails supplierId={supplier.id} />
                        </DialogContent>
                      )}
                    </Dialog>

                    {can("suppliers", "edit") && (
                      <Dialog open={editingSupplier?.id === supplier.id} onOpenChange={(open) => !open && setEditingSupplier(null)}>
                        <DialogTrigger render={
                          <Button variant="ghost" size="icon" onClick={() => setEditingSupplier(supplier)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        } />
                        {editingSupplier?.id === supplier.id && (
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>{t.suppliers.editSupplier}</DialogTitle>
                            </DialogHeader>
                            <SupplierForm 
                              initialData={editingSupplier} 
                              onSuccess={() => setEditingSupplier(null)} 
                            />
                          </DialogContent>
                        )}
                      </Dialog>
                    )}

                    {can("suppliers", "delete") && (
                      <AlertDialog>
                        <AlertDialogTrigger render={
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                            <Trash className="h-4 w-4" />
                          </Button>
                        } />
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t.suppliers.deleteSupplier}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t.suppliers.deleteConfirm}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate(supplier.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              {t.common.delete}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}

                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {data?.meta && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-end space-x-2 py-4">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft className="h-4 w-4 mr-1" /> {t.common.previous}
          </Button>
          <div className="text-sm text-muted-foreground">
            {t.common.page} {page} {t.common.of} {data.meta.totalPages}
          </div>
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(data.meta.totalPages, p + 1))} disabled={page === data.meta.totalPages}>
            {t.common.next} <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  )
}
