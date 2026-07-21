"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getSuppliers, deleteSupplier, getSupplierDetails, deleteSupplierPayment } from "../actions"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Plus, Edit, Trash, ChevronLeft, ChevronRight, Eye, Package, DollarSign } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { SupplierForm } from "./supplier-form"
import { SupplierPaymentForm } from "./supplier-payment-form"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTranslation } from "@/i18n"

// Using a custom Tabs implementation since we don't have the shadcn tabs component installed yet.
function SimpleTabs({ tabs, active, onChange }: { tabs: { id: string, label: string }[], active: string, onChange: (id: string) => void }) {
  return (
    <div className="flex border-b mb-4">
      {tabs.map(tab => (
        <button
          key={tab.id}
          className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${active === tab.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

function SupplierDetails({ supplierId }: { supplierId: string }) {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState("inventory")
  const [isPaymentOpen, setIsPaymentOpen] = useState(false)
  const { t } = useTranslation()

  const { data: details, isLoading } = useQuery({
    queryKey: ['supplier', supplierId],
    queryFn: () => getSupplierDetails(supplierId)
  })

  const deletePaymentMutation = useMutation({
    mutationFn: (id: string) => deleteSupplierPayment(id),
    onSuccess: () => {
      toast.success(t.suppliers.paymentDeleted)
      queryClient.invalidateQueries({ queryKey: ['supplier', supplierId] })
    }
  })

  if (isLoading) return <div className="p-8 text-center">{t.common.loading}</div>
  if (!details) return <div className="p-8 text-center text-destructive">{t.suppliers.supplierNotFound}</div>

  const totalPaid = details.payments.reduce((acc: number, p: any) => acc + p.amount, 0)
  const totalPurchaseCost = details.purchases.reduce((acc: number, p: any) => acc + p.grandTotal, 0)
  const pendingAmount = totalPurchaseCost - totalPaid
  
  // Quick overview stats
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-muted/50 p-4 rounded-lg">
          <div className="text-sm text-muted-foreground mb-1 flex items-center"><Package className="h-4 w-4 mr-1" /> {t.suppliers.purchases}</div>
          <div className="text-xl font-bold">{details.purchases.length}</div>
        </div>
        <div className="bg-muted/50 p-4 rounded-lg">
          <div className="text-sm text-muted-foreground mb-1 flex items-center"><DollarSign className="h-4 w-4 mr-1" /> {t.suppliers.totalPaid}</div>
          <div className="text-xl font-bold text-green-600">{totalPaid.toFixed(3)} OMR</div>
        </div>
        <div className="bg-muted/50 p-4 rounded-lg">
          <div className="text-sm text-muted-foreground mb-1 flex items-center"><DollarSign className="h-4 w-4 mr-1" /> {t.suppliers.pendingAmount}</div>
          <div className="text-xl font-bold text-destructive">{pendingAmount.toFixed(3)} OMR</div>
        </div>
      </div>

      <SimpleTabs 
        tabs={[{ id: 'purchases', label: t.suppliers.purchases }, { id: 'payments', label: t.suppliers.paymentHistory }]} 
        active={activeTab} 
        onChange={setActiveTab} 
      />

      {activeTab === 'purchases' && (
        <div className="border rounded-md max-h-80 overflow-y-auto">
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
              {details.purchases.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">{t.suppliers.noPurchases}</TableCell></TableRow>
              ) : (
                details.purchases.map((purchase: any) => (
                  <TableRow key={purchase.id}>
                    <TableCell>{new Date(purchase.purchaseDate).toLocaleDateString()}</TableCell>
                    <TableCell className="font-medium">{purchase.purchaseNumber}</TableCell>
                    <TableCell>{purchase.items.length} {t.suppliers.items}</TableCell>
                    <TableCell className="text-right font-medium">{purchase.grandTotal.toFixed(3)} OMR</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {activeTab === 'payments' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-medium">{t.suppliers.paymentHistory}</h3>
            {details.purchases.length > 0 && pendingAmount > 0 && (
              <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
                <DialogTrigger render={<Button size="sm"><Plus className="h-4 w-4 mr-2" /> {t.suppliers.addPayment}</Button>} />
                <DialogContent className="max-w-2xl">
                  <DialogHeader><DialogTitle>{t.suppliers.recordPayment} {details.name}</DialogTitle></DialogHeader>
                  <SupplierPaymentForm supplierId={details.id} purchases={details.purchases} payments={details.payments} onSuccess={() => setIsPaymentOpen(false)} />
                </DialogContent>
              </Dialog>
            )}
          </div>
          
          <div className="border rounded-md max-h-80 overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead>{t.expensesMod.date}</TableHead>
                  <TableHead>{t.suppliers.reference}</TableHead>
                  <TableHead>{t.suppliers.method}</TableHead>
                  <TableHead className="text-right">{t.expensesMod.amount}</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {details.payments.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">{t.suppliers.noPayments}</TableCell></TableRow>
                ) : (
                  details.payments.map((payment: any) => (
                    <TableRow key={payment.id}>
                      <TableCell>{new Date(payment.date).toLocaleDateString()}</TableCell>
                      <TableCell>{payment.reference || '-'}</TableCell>
                      <TableCell>{payment.method}</TableCell>
                      <TableCell className="text-right font-medium text-green-600">{payment.amount.toFixed(3)}</TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger render={
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive">
                              <Trash className="h-3 w-3" />
                            </Button>
                          } />
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t.suppliers.deletePaymentTitle}</AlertDialogTitle>
                              <AlertDialogDescription>{t.suppliers.deletePaymentConfirm}</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deletePaymentMutation.mutate(payment.id)} className="bg-destructive text-destructive-foreground">{t.common.delete}</AlertDialogAction>
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
        </div>
      )}
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
  const { t } = useTranslation()

  const { data, isLoading } = useQuery({
    queryKey: ['suppliers', page, search],
    queryFn: () => getSuppliers(page, search)
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
      </div>

      <div className="border rounded-md overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.common.name}</TableHead>
              <TableHead>{t.suppliers.contactInfo}</TableHead>
              <TableHead>{t.common.address}</TableHead>
              <TableHead className="text-center">{t.suppliers.purchases}</TableHead>
              <TableHead className="text-right">{t.common.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center h-24">{t.common.loading}</TableCell></TableRow>
            ) : data?.data.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center h-24">{t.suppliers.noSuppliers}</TableCell></TableRow>
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
                  <TableCell className="max-w-[200px] truncate">{supplier.address || '-'}</TableCell>
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
                        <DialogContent className="max-w-3xl">
                          <DialogHeader>
                            <DialogTitle>{supplier.name} - {t.suppliers.details}</DialogTitle>
                          </DialogHeader>
                          <SupplierDetails supplierId={supplier.id} />
                        </DialogContent>
                      )}
                    </Dialog>

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
