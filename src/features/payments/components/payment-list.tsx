"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { getPayments, getPendingInvoices } from "../actions"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Plus, FileText, ChevronLeft, ChevronRight, CreditCard, Banknote, Landmark, Wallet } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { PaymentForm } from "./payment-form"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"

export function PaymentList() {
  const router = useRouter()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"history" | "pending">("history")

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['payments', page, search],
    queryFn: () => getPayments(page, search)
  })

  const { data: pendingData, isLoading: pendingLoading } = useQuery({
    queryKey: ['pending-invoices'],
    queryFn: () => getPendingInvoices()
  })

  const getMethodIcon = (method: string) => {
    switch(method) {
      case 'CASH': return <Banknote className="h-4 w-4 mr-2" />
      case 'CARD': return <CreditCard className="h-4 w-4 mr-2" />
      case 'UPI': return <Wallet className="h-4 w-4 mr-2" />
      case 'TRANSFER': return <Landmark className="h-4 w-4 mr-2" />
      default: return null
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-center">
        <div className="flex space-x-2 w-full sm:w-auto">
          <Button 
            variant={activeTab === "history" ? "default" : "outline"} 
            onClick={() => setActiveTab("history")}
            className="flex-1 sm:flex-none"
          >
            Payment History
          </Button>
          <Button 
            variant={activeTab === "pending" ? "default" : "outline"} 
            onClick={() => setActiveTab("pending")}
            className="flex-1 sm:flex-none relative"
          >
            Pending Invoices
            {pendingData && pendingData.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-destructive text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {pendingData.length}
              </span>
            )}
          </Button>
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          {activeTab === "history" && (
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search payments..." 
                className="pl-8" 
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
              />
            </div>
          )}

          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger render={
              <Button className="w-full sm:w-auto whitespace-nowrap"><Plus className="mr-2 h-4 w-4" /> Record Payment</Button>
            } />
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>Record Payment</DialogTitle>
              </DialogHeader>
              <PaymentForm onSuccess={() => setIsAddOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {activeTab === "history" && (
        <div className="space-y-4">
          <div className="border rounded-md overflow-hidden bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount (OMR)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center h-24">Loading...</TableCell></TableRow>
                ) : historyData?.data.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center h-24">No payments found.</TableCell></TableRow>
                ) : (
                  historyData?.data.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>{new Date(payment.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>{payment.invoice.customer.name}</TableCell>
                      <TableCell>
                        <Button 
                          variant="link" 
                          className="h-auto p-0 text-primary" 
                          onClick={() => router.push(`/invoices/${payment.invoice.id}/print`)}
                        >
                          INV-{payment.invoice.id.split('-')[0].toUpperCase()}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          {getMethodIcon(payment.method)}
                          {payment.method}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        +{payment.amount.toFixed(3)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {historyData?.meta && historyData.meta.totalPages > 1 && (
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
                Page {page} of {historyData.meta.totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(historyData.meta.totalPages, p + 1))}
                disabled={page === historyData.meta.totalPages}
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </div>
      )}

      {activeTab === "pending" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pendingLoading ? (
            <div className="col-span-full text-center py-12 text-muted-foreground">Loading pending invoices...</div>
          ) : pendingData?.length === 0 ? (
            <div className="col-span-full text-center py-12 text-muted-foreground">No pending payments! All caught up.</div>
          ) : (
            pendingData?.map((inv) => {
              const paidAmount = inv.payments.reduce((acc, p) => acc + p.amount, 0)
              const due = inv.grandTotal - paidAmount
              
              return (
                <div key={inv.id} className="border rounded-lg p-5 bg-card flex flex-col justify-between shadow-sm">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-semibold text-lg">{inv.customer.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          INV-{inv.id.split('-')[0].toUpperCase()}
                        </p>
                      </div>
                      <Badge variant={inv.status === 'PARTIAL' ? 'secondary' : 'destructive'}>
                        {inv.status}
                      </Badge>
                    </div>
                    
                    <div className="space-y-1 text-sm mb-6">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total:</span>
                        <span>{inv.grandTotal.toFixed(3)} OMR</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Paid:</span>
                        <span className="text-green-600">{paidAmount.toFixed(3)} OMR</span>
                      </div>
                      <div className="flex justify-between font-bold border-t pt-1 mt-1">
                        <span>Due:</span>
                        <span className="text-destructive">{due.toFixed(3)} OMR</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => router.push(`/invoices/${inv.id}/print`)}
                    >
                      <FileText className="h-4 w-4 mr-2" /> View
                    </Button>
                    <Dialog open={payingInvoiceId === inv.id} onOpenChange={(open) => setPayingInvoiceId(open ? inv.id : null)}>
                      <DialogTrigger render={
                        <Button className="flex-1"><Plus className="h-4 w-4 mr-2" /> Pay</Button>
                      } />
                      {payingInvoiceId === inv.id && (
                        <DialogContent className="max-w-xl">
                          <DialogHeader>
                            <DialogTitle>Record Payment for {inv.customer.name}</DialogTitle>
                          </DialogHeader>
                          <PaymentForm initialInvoiceId={inv.id} onSuccess={() => setPayingInvoiceId(null)} />
                        </DialogContent>
                      )}
                    </Dialog>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
