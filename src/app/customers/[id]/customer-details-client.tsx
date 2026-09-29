"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DatePickerWithRange } from "@/components/ui/date-range-picker"
import { DateRange } from "react-day-picker"
import { endOfDay } from "date-fns"
import { formatDisplayDate } from "@/lib/date-format"
import { ArrowLeft, CreditCard, Eye, Settings, Wrench } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { PaymentForm } from "@/features/payments/components/payment-form"

function getOtherChargesTotal(otherCharges: string | null | undefined) {
  if (!otherCharges) return 0

  try {
    const charges: unknown = JSON.parse(otherCharges)
    if (!Array.isArray(charges)) return 0

    return charges.reduce<number>((total, charge) => {
      if (!charge || typeof charge !== "object") return total
      const amount = (charge as { amount?: unknown }).amount
      return total + Math.max(0, Number(amount) || 0)
    }, 0)
  } catch {
    return 0
  }
}

function formatPaymentMethod(method: string) {
  if (method === "ADVANCE") return "Advance"
  return method.charAt(0) + method.slice(1).toLowerCase()
}

function PaymentHistoryTable({ payments, showVehicle = false }: { payments: any[], showVehicle?: boolean }) {
  if (payments.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No payment history found.</p>
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            {showVehicle && <TableHead>Vehicle</TableHead>}
            <TableHead>Job Card</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Created By</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((payment) => (
            <TableRow key={payment.id}>
              <TableCell>{formatDisplayDate(payment.paymentDate)}</TableCell>
              {showVehicle && <TableCell>{payment.vehiclePlateNumber || "—"}</TableCell>}
              <TableCell>{payment.jobCardId ? `JOB-${payment.jobCardId.split("-")[0].toUpperCase()}` : "Legacy payment"}</TableCell>
              <TableCell>{formatPaymentMethod(payment.method)}</TableCell>
              <TableCell>{payment.createdBy || "Admin"}</TableCell>
              <TableCell className="text-right font-medium text-green-600">{payment.amount.toFixed(3)} OMR</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function CustomerDetailsClient({ customer }: { customer: any }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: fromParam ? new Date(fromParam) : undefined,
    to: toParam ? new Date(toParam) : undefined
  })

  const [selectedJobCard, setSelectedJobCard] = useState<any>(null)
  const [payingJobCard, setPayingJobCard] = useState<any>(null)
  const [isCustomerPaymentHistoryOpen, setIsCustomerPaymentHistoryOpen] = useState(false)
  const [selectedVehicleForPaymentHistory, setSelectedVehicleForPaymentHistory] = useState<any>(null)
  const [jobPages, setJobPages] = useState<Record<string, number>>({})
  const [vehiclePage, setVehiclePage] = useState(1)

  const handleDateChange = (newDate: DateRange | undefined) => {
    setDateRange(newDate)
    const params = new URLSearchParams(searchParams.toString())
    if (newDate?.from) {
      params.set('from', newDate.from.toISOString())
    } else {
      params.delete('from')
    }
    
    if (newDate?.to) {
      params.set('to', endOfDay(newDate.to).toISOString())
    } else {
      params.delete('to')
    }
    
    router.push(`/customers/${customer.id}?${params.toString()}`)
  }

  const formatCurrency = (amount: number) => {
    return (
      <span className="inline-flex items-center gap-1">
        {(amount)}
        <Image src="/Omr_symbol.svg" alt="OMR" width={14} height={14} className="opacity-70" />
      </span>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/customers">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{customer.name}</h2>
            <p className="text-muted-foreground">{customer.phone || 'No phone'} | {customer.email || 'No email'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <DatePickerWithRange date={dateRange} setDate={handleDateChange} />
          <Button variant="outline" onClick={() => setIsCustomerPaymentHistoryOpen(true)}>
            <CreditCard className="mr-2 h-4 w-4" /> Payment History
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
            <Image src="/Omr_symbol.svg" alt="OMR" width={20} height={20} className="text-muted-foreground opacity-50" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(customer.overallTotalPaid)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pending</CardTitle>
            <Image src="/Omr_symbol.svg" alt="OMR" width={20} height={20} className="text-muted-foreground opacity-50" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(customer.overallTotalPending)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-semibold">Vehicles</h3>
        {customer.vehicles.length === 0 && (
          <p className="text-muted-foreground">No vehicles found.</p>
        )}
        
        {customer.vehicles.slice((vehiclePage - 1) * 5, vehiclePage * 5).map((vehicle: any) => (
          <Card key={vehicle.id} className="overflow-hidden">
            <CardHeader className="bg-muted/40">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{vehicle.plateNumber}</CardTitle>
                  <CardDescription>{vehicle.brand} {vehicle.model} {vehicle.year ? `(${vehicle.year})` : ''}</CardDescription>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">Vehicle Totals</div>
                    <div className="text-sm">
                      <span className="text-green-600 font-medium">Paid: {formatCurrency(vehicle.totalPaid)}</span>
                      {' | '}
                      <span className="text-red-600 font-medium">Pending: {formatCurrency(vehicle.totalPending)}</span>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setSelectedVehicleForPaymentHistory(vehicle)}>
                    <CreditCard className="mr-1 h-4 w-4" /> Payment History
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {vehicle.jobCards.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground text-center">No job cards in this period.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Pending</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-center">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vehicle.jobCards.slice(((jobPages[vehicle.id] || 1) - 1) * 5, (jobPages[vehicle.id] || 1) * 5).map((jc: any) => (
                      <TableRow key={jc.id}>
                        <TableCell>{formatDisplayDate(jc.createdAt)}</TableCell>
                        <TableCell>
                          <Badge variant={jc.status === 'COMPLETED' ? 'default' : jc.status === 'IN_PROGRESS' ? 'secondary' : 'outline'}>
                            {jc.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-green-600">{formatCurrency(jc.paidAmount)}</TableCell>
                        <TableCell className="text-right text-red-600">{formatCurrency(jc.pendingAmount)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(jc.invoice?.grandTotal ?? jc.grandTotal ?? 0)}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setSelectedJobCard(jc)}>
                              <Eye className="h-4 w-4 mr-1" /> View
                            </Button>
                            {jc.pendingAmount > 0 && (
                              <Button size="sm" onClick={() => setPayingJobCard(jc)}>
                                <CreditCard className="h-4 w-4 mr-1" /> Pay Balance
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {vehicle.jobCards.length > 5 && (
                <div className="flex items-center justify-end gap-2 p-3 text-sm">
                  <Button variant="outline" size="sm" onClick={() => setJobPages((pages) => ({ ...pages, [vehicle.id]: Math.max(1, (pages[vehicle.id] || 1) - 1) }))} disabled={(jobPages[vehicle.id] || 1) === 1}><span>Previous</span></Button>
                  <span className="text-muted-foreground">{jobPages[vehicle.id] || 1} / {Math.ceil(vehicle.jobCards.length / 5)}</span>
                  <Button variant="outline" size="sm" onClick={() => setJobPages((pages) => ({ ...pages, [vehicle.id]: Math.min(Math.ceil(vehicle.jobCards.length / 5), (pages[vehicle.id] || 1) + 1) }))} disabled={(jobPages[vehicle.id] || 1) === Math.ceil(vehicle.jobCards.length / 5)}><span>Next</span></Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {customer.vehicles.length > 5 && (
          <div className="flex items-center justify-end gap-2 text-sm">
            <Button variant="outline" size="sm" onClick={() => setVehiclePage((page) => Math.max(1, page - 1))} disabled={vehiclePage === 1}>Previous</Button>
            <span className="text-muted-foreground">{vehiclePage} / {Math.ceil(customer.vehicles.length / 5)}</span>
            <Button variant="outline" size="sm" onClick={() => setVehiclePage((page) => Math.min(Math.ceil(customer.vehicles.length / 5), page + 1))} disabled={vehiclePage === Math.ceil(customer.vehicles.length / 5)}>Next</Button>
          </div>
        )}
      </div>

      <Dialog open={isCustomerPaymentHistoryOpen} onOpenChange={setIsCustomerPaymentHistoryOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] max-h-[90vh] overflow-y-auto sm:w-[min(96vw,1400px)] sm:max-w-[min(96vw,1400px)]">
          <DialogHeader>
            <DialogTitle>Payment History — {customer.name}</DialogTitle>
            <CardDescription>All payments recorded for this customer{dateRange?.from ? " in the selected period" : ""}.</CardDescription>
          </DialogHeader>
          <PaymentHistoryTable payments={customer.paymentHistory} showVehicle />
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedVehicleForPaymentHistory} onOpenChange={(open) => !open && setSelectedVehicleForPaymentHistory(null)}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] max-h-[90vh] overflow-y-auto sm:w-[min(96vw,1400px)] sm:max-w-[min(96vw,1400px)]">
          <DialogHeader>
            <DialogTitle>Payment History — {selectedVehicleForPaymentHistory?.plateNumber}</DialogTitle>
          </DialogHeader>
          {selectedVehicleForPaymentHistory && (
            <PaymentHistoryTable
              payments={customer.paymentHistory.filter((payment: any) => payment.vehicleId === selectedVehicleForPaymentHistory.id)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedJobCard} onOpenChange={(open) => !open && setSelectedJobCard(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Job Card Details</DialogTitle>
          </DialogHeader>
          
          {selectedJobCard && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Status: </span>
                  <Badge>{selectedJobCard.status}</Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Date: </span>
                  {formatDisplayDate(selectedJobCard.createdAt, true)}
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Complaint: </span>
                  <p className="mt-1">{selectedJobCard.complaint}</p>
                </div>
                {selectedJobCard.workDone && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Work Done: </span>
                    <p className="mt-1">{selectedJobCard.workDone}</p>
                  </div>
                )}
              </div>

              <div>
                <h4 className="flex items-center text-md font-semibold mb-2">
                  <Wrench className="h-4 w-4 mr-2" /> Services Performed
                </h4>
                {selectedJobCard.services?.length > 0 ? (
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Service</TableHead>
                          <TableHead className="text-right">Price</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedJobCard.services.map((js: any) => (
                          <TableRow key={js.id}>
                            <TableCell>{js.service.name}</TableCell>
                            <TableCell className="text-right">{formatCurrency(js.price)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No services recorded.</p>
                )}
              </div>

              <div>
                <h4 className="flex items-center text-md font-semibold mb-2">
                  <Settings className="h-4 w-4 mr-2" /> Parts Used
                </h4>
                {selectedJobCard.parts?.length > 0 ? (
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Part</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Price</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedJobCard.parts.map((jp: any) => (
                          <TableRow key={jp.id}>
                            <TableCell>
                              {jp.batch.inventory.itemName} ({jp.batch.inventory.partNumber})
                            </TableCell>
                            <TableCell className="text-right">{jp.quantity}</TableCell>
                            <TableCell className="text-right">{formatCurrency(jp.price)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(jp.quantity * jp.price)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No parts recorded.</p>
                )}
              </div>
              
              {selectedJobCard.invoice && (
                <div className="bg-muted p-4 rounded-md">
                  <h4 className="text-md font-semibold mb-2">Financial Summary</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Services Total:</span>
                      <span>{formatCurrency(selectedJobCard.invoice.serviceCharge)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Labour Charge:</span>
                      <span>{formatCurrency(selectedJobCard.invoice.labourCharge)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Parts Total:</span>
                      <span>{formatCurrency(selectedJobCard.invoice.partsCost)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Other Charges:</span>
                      <span>{formatCurrency(getOtherChargesTotal(selectedJobCard.invoice.otherCharges))}</span>
                    </div>
                    {selectedJobCard.invoice.discount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Discount:</span>
                        <span>-{formatCurrency(selectedJobCard.invoice.discount)}</span>
                      </div>
                    )}
                    {selectedJobCard.invoice.tax > 0 && (
                      <div className="flex justify-between">
                        <span>Tax:</span>
                        <span>{formatCurrency(selectedJobCard.invoice.tax)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold pt-2 border-t mt-2">
                      <span>Grand Total:</span>
                      <span>{formatCurrency(selectedJobCard.invoice.grandTotal)}</span>
                    </div>
                    <div className="flex justify-between text-green-600 font-semibold">
                      <span>Paid Amount:</span>
                      <span>{formatCurrency(selectedJobCard.paidAmount)}</span>
                    </div>
                    <div className="flex justify-between text-red-600 font-semibold">
                      <span>Pending Amount:</span>
                      <span>{formatCurrency(selectedJobCard.pendingAmount)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!payingJobCard} onOpenChange={(open) => !open && setPayingJobCard(null)}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] max-h-[92dvh] overflow-y-auto sm:w-[min(94vw,720px)] sm:max-w-[min(94vw,720px)] sm:p-6">
          <DialogHeader>
            <DialogTitle>
              Pay Balance — JOB-{payingJobCard?.id.split("-")[0].toUpperCase()}
            </DialogTitle>
          </DialogHeader>
          {payingJobCard && (
            <>
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Outstanding balance</span>
                  <span className="font-semibold text-destructive">{formatCurrency(payingJobCard.pendingAmount)}</span>
                </div>
              </div>
              <PaymentForm
                initialJobCardId={payingJobCard.id}
                onSuccess={() => {
                  setPayingJobCard(null)
                  router.refresh()
                }}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
