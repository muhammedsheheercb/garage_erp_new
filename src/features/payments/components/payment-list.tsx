"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { getPayments, getPendingInvoices } from "../actions"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Plus, FileText, ChevronLeft, ChevronRight, CreditCard, Banknote, Building, Wallet } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { PaymentForm } from "./payment-form"
import { useRouter, useSearchParams } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { useTranslation } from "@/i18n"
import { DatePickerWithRange } from "@/components/ui/date-range-picker"
import { DateRange } from "react-day-picker"
import { endOfDay } from "date-fns"
import { formatDisplayDate } from "@/lib/date-format"

export function PaymentList() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const paramFrom = searchParams.get("from")
  const paramTo = searchParams.get("to")
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [pendingSearch, setPendingSearch] = useState("")
  const [pendingPage, setPendingPage] = useState(1)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [payingJobCardId, setPayingJobCardId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"history" | "pending">("history")
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    if (paramFrom) {
      return {
        from: new Date(paramFrom),
        to: paramTo ? new Date(paramTo) : new Date(paramFrom)
      }
    }
    return undefined
  })
  const paymentMethodLabels: Record<string, string> = {
    CASH: t.payments.cash,
    CARD: t.payments.card,
    TRANSFER: t.payments.bankTransfer,
  }

  const fromDateStr = dateRange?.from?.toISOString()
  const toDateStr = dateRange?.to ? endOfDay(dateRange.to).toISOString() : undefined

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['payments', page, search, fromDateStr, toDateStr],
    queryFn: () => getPayments(page, search, fromDateStr, toDateStr)
  })

  const { data: pendingData, isLoading: pendingLoading } = useQuery({
    queryKey: ['pending-jobcards', pendingPage, pendingSearch],
    queryFn: () => getPendingInvoices(pendingPage, pendingSearch),
    enabled: activeTab === "pending",
  })

  const getMethodIcon = (method: string) => {
    switch(method) {
      case 'CASH': return <Banknote className="h-4 w-4 mr-2" />
      case 'CARD': return <CreditCard className="h-4 w-4 mr-2" />
      case 'TRANSFER': return <Building className="h-4 w-4 mr-2" />
      default: return null
    }
  }

  const pendingJobCards = pendingData?.data ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-center">
        <div className="flex space-x-2 w-full sm:w-auto">
          <Button 
            variant={activeTab === "history" ? "default" : "outline"} 
            onClick={() => setActiveTab("history")}
            className="flex-1 sm:flex-none"
          >
            {t.payments.paymentHistory}
          </Button>
          <Button 
            variant={activeTab === "pending" ? "default" : "outline"} 
            onClick={() => setActiveTab("pending")}
            className="flex-1 sm:flex-none relative"
          >
            {"Payable Job Cards"}
            {pendingData && pendingData.meta.total > 0 && (
              <span className="absolute -top-2 -right-2 bg-destructive text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {pendingData.meta.total}
              </span>
            )}
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {activeTab === "history" && (
            <>
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder={t.payments.searchPayments} 
                  className="pl-8 w-full" 
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
            </>
          )}
          {activeTab === "pending" && (
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={"Search by customer or vehicle number..."}
                className="pl-8 w-full"
                  value={pendingSearch}
                  onChange={(e) => { setPendingSearch(e.target.value); setPendingPage(1) }}
              />
            </div>
          )}

          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger render={
              <Button className="w-full sm:w-auto whitespace-nowrap"><Plus className="mr-2 h-4 w-4" /> {t.payments.recordPayment}</Button>
            } />
            <DialogContent className="w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] max-h-[92dvh] overflow-y-auto sm:w-[min(94vw,720px)] sm:max-w-[min(94vw,720px)] sm:p-6">
              <DialogHeader>
                <DialogTitle>{t.payments.recordPayment}</DialogTitle>
              </DialogHeader>
              <PaymentForm onSuccess={() => setIsAddOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {activeTab === "history" && (
        <div className="space-y-4">
          <div className="border rounded-md overflow-x-auto bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.payments.date}</TableHead>
                  <TableHead>{t.jobcards.customer}</TableHead>
                  <TableHead>{"Job Card"}</TableHead>
                  <TableHead>{t.payments.method}</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead className="text-right">{t.payments.amount} (OMR)</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center h-24">{t.common.loading}</TableCell></TableRow>
                ) : historyData?.data.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center h-24">{t.payments.noPayments}</TableCell></TableRow>
                ) : (
                  historyData?.data.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>{formatDisplayDate(payment.createdAt)}</TableCell>
                      <TableCell>{payment.jobCard?.customer.name || "—"}</TableCell>
                      <TableCell>
                        <Button 
                          variant="link" 
                          className="h-auto p-0 text-primary" 
                          onClick={() => payment.jobCard && router.push(`/jobcards/${payment.jobCard.id}/print`)}
                        >
                          {payment.jobCard ? `JOB-${payment.jobCard.id.split('-')[0].toUpperCase()}` : "Legacy payment"}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          {getMethodIcon(payment.method)}
                          {paymentMethodLabels[payment.method] || payment.method}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm font-medium text-muted-foreground">
                        {payment.createdBy || "Admin"}
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        +{(payment.amount)}
                      </TableCell>
                      <TableCell><Button variant="outline" size="sm" onClick={() => router.push(`/payments/${payment.id}/invoice`)}><FileText className="mr-2 h-4 w-4" />Invoice Bill</Button></TableCell>
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
                <ChevronLeft className="h-4 w-4 mr-1" /> {t.common.previous}
              </Button>
              <div className="text-sm text-muted-foreground">
                {t.common.page} {page} {t.common.of} {historyData.meta.totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(historyData.meta.totalPages, p + 1))}
                disabled={page === historyData.meta.totalPages}
              >
                {t.common.next} <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </div>
      )}

      {activeTab === "pending" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pendingLoading ? (
            <div className="col-span-full text-center py-12 text-muted-foreground">{t.common.loading}</div>
          ) : pendingData?.meta.total === 0 ? (
            <div className="col-span-full text-center py-12 text-muted-foreground">{t.payments.allCaughtUp}</div>
          ) : pendingJobCards.length === 0 ? (
            <div className="col-span-full text-center py-12 text-muted-foreground">{t.common.noResults}</div>
          ) : (
            pendingJobCards.map((inv) => {
              const paidAmount = inv.payments.reduce((acc, p) => acc + p.amount, 0)
              const due = inv.grandTotal - paidAmount
              
              return (
                <div key={inv.id} className="border rounded-lg p-5 bg-card flex flex-col justify-between shadow-sm">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-semibold text-lg">{inv.customer.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          JOB-{inv.id.split('-')[0].toUpperCase()}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {t.vehicles.plateNumber}: {inv.vehicle?.plateNumber || t.common.NA}
                        </p>
                      </div>
                      <Badge variant={inv.status === 'PARTIAL' ? 'secondary' : 'destructive'}>
                        {inv.status}
                      </Badge>
                    </div>
                    
                    <div className="space-y-1 text-sm mb-6">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t.payments.total}:</span>
                        <span>{(inv.grandTotal)} OMR</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t.payments.paid}:</span>
                        <span className="text-green-600">{(paidAmount)} OMR</span>
                      </div>
                      <div className="flex justify-between font-bold border-t pt-1 mt-1">
                        <span>{t.payments.due}:</span>
                        <span className="text-destructive">{(due)} OMR</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => router.push(`/payments/jobcard/${inv.id}/invoice`)}
                    >
                      <FileText className="h-4 w-4 mr-2" /> {t.payments.view}
                    </Button>
                    <Dialog open={payingJobCardId === inv.id} onOpenChange={(open) => setPayingJobCardId(open ? inv.id : null)}>
                      <DialogTrigger render={
                        <Button className="flex-1"><Plus className="h-4 w-4 mr-2" /> {t.payments.pay}</Button>
                      } />
                      {payingJobCardId === inv.id && (
                        <DialogContent className="w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] max-h-[92dvh] overflow-y-auto sm:w-[min(94vw,720px)] sm:max-w-[min(94vw,720px)] sm:p-6">
                          <DialogHeader>
                            <DialogTitle>{t.payments.recordPaymentFor} {inv.customer.name}</DialogTitle>
                          </DialogHeader>
                          <PaymentForm initialJobCardId={inv.id} onSuccess={() => setPayingJobCardId(null)} />
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
      {activeTab === "pending" && pendingData?.meta && pendingData.meta.totalPages > 1 && (
        <div className="flex items-center justify-end space-x-2 py-4">
          <Button variant="outline" size="sm" onClick={() => setPendingPage((page) => Math.max(1, page - 1))} disabled={pendingPage === 1}>
            <ChevronLeft className="h-4 w-4 mr-1" /> {t.common.previous}
          </Button>
          <div className="text-sm text-muted-foreground">
            {t.common.page} {pendingPage} {t.common.of} {pendingData.meta.totalPages}
          </div>
          <Button variant="outline" size="sm" onClick={() => setPendingPage((page) => Math.min(pendingData.meta.totalPages, page + 1))} disabled={pendingPage === pendingData.meta.totalPages}>
            {t.common.next} <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  )
}
