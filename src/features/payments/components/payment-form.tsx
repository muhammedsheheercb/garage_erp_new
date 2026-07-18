"use client"

import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { PaymentFormValues, paymentSchema } from "../schema"
import { createPayment, getPendingInvoicesDropdown } from "../actions"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useEffect } from "react"

export function PaymentForm({ onSuccess, initialInvoiceId }: { onSuccess?: () => void, initialInvoiceId?: string }) {
  const queryClient = useQueryClient()
  
  const { data: invoices, isLoading } = useQuery({
    queryKey: ['pending-invoices-dropdown'],
    queryFn: () => getPendingInvoicesDropdown()
  })

  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      invoiceId: initialInvoiceId || "",
      amount: 0,
      method: "CASH"
    }
  })

  // Watch invoiceId to auto-fill amount with due amount
  const watchInvoiceId = watch("invoiceId")
  useEffect(() => {
    if (watchInvoiceId && invoices) {
      const inv = invoices.find(i => i.id === watchInvoiceId)
      if (inv) {
        setValue("amount", inv.dueAmount)
      }
    }
  }, [watchInvoiceId, invoices, setValue])

  const mutation = useMutation({
    mutationFn: (data: PaymentFormValues) => createPayment(data),
    onSuccess: () => {
      toast.success("Payment recorded successfully")
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['pending-invoices'] })
      queryClient.invalidateQueries({ queryKey: ['pending-invoices-dropdown'] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      onSuccess?.()
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save payment")
    }
  })

  const onSubmit = (data: PaymentFormValues) => {
    if (watchInvoiceId && invoices) {
      const inv = invoices.find(i => i.id === watchInvoiceId)
      if (inv && data.amount > inv.dueAmount) {
        toast.error(`Amount cannot exceed due amount of ${inv.dueAmount.toFixed(3)}`)
        return
      }
    }
    mutation.mutate(data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="invoiceId">Invoice <span className="text-destructive">*</span></Label>
        <Controller
          control={control}
          name="invoiceId"
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger>
                <SelectValue placeholder="Select Pending Invoice" />
              </SelectTrigger>
              <SelectContent>
                {isLoading ? (
                  <SelectItem value="loading" disabled>Loading...</SelectItem>
                ) : invoices?.length === 0 ? (
                  <SelectItem value="none" disabled>No pending invoices</SelectItem>
                ) : (
                  invoices?.map((inv: any) => (
                    <SelectItem key={inv.id} value={inv.id}>
                      {inv.label}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          )}
        />
        {errors.invoiceId && <p className="text-sm text-destructive">{errors.invoiceId.message}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="amount">Amount (OMR) <span className="text-destructive">*</span></Label>
          <Input 
            id="amount" 
            type="number" 
            step="0.001" 
            max={invoices?.find(i => i.id === watchInvoiceId)?.dueAmount}
            {...register("amount", { valueAsNumber: true })} 
          />
          {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="method">Payment Method <span className="text-destructive">*</span></Label>
          <Controller
            control={control}
            name="method"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="CARD">Card</SelectItem>
                  <SelectItem value="UPI">UPI</SelectItem>
                  <SelectItem value="TRANSFER">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          {errors.method && <p className="text-sm text-destructive">{errors.method.message}</p>}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={() => onSuccess?.()}>Cancel</Button>
        <Button type="submit" disabled={mutation.isPending || invoices?.length === 0}>
          {mutation.isPending ? "Saving..." : "Record Payment"}
        </Button>
      </div>
    </form>
  )
}
