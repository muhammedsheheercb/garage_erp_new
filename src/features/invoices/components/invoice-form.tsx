"use client"

import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { InvoiceFormValues, invoiceSchema } from "../schema"
import { createInvoice, updateInvoice, getDropdownData } from "../actions"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useEffect, useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Trash, Trash2, Loader2, ClipboardList, AlertTriangle } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useTranslation } from "@/i18n"

export function InvoiceForm({ initialData, onSuccess }: { initialData?: any, onSuccess?: () => void }) {
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const isPaidLock = initialData?.status === "PAID"

  const [otherChargesList, setOtherChargesList] = useState<Array<{ name: string; amount: number | string }>>(() => {
    if (initialData?.otherCharges) {
      try {
        const parsed = JSON.parse(initialData.otherCharges)
        if (Array.isArray(parsed)) return parsed
      } catch (e) {}
    }
    return []
  })
  
  const { data: dropdownData, isLoading: dropdownLoading } = useQuery({
    queryKey: ['invoice-dropdowns'],
    queryFn: () => getDropdownData()
  })

  const [isJobCardModalOpen, setIsJobCardModalOpen] = useState(false)

  const { register, handleSubmit, control, watch, setValue, getValues, formState: { errors } } = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      jobCardId: initialData?.jobCardId || "",
      customerId: initialData?.customerId || "",
      serviceCharge: initialData?.serviceCharge ?? 0,
      labourCharge: initialData?.labourCharge ?? 0,
      partsCost: initialData?.partsCost ?? 0,
      discount: initialData?.discount ?? 0,
      tax: initialData?.tax ?? 0,
      servicesDetails: initialData?.servicesDetails || "",
      partsDetails: initialData?.partsDetails || "",
      otherCharges: initialData?.otherCharges || "[]",
      status: initialData?.status || "UNPAID",
    }
  })

  useEffect(() => {
    setValue("otherCharges", JSON.stringify(otherChargesList))
  }, [otherChargesList, setValue])

  const watchService = watch("serviceCharge") || 0
  const watchLabour = watch("labourCharge") || 0
  const watchParts = watch("partsCost") || 0
  const watchDiscount = watch("discount") || 0
  const watchTax = watch("tax") || 0

  const otherChargesSum = otherChargesList.reduce((acc, c) => acc + (parseFloat(c.amount as string) || 0), 0)

  const subTotal = (parseFloat(watchService.toString()) || 0) + (parseFloat(watchLabour.toString()) || 0) + (parseFloat(watchParts.toString()) || 0) + otherChargesSum
  const grandTotal = subTotal - (parseFloat(watchDiscount.toString()) || 0) + (parseFloat(watchTax.toString()) || 0)

  // Auto-fill customerId when jobCardId changes
  const watchJobCardId = watch("jobCardId")
  useEffect(() => {
    if (watchJobCardId && dropdownData?.jobCards) {
      const jc = dropdownData.jobCards.find((jc: any) => jc.id === watchJobCardId)
      if (jc && !initialData) {
        if (getValues("customerId") !== jc.customerId) {
          setValue("customerId", jc.customerId)
        }
        // Auto-load totals
        setValue("serviceCharge", jc.serviceTotal || 0)
        setValue("labourCharge", 0) // Leave labour blank for manual entry
        setValue("partsCost", jc.partsTotal || 0)
        setValue("discount", jc.discount || 0)
        setValue("tax", jc.tax || 0)
        
        // Auto-generate details text
        if (jc.services && jc.services.length > 0) {
          const servicesText = jc.services.map((s: any) => `${s.service.name} (${t.invoicesMod.qty}: ${s.quantity})`).join(", ")
          setValue("servicesDetails", servicesText)
        }
        if (jc.parts && jc.parts.length > 0) {
          const partsText = jc.parts.map((p: any) => `${p.batch.inventory.itemName} (${t.invoicesMod.qty}: ${p.quantity})`).join(", ")
          setValue("partsDetails", partsText)
        }
      }
    }
  }, [watchJobCardId, dropdownData, setValue, getValues, t])

  const mutation = useMutation({
    mutationFn: (data: InvoiceFormValues) => 
      initialData ? updateInvoice(initialData.id, data) : createInvoice(data),
    onSuccess: () => {
      toast.success(initialData ? t.invoicesMod.invoiceUpdated : t.invoicesMod.invoiceCreated)
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['invoice-dropdowns'] })
      onSuccess?.()
    },
    onError: (error: any) => {
      toast.error(error.message || t.common.somethingWrong)
    }
  })

  if (dropdownLoading) return <div>{t.common.loading}</div>

  const availableJobCards = dropdownData?.jobCards || []
  if (initialData?.jobCard && !availableJobCards.find((jc: any) => jc.id === initialData.jobCard.id)) {
    availableJobCards.push(initialData.jobCard)
  }

  const selectedJobCardDetails = availableJobCards.find((jc: any) => jc.id === watchJobCardId)

  const onSubmit = (data: InvoiceFormValues) => {
    mutation.mutate(data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {isPaidLock && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-md border border-destructive/20 mb-4">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold text-sm">{t.invoicesMod.invoiceLockedTitle}</p>
            <p className="text-xs">{t.invoicesMod.invoiceLockedDesc}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        <div className="space-y-2 col-span-1">
          <Label htmlFor="jobCardId">{t.invoicesMod.jobCardVehicle} <span className="text-destructive">*</span></Label>
          <div className="flex items-center gap-2">
            <Controller
              control={control}
              name="jobCardId"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value} disabled={!!initialData || isPaidLock}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={t.invoicesMod.selectJobCard}>
                      {(val: string) => {
                        const jc = availableJobCards.find((j: any) => j.id === val)
                        return jc ? `${jc.vehicle?.plateNumber} - ${jc.customer?.name}` : null
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {availableJobCards.map((jc: any) => (
                      <SelectItem key={jc.id} value={jc.id}>
                        {jc.vehicle?.plateNumber} - {jc.customer?.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {watchJobCardId && selectedJobCardDetails && (
              <Dialog open={isJobCardModalOpen} onOpenChange={setIsJobCardModalOpen}>
                <DialogTrigger render={
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="icon" 
                    className="shrink-0"
                    title={t.invoicesMod.viewJobCardDetails}
                  >
                    <ClipboardList className="h-4 w-4" />
                  </Button>
                } />
                <DialogContent className="max-w-6xl max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{t.invoicesMod.jobCardDetailsTitle}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-6 mt-4">
                    <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg">
                      <div>
                        <p className="text-sm text-muted-foreground">{t.jobcards.vehicle}</p>
                        <p className="font-medium">{selectedJobCardDetails.vehicle?.plateNumber} ({selectedJobCardDetails.vehicle?.brand} {selectedJobCardDetails.vehicle?.model})</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t.jobcards.customer}</p>
                        <p className="font-medium">{selectedJobCardDetails.customer?.name} - {selectedJobCardDetails.customer?.phone}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-sm text-muted-foreground">{t.jobcards.complaintIssue}</p>
                        <p className="font-medium whitespace-pre-wrap">{selectedJobCardDetails.complaint}</p>
                      </div>
                      {selectedJobCardDetails.workDone && (
                        <div className="col-span-2">
                          <p className="text-sm text-muted-foreground">{t.jobcards.workDone}</p>
                          <p className="font-medium whitespace-pre-wrap">{selectedJobCardDetails.workDone}</p>
                        </div>
                      )}
                      {selectedJobCardDetails.notes && (
                        <div className="col-span-2">
                          <p className="text-sm text-muted-foreground">{t.jobcards.notesRemarks}</p>
                          <p className="font-medium whitespace-pre-wrap">{selectedJobCardDetails.notes}</p>
                        </div>
                      )}
                    </div>
                    
                    {selectedJobCardDetails.services && selectedJobCardDetails.services.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2">{t.jobcards.services}</h4>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{t.services.serviceName}</TableHead>
                              <TableHead>{t.invoicesMod.qty}</TableHead>
                              <TableHead className="text-right">{t.invoicesMod.price}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedJobCardDetails.services.map((s: any) => (
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

                    {selectedJobCardDetails.parts && selectedJobCardDetails.parts.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2">{t.jobcards.parts}</h4>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{t.inventoryMod.item}</TableHead>
                              <TableHead>{t.invoicesMod.qty}</TableHead>
                              <TableHead className="text-right">{t.invoicesMod.price}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedJobCardDetails.parts.map((p: any) => (
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
              </Dialog>
            )}
          </div>
          {errors.jobCardId && <p className="text-sm text-destructive">{errors.jobCardId.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="customerId">{t.jobcards.customer}</Label>
          <Controller
            control={control}
            name="customerId"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value} disabled>
                <SelectTrigger>
                  <SelectValue placeholder={t.invoicesMod.autoFilledJobCard}>
                    {(val: string) => dropdownData?.customers.find((c: any) => c.id === val)?.name || null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {dropdownData?.customers.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.customerId && <p className="text-sm text-destructive">{errors.customerId.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="serviceCharge">{t.invoicesMod.serviceCharge} (OMR)</Label>
          <Input 
            id="serviceCharge" 
            type="number" 
            step="0.001" 
            readOnly
            aria-readonly="true"
            className="bg-muted cursor-not-allowed"
            {...register("serviceCharge", { valueAsNumber: true })} 
          />
          {errors.serviceCharge && <p className="text-sm text-destructive">{errors.serviceCharge.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="labourCharge">{t.invoicesMod.labourCharge} (OMR)</Label>
          <Input 
            id="labourCharge" 
            type="number" 
            step="0.001" 
            disabled={isPaidLock}
            {...register("labourCharge", { valueAsNumber: true })} 
          />
          {errors.labourCharge && <p className="text-sm text-destructive">{errors.labourCharge.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="partsCost">{t.invoicesMod.partsCost} (OMR)</Label>
          <Input 
            id="partsCost" 
            type="number" 
            step="0.001" 
            readOnly
            aria-readonly="true"
            className="bg-muted cursor-not-allowed"
            {...register("partsCost", { valueAsNumber: true })} 
          />
          {errors.partsCost && <p className="text-sm text-destructive">{errors.partsCost.message}</p>}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="discount">{t.invoicesMod.discount} (OMR)</Label>
          <Input 
            id="discount" 
            type="number" 
            step="0.001" 
            disabled={isPaidLock}
            {...register("discount", { valueAsNumber: true })} 
          />
          {errors.discount && <p className="text-sm text-destructive">{errors.discount.message}</p>}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="tax">{t.invoicesMod.tax} (OMR)</Label>
          <Input 
            id="tax" 
            type="number" 
            step="0.001" 
            disabled={isPaidLock}
            {...register("tax", { valueAsNumber: true })} 
          />
          {errors.tax && <p className="text-sm text-destructive">{errors.tax.message}</p>}
        </div>

      </div>

      {/* Other Amounts List Builder */}
      <div className="space-y-3 border p-4 rounded-md bg-muted/20">
        <div className="flex justify-between items-center">
          <Label className="text-base font-semibold">{t.invoicesMod.otherCharges}</Label>
          {!isPaidLock && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOtherChargesList(prev => [...prev, { name: "", amount: 0 }])}
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> {t.invoicesMod.addCharge}
            </Button>
          )}
        </div>
        {otherChargesList.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t.invoicesMod.noOtherCharges}</p>
        ) : (
          <div className="space-y-2">
            {otherChargesList.map((charge, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  placeholder={t.invoicesMod.chargeName}
                  value={charge.name}
                  onChange={(e) => {
                    const newList = [...otherChargesList]
                    newList[idx].name = e.target.value
                    setOtherChargesList(newList)
                  }}
                  disabled={isPaidLock}
                  className="flex-1"
                />
                <Input
                  type="number"
                  step="0.001"
                  min="0"
                  placeholder={t.invoicesMod.amount}
                  value={charge.amount}
                  onChange={(e) => {
                    const newList = [...otherChargesList]
                    const val = parseFloat(e.target.value) || 0
                    newList[idx].amount = Math.max(0, val)
                    setOtherChargesList(newList)
                  }}
                  disabled={isPaidLock}
                  className="w-32"
                />
                {!isPaidLock && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      setOtherChargesList(prev => prev.filter((_, i) => i !== idx))
                    }}
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="servicesDetails">{t.invoicesMod.servicesDetails}</Label>
        <Textarea 
          id="servicesDetails" 
          placeholder={t.invoicesMod.servicesDetailsDesc}
          readOnly
          {...register("servicesDetails")} 
        />
        {errors.servicesDetails && <p className="text-sm text-destructive">{errors.servicesDetails.message}</p>}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="partsDetails">{t.invoicesMod.partsDetails}</Label>
        <Textarea 
          id="partsDetails" 
          placeholder={t.invoicesMod.partsDetailsDesc}
          readOnly
          {...register("partsDetails")} 
        />
        {errors.partsDetails && <p className="text-sm text-destructive">{errors.partsDetails.message}</p>}
      </div>

      <div className="bg-muted p-4 rounded-md space-y-2 mt-4 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t.invoicesMod.subTotal}:</span>
          <span>{subTotal.toFixed(3)} OMR</span>
        </div>
        <div className="flex justify-between font-bold text-base border-t pt-2 border-border">
          <span>{t.invoicesMod.grandTotal}:</span>
          <span>{grandTotal.toFixed(3)} OMR</span>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={() => onSuccess?.()}>{t.common.cancel}</Button>
        <Button type="submit" disabled={mutation.isPending || isPaidLock}>
          {mutation.isPending ? t.common.saving : t.invoicesMod.saveInvoice}
        </Button>
      </div>
    </form>
  )
}
