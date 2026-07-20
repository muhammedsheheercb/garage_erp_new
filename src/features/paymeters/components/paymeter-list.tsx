"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getPaymeters, deletePaymeter } from "../actions"
import { payPurchase } from "@/features/purchases/actions"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Plus, Edit, Trash, Wallet } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { PaymeterForm } from "./paymeter-form"
import { toast } from "sonner"

export function PaymeterList() {
  const queryClient = useQueryClient()
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingPaymeter, setEditingPaymeter] = useState<any>(null)
  const [settlingPaymeter, setSettlingPaymeter] = useState<any>(null)

  const { data: paymeters = [], isLoading } = useQuery({
    queryKey: ['paymeters'],
    queryFn: () => getPaymeters()
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePaymeter(id),
    onSuccess: () => {
      toast.success("Paymeter deleted successfully")
      queryClient.invalidateQueries({ queryKey: ['paymeters'] })
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete paymeter")
    }
  })

  const payPurchaseMutation = useMutation({
    mutationFn: ({ purchaseId, amount }: { purchaseId: string, amount: number }) => payPurchase(purchaseId, amount),
    onSuccess: () => {
      toast.success("Purchase payment added successfully")
      queryClient.invalidateQueries({ queryKey: ['paymeters'] })
      queryClient.invalidateQueries({ queryKey: ['purchases'] })
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to add payment")
    }
  })

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold tracking-tight">Ledgers / Accounts (Paymeters)</h2>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger render={
            <Button><Plus className="mr-2 h-4 w-4" /> Add Paymeter</Button>
          } />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Paymeter</DialogTitle>
            </DialogHeader>
            <PaymeterForm onSuccess={() => setIsAddOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-md overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Spent Amount</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center h-24">Loading...</TableCell></TableRow>
            ) : paymeters.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center h-24">No paymeters found.</TableCell></TableRow>
            ) : (
              paymeters.map((pm: any) => (
                <TableRow key={pm.id}>
                  <TableCell className="font-medium">{pm.name}</TableCell>
                  <TableCell>{pm.spentAmount?.toFixed(3)} OMR</TableCell>
                  <TableCell className="text-right space-x-2">
                    
                    <Dialog open={settlingPaymeter?.id === pm.id} onOpenChange={(open) => !open && setSettlingPaymeter(null)}>
                      <DialogTrigger render={
                        <Button variant="ghost" size="icon" onClick={() => setSettlingPaymeter(pm)} title="Settle Purchases">
                          <Wallet className="h-4 w-4" />
                        </Button>
                      } />
                      {settlingPaymeter?.id === pm.id && (
                        <DialogContent className="sm:max-w-4xl">
                          <DialogHeader>
                            <DialogTitle>Settle Purchases - {pm.name}</DialogTitle>
                          </DialogHeader>
                          <div className="max-h-[60vh] overflow-y-auto">
                            {pm.purchases && pm.purchases.length > 0 ? (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Number</TableHead>
                                    <TableHead>Supplier</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                    <TableHead className="text-right">Paid</TableHead>
                                    <TableHead className="text-right">Pending</TableHead>
                                    <TableHead className="text-right">Pay Amount</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {pm.purchases.filter((p: any) => p.pendingAmount > 0).map((purchase: any) => (
                                    <TableRow key={purchase.id}>
                                      <TableCell>{purchase.purchaseNumber}</TableCell>
                                      <TableCell>{purchase.supplier?.name || 'N/A'}</TableCell>
                                      <TableCell className="text-right">{purchase.grandTotal.toFixed(3)}</TableCell>
                                      <TableCell className="text-right">{purchase.paidAmount.toFixed(3)}</TableCell>
                                      <TableCell className="text-right text-red-500 font-medium">{purchase.pendingAmount.toFixed(3)}</TableCell>
                                      <TableCell className="text-right">
                                        <form onSubmit={(e) => {
                                          e.preventDefault()
                                          const formData = new FormData(e.currentTarget)
                                          const amount = parseFloat(formData.get("amount") as string)
                                          if (amount > 0 && amount <= purchase.pendingAmount) {
                                            payPurchaseMutation.mutate({ purchaseId: purchase.id, amount })
                                          }
                                        }} className="flex items-center gap-2 justify-end">
                                          <Input name="amount" type="number" step="0.001" required min="0.001" max={purchase.pendingAmount} className="w-24 h-8" placeholder="0.000" />
                                          <Button type="submit" size="sm" disabled={payPurchaseMutation.isPending}>Pay</Button>
                                        </form>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                  {pm.purchases.filter((p: any) => p.pendingAmount > 0).length === 0 && (
                                    <TableRow>
                                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No pending purchases to settle.</TableCell>
                                    </TableRow>
                                  )}
                                </TableBody>
                              </Table>
                            ) : (
                              <p className="text-center text-muted-foreground py-8">No purchases found for this paymeter.</p>
                            )}
                          </div>
                        </DialogContent>
                      )}
                    </Dialog>
                    
                    <Dialog>
                      <DialogTrigger render={
                        <Button variant="ghost" size="icon" title="View Purchase Details">
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-eye h-4 w-4"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>
                        </Button>
                      } />
                      <DialogContent className="sm:max-w-3xl">
                        <DialogHeader>
                          <DialogTitle>{pm.name} - Purchase Details</DialogTitle>
                        </DialogHeader>
                        <div className="max-h-[60vh] overflow-y-auto">
                          {pm.purchases && pm.purchases.length > 0 ? (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Date</TableHead>
                                  <TableHead>Number</TableHead>
                                  <TableHead>Supplier</TableHead>
                                  <TableHead className="text-right">Total (OMR)</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {pm.purchases.map((purchase: any) => (
                                  <TableRow key={purchase.id}>
                                    <TableCell>{new Date(purchase.purchaseDate).toLocaleDateString()}</TableCell>
                                    <TableCell>{purchase.purchaseNumber}</TableCell>
                                    <TableCell>{purchase.supplier?.name || 'N/A'}</TableCell>
                                    <TableCell className="text-right">{purchase.grandTotal.toFixed(3)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          ) : (
                            <p className="text-center text-muted-foreground py-8">No purchases found for this paymeter.</p>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>

                    <Dialog open={editingPaymeter?.id === pm.id} onOpenChange={(open) => !open && setEditingPaymeter(null)}>
                      <DialogTrigger render={
                        <Button variant="ghost" size="icon" onClick={() => setEditingPaymeter(pm)} title="Edit Paymeter">
                          <Edit className="h-4 w-4" />
                        </Button>
                      } />
                      {editingPaymeter?.id === pm.id && (
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle>Edit Paymeter</DialogTitle>
                          </DialogHeader>
                          <PaymeterForm 
                            initialData={editingPaymeter} 
                            onSuccess={() => setEditingPaymeter(null)} 
                          />
                        </DialogContent>
                      )}
                    </Dialog>

                    <AlertDialog>
                      <AlertDialogTrigger render={
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" title="Delete Paymeter">
                          <Trash className="h-4 w-4" />
                        </Button>
                      } />
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete this paymeter ledger. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(pm.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
    </div>
  )
}
