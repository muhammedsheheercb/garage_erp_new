"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getPaymeters, deletePaymeter, payPurchasePayment } from "../actions"
import { payPurchase } from "@/features/purchases/actions"
import { payExpense } from "@/features/expenses/actions"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Plus, Edit, Trash, Wallet } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { PaymeterForm } from "./paymeter-form"
import { toast } from "sonner"
import { useTranslation } from "@/i18n"
import { DatePickerWithRange } from "@/components/ui/date-range-picker"
import { DateRange } from "react-day-picker"
import { endOfDay } from "date-fns"

function Pagination({ page, setPage, total, limit }: { page: number, setPage: (p: number) => void, total: number, limit: number }) {
  const totalPages = Math.ceil(total / limit)
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between mt-2 px-2">
      <div className="text-sm text-muted-foreground">
        Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} entries
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page === 1}>Previous</Button>
        <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page === totalPages}>Next</Button>
      </div>
    </div>
  )
}

export function PaymeterList() {
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingPaymeter, setEditingPaymeter] = useState<any>(null)
  const [settlingPaymeter, setSettlingPaymeter] = useState<any>(null)
  const [settlementAmounts, setSettlementAmounts] = useState<Record<string, string>>({})

  const [dateRange, setDateRange] = useState<DateRange | undefined>()

  const [pursePurchasesPage, setPursePurchasesPage] = useState(1)
  const [purseExpensesPage, setPurseExpensesPage] = useState(1)
  const [purseSupplierPage, setPurseSupplierPage] = useState(1)
  const [eyePurchasesPage, setEyePurchasesPage] = useState(1)
  const [eyeExpensesPage, setEyeExpensesPage] = useState(1)
  const [eyeSupplierPage, setEyeSupplierPage] = useState(1)

  const fromDateStr = dateRange?.from?.toISOString()
  const toDateStr = dateRange?.to ? endOfDay(dateRange.to).toISOString() : undefined

  const { data: paymeters = [], isLoading } = useQuery({
    queryKey: ['paymeters', fromDateStr, toDateStr],
    queryFn: () => getPaymeters(fromDateStr, toDateStr)
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePaymeter(id),
    onSuccess: () => {
      toast.success(t.settings.databaseTab.paymeterDeleted)
      queryClient.invalidateQueries({ queryKey: ['paymeters'] })
    },
    onError: (error: any) => {
      toast.error(error.message || t.common.somethingWrong)
    }
  })

  const payPurchaseMutation = useMutation({
    mutationFn: ({ purchaseId, amount }: { purchaseId: string, amount: number }) => payPurchase(purchaseId, amount),
    onSuccess: (_data, variables) => {
      toast.success(t.purchases.purchasePaymentAdded)
      queryClient.invalidateQueries({ queryKey: ['paymeters'] })
      queryClient.invalidateQueries({ queryKey: ['purchases'] })
      setSettlementAmounts((amounts) => ({ ...amounts, [variables.purchaseId]: "0" }))
    },
    onError: (error: any) => {
      toast.error(error.message || t.common.somethingWrong)
    }
  })

  const payExpenseMutation = useMutation({
    mutationFn: ({ expenseId, amount }: { expenseId: string, amount: number }) => payExpense(expenseId, amount),
    onSuccess: (_data, variables) => {
      toast.success("Payment added")
      queryClient.invalidateQueries({ queryKey: ['paymeters'] })
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      setSettlementAmounts((amounts) => ({ ...amounts, [variables.expenseId]: "0" }))
    },
    onError: (error: any) => {
      toast.error(error.message || t.common.somethingWrong)
    }
  })

  const paySupplierMutation = useMutation({
    mutationFn: ({ paymentId, amount }: { paymentId: string, amount: number }) => payPurchasePayment(paymentId, amount),
    onSuccess: (_data, variables) => {
      toast.success("Payment added")
      queryClient.invalidateQueries({ queryKey: ['paymeters'] })
      queryClient.invalidateQueries({ queryKey: ['purchases'] })
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      setSettlementAmounts((amounts) => ({ ...amounts, [variables.paymentId]: "0" }))
    },
    onError: (error: any) => {
      toast.error(error.message || t.common.somethingWrong)
    }
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h2 className="text-xl font-bold tracking-tight">{t.settings.databaseTab.ledgersAccounts}</h2>

        <div className="flex gap-2">
          <DatePickerWithRange
            date={dateRange}
            setDate={setDateRange}
          />
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger render={
              <Button><Plus className="mr-2 h-4 w-4" /> {t.settings.databaseTab.addPaymeter}</Button>
            } />
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{t.settings.databaseTab.addNewPaymeter}</DialogTitle>
              </DialogHeader>
              <PaymeterForm onSuccess={() => setIsAddOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="border rounded-md overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.common.name}</TableHead>
              <TableHead>{t.settings.databaseTab.spentAmount}</TableHead>
              <TableHead className="text-right">{t.common.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={3} className="text-center h-24">{t.common.loading}</TableCell></TableRow>
            ) : paymeters.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center h-24">{t.settings.databaseTab.noPaymeters}</TableCell></TableRow>
            ) : (
              paymeters.map((pm: any) => (
                <TableRow key={pm.id}>
                  <TableCell className="font-medium">{pm.name}</TableCell>
                  <TableCell>
                    {(fromDateStr || toDateStr)
                      ? pm.filteredSpentAmount?.toFixed(3)
                      : pm.spentAmount?.toFixed(3)} OMR
                  </TableCell>
                  <TableCell className="text-right space-x-2">

                    <Dialog open={settlingPaymeter?.id === pm.id} onOpenChange={(open) => !open && setSettlingPaymeter(null)}>
                      <DialogTrigger render={
                        <Button variant="ghost" size="icon" onClick={() => setSettlingPaymeter(pm)} title={t.purchases.settlePurchases}>
                          <Wallet className="h-4 w-4" />
                        </Button>
                      } />
                      {settlingPaymeter?.id === pm.id && (
                        <DialogContent className="sm:max-w-4xl">
                          <DialogHeader>
                            <DialogTitle>{t.purchases.settlePurchases} - {pm.name}</DialogTitle>
                          </DialogHeader>
                          <div className="max-h-[60vh] overflow-y-auto">
                            {pm.purchases && pm.purchases.length > 0 ? (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>{t.purchases.purchaseNo}</TableHead>
                                    <TableHead>Type & Details</TableHead>
                                    <TableHead className="text-right">{t.payments.total}</TableHead>
                                    <TableHead className="text-right">{t.payments.paid}</TableHead>
                                    <TableHead className="text-right">{t.purchases.pending}</TableHead>
                                    <TableHead className="text-right">{t.purchases.payAmount}</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {(() => {
                                    const filtered = pm.purchases.filter((p: any) => (p.paymeterAdvanceAmount || 0) > (p.paymeterReimbursed || 0));
                                    if (filtered.length === 0) return <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t.purchases.noPendingToSettle}</TableCell></TableRow>;
                                    const paginated = filtered.slice((pursePurchasesPage - 1) * 5, pursePurchasesPage * 5);
                                    return (
                                      <>
                                        {paginated.map((purchase: any) => (
                                          <TableRow key={purchase.id}>
                                            <TableCell>{purchase.purchaseNumber}</TableCell>
                                            <TableCell>
                                              <div className="flex flex-col text-xs">
                                                <span className="font-medium text-muted-foreground">{purchase.purchaseType === 'VEHICLE' ? 'Vehicle Purchase' : 'Stock Purchase'}</span>
                                                {purchase.purchaseType === 'VEHICLE' && purchase.jobCard ? (
                                                  <span className="font-semibold">{purchase.jobCard.vehicle.plateNumber}</span>
                                                ) : (
                                                  <span className="font-semibold">{purchase.supplier?.name || t.common.unknown}</span>
                                                )}
                                              </div>
                                            </TableCell>
                                            <TableCell className="text-right">{(purchase.paymeterAdvanceAmount || 0).toFixed(3)}</TableCell>
                                            <TableCell className="text-right">{(purchase.paymeterReimbursed || 0).toFixed(3)}</TableCell>
                                            <TableCell className="text-right text-red-500 font-medium">{((purchase.paymeterAdvanceAmount || 0) - (purchase.paymeterReimbursed || 0)).toFixed(3)}</TableCell>
                                            <TableCell className="text-right">
                                              <form onSubmit={(e) => {
                                                e.preventDefault()
                                                const amount = parseFloat(settlementAmounts[purchase.id] || "0")
                                                if (amount > 0 && amount <= ((purchase.paymeterAdvanceAmount || 0) - (purchase.paymeterReimbursed || 0))) {
                                                  payPurchaseMutation.mutate({ purchaseId: purchase.id, amount })
                                                }
                                              }} className="flex items-center gap-2 justify-end">
                                                <Input
                                                  name="amount"
                                                  type="number"
                                                  step="0.001"
                                                  required
                                                  min="0.001"
                                                  max={(purchase.paymeterAdvanceAmount || 0) - (purchase.paymeterReimbursed || 0)}
                                                  className="w-24 h-8"
                                                  placeholder="0.000"
                                                  value={settlementAmounts[purchase.id] ?? ""}
                                                  onChange={(event) => setSettlementAmounts((amounts) => ({ ...amounts, [purchase.id]: event.target.value }))}
                                                />
                                                <Button type="submit" size="sm" disabled={payPurchaseMutation.isPending}>{t.payments.pay}</Button>
                                              </form>
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                        {filtered.length > 5 && (
                                          <TableRow>
                                            <TableCell colSpan={6} className="p-0 border-b-0">
                                              <Pagination page={pursePurchasesPage} setPage={setPursePurchasesPage} total={filtered.length} limit={5} />
                                            </TableCell>
                                          </TableRow>
                                        )}
                                      </>
                                    )
                                  })()}
                                </TableBody>
                              </Table>
                            ) : (
                              <p className="text-center text-muted-foreground py-8">{t.purchases.noPurchasesFound}</p>
                            )}

                            <div className="mt-8 border-t pt-6">
                              <h3 className="font-semibold mb-3">{t.expensesMod?.title || "Expenses"}</h3>
                              {pm.expenses && pm.expenses.length > 0 ? (
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>{t.payments.date}</TableHead>
                                      <TableHead>{t.expensesMod?.expenseCategory || "Category"}</TableHead>
                                      <TableHead className="text-right">{t.payments.total}</TableHead>
                                      <TableHead className="text-right">{t.payments.paid}</TableHead>
                                      <TableHead className="text-right">{t.purchases.pending}</TableHead>
                                      <TableHead className="text-right">{t.purchases.payAmount}</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {(() => {
                                      const filtered = pm.expenses.filter((e: any) => e.pendingAmount > 0);
                                      if (filtered.length === 0) return <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t.purchases.noPendingToSettle || "No pending amounts to settle"}</TableCell></TableRow>;
                                      const paginated = filtered.slice((purseExpensesPage - 1) * 5, purseExpensesPage * 5);
                                      return (
                                        <>
                                          {paginated.map((expense: any) => (
                                            <TableRow key={expense.id}>
                                              <TableCell>{new Date(expense.date).toLocaleDateString()}</TableCell>
                                              <TableCell>{expense.category}</TableCell>
                                              <TableCell className="text-right">{expense.amount.toFixed(3)}</TableCell>
                                              <TableCell className="text-right">{(expense.paidAmount || 0).toFixed(3)}</TableCell>
                                              <TableCell className="text-right text-red-500 font-medium">{(expense.pendingAmount || 0).toFixed(3)}</TableCell>
                                              <TableCell className="text-right">
                                                <form onSubmit={(e) => {
                                                  e.preventDefault()
                                                  const amount = parseFloat(settlementAmounts[expense.id] || "0")
                                                  if (amount > 0 && amount <= expense.pendingAmount) {
                                                    payExpenseMutation.mutate({ expenseId: expense.id, amount })
                                                  }
                                                }} className="flex items-center gap-2 justify-end">
                                                  <Input
                                                    name="amount"
                                                    type="number"
                                                    step="0.001"
                                                    required
                                                    min="0.001"
                                                    max={expense.pendingAmount}
                                                    className="w-24 h-8"
                                                    placeholder="0.000"
                                                    value={settlementAmounts[expense.id] ?? ""}
                                                    onChange={(event) => setSettlementAmounts((amounts) => ({ ...amounts, [expense.id]: event.target.value }))}
                                                  />
                                                  <Button type="submit" size="sm" disabled={payExpenseMutation.isPending}>{t.payments.pay}</Button>
                                                </form>
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                          {filtered.length > 5 && (
                                            <TableRow>
                                              <TableCell colSpan={6} className="p-0 border-b-0">
                                                <Pagination page={purseExpensesPage} setPage={setPurseExpensesPage} total={filtered.length} limit={5} />
                                              </TableCell>
                                            </TableRow>
                                          )}
                                        </>
                                      )
                                    })()}
                                  </TableBody>
                                </Table>
                              ) : (
                                <p className="text-center text-muted-foreground py-8">No expenses found.</p>
                              )}
                            </div>

                            <div className="mt-8 border-t pt-6">
                              <h3 className="font-semibold mb-3">{(t.suppliers as any)?.supplierPayments || "Supplier Payments"}</h3>
                              {pm.purchasePayments && pm.purchasePayments.length > 0 ? (
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>{t.payments.date}</TableHead>
                                      <TableHead>{t.suppliers?.supplierTitle || "Supplier"}</TableHead>
                                      <TableHead className="text-right">{t.payments.total}</TableHead>
                                      <TableHead className="text-right">{t.payments.paid}</TableHead>
                                      <TableHead className="text-right">{t.purchases.pending}</TableHead>
                                      <TableHead className="text-right">{t.purchases.payAmount}</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {(() => {
                                      const filtered = pm.purchasePayments.filter((p: any) => p.pendingAmount > 0);
                                      if (filtered.length === 0) return <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t.purchases.noPendingToSettle || "No pending amounts to settle"}</TableCell></TableRow>;
                                      const paginated = filtered.slice((purseSupplierPage - 1) * 5, purseSupplierPage * 5);
                                      return (
                                        <>
                                          {paginated.map((payment: any) => (
                                            <TableRow key={payment.id}>
                                              <TableCell>{new Date(payment.date).toLocaleDateString()}</TableCell>
                                              <TableCell>{payment.purchase?.supplier?.name || '-'}</TableCell>
                                              <TableCell className="text-right">{payment.amount.toFixed(3)}</TableCell>
                                              <TableCell className="text-right">{(payment.paidAmount || 0).toFixed(3)}</TableCell>
                                              <TableCell className="text-right text-red-500 font-medium">{(payment.pendingAmount || 0).toFixed(3)}</TableCell>
                                              <TableCell className="text-right">
                                                <form onSubmit={(e) => {
                                                  e.preventDefault()
                                                  const amount = parseFloat(settlementAmounts[payment.id] || "0")
                                                  if (amount > 0 && amount <= payment.pendingAmount) {
                                                    paySupplierMutation.mutate({ paymentId: payment.id, amount })
                                                  }
                                                }} className="flex items-center gap-2 justify-end">
                                                  <Input
                                                    name="amount"
                                                    type="number"
                                                    step="0.001"
                                                    required
                                                    min="0.001"
                                                    max={payment.pendingAmount}
                                                    className="w-24 h-8"
                                                    placeholder="0.000"
                                                    value={settlementAmounts[payment.id] ?? ""}
                                                    onChange={(event) => setSettlementAmounts((amounts) => ({ ...amounts, [payment.id]: event.target.value }))}
                                                  />
                                                  <Button type="submit" size="sm" disabled={paySupplierMutation.isPending}>{t.payments.pay}</Button>
                                                </form>
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                          {filtered.length > 5 && (
                                            <TableRow>
                                              <TableCell colSpan={6} className="p-0 border-b-0">
                                                <Pagination page={purseSupplierPage} setPage={setPurseSupplierPage} total={filtered.length} limit={5} />
                                              </TableCell>
                                            </TableRow>
                                          )}
                                        </>
                                      )
                                    })()}
                                  </TableBody>
                                </Table>
                              ) : (
                                <p className="text-center text-muted-foreground py-8">{t.suppliers?.noPayments || "No supplier payments found."}</p>
                              )}
                            </div>
                          </div>
                        </DialogContent>
                      )}
                    </Dialog>

                    <Dialog>
                      <DialogTrigger render={
                        <Button variant="ghost" size="icon" title={t.purchases.viewDetails}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-eye h-4 w-4"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" /><circle cx="12" cy="12" r="3" /></svg>
                        </Button>
                      } />
                      <DialogContent className="sm:max-w-4xl">
                        <DialogHeader>
                          <DialogTitle>{pm.name} - {t.purchases.viewDetails || "Details"}</DialogTitle>
                        </DialogHeader>
                        <div className="max-h-[60vh] overflow-y-auto space-y-8">
                          <div>
                            <h3 className="font-semibold mb-3">{t.purchases.purchaseOrderDetails || "Purchases"}</h3>
                            {pm.purchases && pm.purchases.length > 0 ? (
                              <div className="border rounded-md">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>{t.payments.date}</TableHead>
                                      <TableHead>{t.purchases.purchaseNo}</TableHead>
                                      <TableHead>{t.suppliers.supplierTitle}</TableHead>
                                      <TableHead className="text-right">{t.payments.total}</TableHead>
                                      <TableHead className="text-right">{t.payments.paid}</TableHead>
                                      <TableHead className="text-right">{t.purchases.pending}</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {(() => {
                                      const items = pm.purchases;
                                      const paginated = items.slice((eyePurchasesPage - 1) * 5, eyePurchasesPage * 5);
                                      return (
                                        <>
                                          {paginated.map((purchase: any) => (
                                            <TableRow key={purchase.id}>
                                              <TableCell>{new Date(purchase.purchaseDate).toLocaleDateString()}</TableCell>
                                              <TableCell>{purchase.purchaseNumber}</TableCell>
                                              <TableCell>{purchase.supplier?.name || t.common.unknown}</TableCell>
                                              <TableCell className="text-right font-medium">{(purchase.paymeterAdvanceAmount || 0).toFixed(3)}</TableCell>
                                              <TableCell className="text-right text-green-600 font-medium">{(purchase.paymeterReimbursed || 0).toFixed(3)}</TableCell>
                                              <TableCell className="text-right text-destructive font-medium">{((purchase.paymeterAdvanceAmount || 0) - (purchase.paymeterReimbursed || 0)).toFixed(3)}</TableCell>
                                            </TableRow>
                                          ))}
                                          {items.length > 5 && (
                                            <TableRow>
                                              <TableCell colSpan={6} className="p-0 border-b-0">
                                                <Pagination page={eyePurchasesPage} setPage={setEyePurchasesPage} total={items.length} limit={5} />
                                              </TableCell>
                                            </TableRow>
                                          )}
                                        </>
                                      )
                                    })()}
                                  </TableBody>
                                </Table>
                              </div>
                            ) : (
                              <p className="text-center text-muted-foreground py-4 border rounded-md">{t.purchases.noPurchasesFound}</p>
                            )}
                          </div>

                          <div>
                            <h3 className="font-semibold mb-3">{t.expensesMod?.title || "Expenses"}</h3>
                            {pm.expenses && pm.expenses.length > 0 ? (
                              <div className="border rounded-md">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>{t.payments.date}</TableHead>
                                      <TableHead>{t.expensesMod?.expenseCategory || "Category"}</TableHead>
                                      <TableHead>{t.expensesMod?.expenseDescription || "Description"}</TableHead>
                                      <TableHead className="text-right">{t.expensesMod?.amount || "Amount"}</TableHead>
                                      <TableHead className="text-right">{t.payments.paid}</TableHead>
                                      <TableHead className="text-right">{t.purchases.pending}</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {(() => {
                                      const items = pm.expenses;
                                      const paginated = items.slice((eyeExpensesPage - 1) * 5, eyeExpensesPage * 5);
                                      return (
                                        <>
                                          {paginated.map((expense: any) => (
                                            <TableRow key={expense.id}>
                                              <TableCell>{new Date(expense.date).toLocaleDateString()}</TableCell>
                                              <TableCell>{expense.category}</TableCell>
                                              <TableCell>{expense.description || '-'}</TableCell>
                                              <TableCell className="text-right font-medium">{expense.amount.toFixed(3)}</TableCell>
                                              <TableCell className="text-right text-green-600 font-medium">{(expense.paidAmount || 0).toFixed(3)}</TableCell>
                                              <TableCell className="text-right text-destructive font-medium">{(expense.pendingAmount || 0).toFixed(3)}</TableCell>
                                            </TableRow>
                                          ))}
                                          {items.length > 5 && (
                                            <TableRow>
                                              <TableCell colSpan={6} className="p-0 border-b-0">
                                                <Pagination page={eyeExpensesPage} setPage={setEyeExpensesPage} total={items.length} limit={5} />
                                              </TableCell>
                                            </TableRow>
                                          )}
                                        </>
                                      )
                                    })()}
                                  </TableBody>
                                </Table>
                              </div>
                            ) : (
                              <p className="text-center text-muted-foreground py-4 border rounded-md">No expenses found.</p>
                            )}
                          </div>

                          <div>
                            <h3 className="font-semibold mb-3">{(t.suppliers as any)?.supplierPayments || "Supplier Payments"}</h3>
                            {pm.purchasePayments && pm.purchasePayments.length > 0 ? (
                              <div className="border rounded-md">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>{t.payments.date}</TableHead>
                                      <TableHead>{t.suppliers?.supplierTitle || "Supplier"}</TableHead>
                                      <TableHead className="text-right">{t.payments.total}</TableHead>
                                      <TableHead className="text-right">{t.payments.paid}</TableHead>
                                      <TableHead className="text-right">{t.purchases.pending}</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {(() => {
                                      const items = pm.purchasePayments;
                                      const paginated = items.slice((eyeSupplierPage - 1) * 5, eyeSupplierPage * 5);
                                      return (
                                        <>
                                          {paginated.map((payment: any) => (
                                            <TableRow key={payment.id}>
                                              <TableCell>{new Date(payment.date).toLocaleDateString()}</TableCell>
                                              <TableCell>{payment.purchase?.supplier?.name || '-'}</TableCell>
                                              <TableCell className="text-right font-medium">{payment.amount.toFixed(3)}</TableCell>
                                              <TableCell className="text-right text-green-600 font-medium">{(payment.paidAmount || 0).toFixed(3)}</TableCell>
                                              <TableCell className="text-right text-destructive font-medium">{(payment.pendingAmount || 0).toFixed(3)}</TableCell>
                                            </TableRow>
                                          ))}
                                          {items.length > 5 && (
                                            <TableRow>
                                              <TableCell colSpan={5} className="p-0 border-b-0">
                                                <Pagination page={eyeSupplierPage} setPage={setEyeSupplierPage} total={items.length} limit={5} />
                                              </TableCell>
                                            </TableRow>
                                          )}
                                        </>
                                      )
                                    })()}
                                  </TableBody>
                                </Table>
                              </div>
                            ) : (
                              <p className="text-center text-muted-foreground py-4 border rounded-md">{t.suppliers?.noPayments || "No supplier payments found."}</p>
                            )}
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>

                    <Dialog open={editingPaymeter?.id === pm.id} onOpenChange={(open) => !open && setEditingPaymeter(null)}>
                      <DialogTrigger render={
                        <Button variant="ghost" size="icon" onClick={() => setEditingPaymeter(pm)} title={t.settings.databaseTab.editPaymeter}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      } />
                      {editingPaymeter?.id === pm.id && (
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle>{t.settings.databaseTab.editPaymeter}</DialogTitle>
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
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" title={t.settings.databaseTab.deletePaymeter}>
                          <Trash className="h-4 w-4" />
                        </Button>
                      } />
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t.settings.databaseTab.deletePaymeterTitle}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t.settings.databaseTab.deletePaymeterConfirm}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(pm.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
    </div>
  )
}
