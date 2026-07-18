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
import { useEffect } from "react"

export function InvoiceForm({ initialData, onSuccess }: { initialData?: any, onSuccess?: () => void }) {
  const queryClient = useQueryClient()
  
  const { data: dropdownData, isLoading: dropdownLoading } = useQuery({
    queryKey: ['invoice-dropdowns'],
    queryFn: () => getDropdownData()
  })

  const { register, handleSubmit, control, watch, setValue, getValues, formState: { errors } } = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: initialData || {
      jobCardId: "",
      customerId: "",
      serviceCharge: 0,
      labourCharge: 0,
      partsCost: 0,
      discount: 0,
      tax: 0,
      servicesDetails: "",
      partsDetails: "",
    }
  })

  const watchService = watch("serviceCharge") || 0
  const watchLabour = watch("labourCharge") || 0
  const watchParts = watch("partsCost") || 0
  const watchDiscount = watch("discount") || 0
  const watchTax = watch("tax") || 0

  const subTotal = (parseFloat(watchService.toString()) || 0) + (parseFloat(watchLabour.toString()) || 0) + (parseFloat(watchParts.toString()) || 0)
  const grandTotal = subTotal - (parseFloat(watchDiscount.toString()) || 0) + (parseFloat(watchTax.toString()) || 0)

  // Auto-fill customerId when jobCardId changes
  const watchJobCardId = watch("jobCardId")
  useEffect(() => {
    if (watchJobCardId && dropdownData?.jobCards) {
      const jc = dropdownData.jobCards.find((jc: any) => jc.id === watchJobCardId)
      if (jc && getValues("customerId") !== jc.customerId) {
        setValue("customerId", jc.customerId)
        // Auto-load totals
        setValue("serviceCharge", jc.serviceTotal || 0)
        setValue("labourCharge", 0) // Leave labour blank for manual entry
        setValue("partsCost", jc.partsTotal || 0)
        setValue("discount", jc.discount || 0)
        setValue("tax", jc.tax || 0)
        
        // Auto-generate details text
        if (jc.services && jc.services.length > 0) {
          const servicesText = jc.services.map((s: any) => `${s.service.name} (Qty: ${s.quantity})`).join(", ")
          setValue("servicesDetails", servicesText)
        }
        if (jc.parts && jc.parts.length > 0) {
          const partsText = jc.parts.map((p: any) => `${p.inventory.itemName} (Qty: ${p.quantity})`).join(", ")
          setValue("partsDetails", partsText)
        }
      }
    }
  }, [watchJobCardId, dropdownData, setValue, getValues])

  const mutation = useMutation({
    mutationFn: (data: InvoiceFormValues) => 
      initialData ? updateInvoice(initialData.id, data) : createInvoice(data),
    onSuccess: () => {
      toast.success(initialData ? "Invoice updated successfully" : "Invoice created successfully")
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['invoice-dropdowns'] })
      onSuccess?.()
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save invoice")
    }
  })

  if (dropdownLoading) return <div>Loading...</div>

  // Merge initialData job card into dropdown if editing so it stays selectable
  const availableJobCards = dropdownData?.jobCards || []
  if (initialData?.jobCard && !availableJobCards.find(jc => jc.id === initialData.jobCard.id)) {
    availableJobCards.push(initialData.jobCard)
  }

  const onSubmit = (data: InvoiceFormValues) => {
    mutation.mutate(data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        <div className="space-y-2">
          <Label htmlFor="jobCardId">Job Card / Vehicle <span className="text-destructive">*</span></Label>
          <Controller
            control={control}
            name="jobCardId"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value} disabled={!!initialData}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Job Card" />
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
          {errors.jobCardId && <p className="text-sm text-destructive">{errors.jobCardId.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="customerId">Customer</Label>
          <Controller
            control={control}
            name="customerId"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value} disabled>
                <SelectTrigger>
                  <SelectValue placeholder="Auto-filled from Job Card" />
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
          <Label htmlFor="serviceCharge">Service Charge (OMR)</Label>
          <Input 
            id="serviceCharge" 
            type="number" 
            step="0.001" 
            {...register("serviceCharge", { valueAsNumber: true })} 
          />
          {errors.serviceCharge && <p className="text-sm text-destructive">{errors.serviceCharge.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="labourCharge">Labour Charge (OMR)</Label>
          <Input 
            id="labourCharge" 
            type="number" 
            step="0.001" 
            {...register("labourCharge", { valueAsNumber: true })} 
          />
          {errors.labourCharge && <p className="text-sm text-destructive">{errors.labourCharge.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="partsCost">Parts Cost (OMR)</Label>
          <Input 
            id="partsCost" 
            type="number" 
            step="0.001" 
            {...register("partsCost", { valueAsNumber: true })} 
          />
          {errors.partsCost && <p className="text-sm text-destructive">{errors.partsCost.message}</p>}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="discount">Discount (OMR)</Label>
          <Input 
            id="discount" 
            type="number" 
            step="0.001" 
            {...register("discount", { valueAsNumber: true })} 
          />
          {errors.discount && <p className="text-sm text-destructive">{errors.discount.message}</p>}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="tax">Tax (OMR)</Label>
          <Input 
            id="tax" 
            type="number" 
            step="0.001" 
            {...register("tax", { valueAsNumber: true })} 
          />
          {errors.tax && <p className="text-sm text-destructive">{errors.tax.message}</p>}
        </div>

      </div>
      
      <div className="space-y-2">
        <Label htmlFor="servicesDetails">Services Details</Label>
        <Textarea 
          id="servicesDetails" 
          placeholder="Describe services provided..." 
          {...register("servicesDetails")} 
        />
        {errors.servicesDetails && <p className="text-sm text-destructive">{errors.servicesDetails.message}</p>}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="partsDetails">Parts Details</Label>
        <Textarea 
          id="partsDetails" 
          placeholder="List parts used..." 
          {...register("partsDetails")} 
        />
        {errors.partsDetails && <p className="text-sm text-destructive">{errors.partsDetails.message}</p>}
      </div>

      <div className="bg-muted p-4 rounded-md space-y-2 mt-4 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal:</span>
          <span>{subTotal.toFixed(3)} OMR</span>
        </div>
        <div className="flex justify-between font-bold text-base border-t pt-2 border-border">
          <span>Grand Total:</span>
          <span>{grandTotal.toFixed(3)} OMR</span>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={() => onSuccess?.()}>Cancel</Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : "Save Invoice"}
        </Button>
      </div>
    </form>
  )
}
