"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getInvoices, deleteInvoice } from "../actions"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Plus, Edit, Trash, ChevronLeft, ChevronRight, Printer, FileText, ClipboardList } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { InvoiceForm } from "./invoice-form"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

export function InvoiceList() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState<any>(null)
  const [viewingJobCard, setViewingJobCard] = useState<any>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', page, search],
    queryFn: () => getInvoices(page, search)
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteInvoice(id),
    onSuccess: () => {
      toast.success("Invoice deleted")
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
    }
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-center">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search invoices..." 
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
            <Button className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" /> Create Invoice</Button>
          } />
          <DialogContent className="max-w-5xl sm:max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Invoice</DialogTitle>
            </DialogHeader>
            <InvoiceForm onSuccess={() => setIsAddOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-md overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice ID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center h-24">Loading...</TableCell></TableRow>
            ) : data?.data.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center h-24">No invoices found.</TableCell></TableRow>
            ) : (
              data?.data.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">{invoice.id.split('-')[0].toUpperCase()}</TableCell>
                  <TableCell>{invoice.customer?.name}</TableCell>
                  <TableCell>{invoice.jobCard?.vehicle?.plateNumber}</TableCell>
                  <TableCell>{invoice.grandTotal.toFixed(3)} OMR</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs ${
                      invoice.status === 'PAID' ? 'bg-green-100 text-green-800' :
                      invoice.status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {invoice.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="ghost" size="icon" onClick={() => router.push(`/invoices/${invoice.id}/print`)} title="Print/Download Invoice">
                      <Printer className="h-4 w-4" />
                    </Button>
                    
                    {invoice.jobCard?.id && (
                      <Dialog open={viewingJobCard?.id === invoice.jobCard.id} onOpenChange={(open) => !open && setViewingJobCard(null)}>
                        <DialogTrigger render={
                          <Button variant="ghost" size="icon" onClick={() => setViewingJobCard(invoice.jobCard)} title="View Job Card">
                            <ClipboardList className="h-4 w-4" />
                          </Button>
                        } />
                        {viewingJobCard?.id === invoice.jobCard.id && (
                          <DialogContent className="max-w-6xl max-h-[85vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Job Card Details</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-6 mt-4 text-left">
                              <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg">
                                <div>
                                  <p className="text-sm text-muted-foreground">Vehicle</p>
                                  <p className="font-medium">{viewingJobCard.vehicle?.plateNumber} ({viewingJobCard.vehicle?.brand} {viewingJobCard.vehicle?.model})</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Customer</p>
                                  <p className="font-medium">{viewingJobCard.customer?.name} - {viewingJobCard.customer?.phone}</p>
                                </div>
                                <div className="col-span-2">
                                  <p className="text-sm text-muted-foreground">Complaint</p>
                                  <p className="font-medium whitespace-pre-wrap">{viewingJobCard.complaint}</p>
                                </div>
                                {viewingJobCard.workDone && (
                                  <div className="col-span-2">
                                    <p className="text-sm text-muted-foreground">Work Done</p>
                                    <p className="font-medium whitespace-pre-wrap">{viewingJobCard.workDone}</p>
                                  </div>
                                )}
                                {viewingJobCard.notes && (
                                  <div className="col-span-2">
                                    <p className="text-sm text-muted-foreground">Notes / Description</p>
                                    <p className="font-medium whitespace-pre-wrap">{viewingJobCard.notes}</p>
                                  </div>
                                )}
                              </div>
                              
                              {viewingJobCard.services && viewingJobCard.services.length > 0 && (
                                <div>
                                  <h4 className="font-semibold mb-2">Services</h4>
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Service</TableHead>
                                        <TableHead>Qty</TableHead>
                                        <TableHead className="text-right">Price</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {viewingJobCard.services.map((s: any) => (
                                        <TableRow key={s.id}>
                                          <TableCell>{s.service?.name}</TableCell>
                                          <TableCell>{s.quantity}</TableCell>
                                          <TableCell className="text-right">{s.price.toFixed(3)}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              )}

                              {viewingJobCard.parts && viewingJobCard.parts.length > 0 && (
                                <div>
                                  <h4 className="font-semibold mb-2">Parts Used</h4>
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Part / Item</TableHead>
                                        <TableHead>Qty</TableHead>
                                        <TableHead className="text-right">Price</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {viewingJobCard.parts.map((p: any) => (
                                        <TableRow key={p.id}>
                                          <TableCell>{p.batch?.inventory?.itemName}</TableCell>
                                          <TableCell>{p.quantity}</TableCell>
                                          <TableCell className="text-right">{p.price.toFixed(3)}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              )}
                            </div>
                          </DialogContent>
                        )}
                      </Dialog>
                    )}
                    
                    <Dialog open={editingInvoice?.id === invoice.id} onOpenChange={(open) => !open && setEditingInvoice(null)}>
                      <DialogTrigger render={
                        <Button variant="ghost" size="icon" onClick={() => setEditingInvoice(invoice)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      } />
                      {editingInvoice?.id === invoice.id && (
                        <DialogContent className="max-w-5xl sm:max-w-5xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Edit Invoice</DialogTitle>
                          </DialogHeader>
                          <InvoiceForm 
                            initialData={editingInvoice} 
                            onSuccess={() => setEditingInvoice(null)} 
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
                            This will permanently delete this invoice.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(invoice.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
