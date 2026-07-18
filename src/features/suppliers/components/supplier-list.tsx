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

  const { data: details, isLoading } = useQuery({
    queryKey: ['supplier', supplierId],
    queryFn: () => getSupplierDetails(supplierId)
  })

  const deletePaymentMutation = useMutation({
    mutationFn: (id: string) => deleteSupplierPayment(id),
    onSuccess: () => {
      toast.success("Payment deleted")
      queryClient.invalidateQueries({ queryKey: ['supplier', supplierId] })
    }
  })

  if (isLoading) return <div className="p-8 text-center">Loading details...</div>
  if (!details) return <div className="p-8 text-center text-destructive">Supplier not found.</div>

  const totalPaid = details.payments.reduce((acc: number, p: any) => acc + p.amount, 0)
  const totalPurchaseCost = details.inventory.reduce((acc: number, item: any) => acc + (item.quantity * item.purchasePrice), 0)
  const pendingAmount = totalPurchaseCost - totalPaid
  
  // Quick overview stats
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-muted/50 p-4 rounded-lg">
          <div className="text-sm text-muted-foreground mb-1 flex items-center"><Package className="h-4 w-4 mr-1" /> Supplied Parts</div>
          <div className="text-xl font-bold">{details.inventory.length}</div>
        </div>
        <div className="bg-muted/50 p-4 rounded-lg">
          <div className="text-sm text-muted-foreground mb-1 flex items-center"><DollarSign className="h-4 w-4 mr-1" /> Total Paid</div>
          <div className="text-xl font-bold text-green-600">{totalPaid.toFixed(3)} OMR</div>
        </div>
        <div className="bg-muted/50 p-4 rounded-lg">
          <div className="text-sm text-muted-foreground mb-1 flex items-center"><DollarSign className="h-4 w-4 mr-1" /> Pending Amount</div>
          <div className="text-xl font-bold text-destructive">{pendingAmount.toFixed(3)} OMR</div>
        </div>
      </div>

      <SimpleTabs 
        tabs={[{ id: 'inventory', label: 'Supplied Parts' }, { id: 'payments', label: 'Payment History' }]} 
        active={activeTab} 
        onChange={setActiveTab} 
      />

      {activeTab === 'inventory' && (
        <div className="border rounded-md max-h-80 overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Part No.</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Total Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {details.inventory.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No parts supplied yet.</TableCell></TableRow>
              ) : (
                details.inventory.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.itemName}</TableCell>
                    <TableCell>{item.partNumber || '-'}</TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell className="text-right">{item.purchasePrice.toFixed(3)}</TableCell>
                    <TableCell className="text-right font-medium">{(item.quantity * item.purchasePrice).toFixed(3)} OMR</TableCell>
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
            <h3 className="font-medium">Payment History</h3>
            {details.inventory.length > 0 && pendingAmount > 0 && (
              <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
                <DialogTrigger render={<Button size="sm"><Plus className="h-4 w-4 mr-2" /> Add Payment</Button>} />
                <DialogContent className="max-w-2xl">
                  <DialogHeader><DialogTitle>Record Payment to {details.name}</DialogTitle></DialogHeader>
                  <SupplierPaymentForm supplierId={details.id} inventoryItems={details.inventory} payments={details.payments} onSuccess={() => setIsPaymentOpen(false)} />
                </DialogContent>
              </Dialog>
            )}
          </div>
          
          <div className="border rounded-md max-h-80 overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {details.payments.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No payments recorded yet.</TableCell></TableRow>
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
                              <AlertDialogTitle>Delete Payment?</AlertDialogTitle>
                              <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deletePaymentMutation.mutate(payment.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
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

  const { data, isLoading } = useQuery({
    queryKey: ['suppliers', page, search],
    queryFn: () => getSuppliers(page, search)
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSupplier(id),
    onSuccess: () => {
      toast.success("Supplier deleted")
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
    }
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-center">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search suppliers..." 
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
            <Button className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" /> Add Supplier</Button>
          } />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Supplier</DialogTitle>
            </DialogHeader>
            <SupplierForm onSuccess={() => setIsAddOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-md overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Contact Info</TableHead>
              <TableHead>Address</TableHead>
              <TableHead className="text-center">Parts Supplied</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center h-24">Loading...</TableCell></TableRow>
            ) : data?.data.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center h-24">No suppliers found.</TableCell></TableRow>
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
                    <Badge variant="secondary">{supplier._count.inventory}</Badge>
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
                            <DialogTitle>{supplier.name} - Details</DialogTitle>
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
                            <DialogTitle>Edit Supplier</DialogTitle>
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
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete this supplier. Inventory items linked to this supplier will be retained but unlinked.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(supplier.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Previous
          </Button>
          <div className="text-sm text-muted-foreground">
            Page {page} of {data.meta.totalPages}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(data.meta.totalPages, p + 1))}
            disabled={page === data.meta.totalPages}
          >
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  )
}
