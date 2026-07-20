"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { SupplierPaymentFormValues, supplierPaymentSchema } from "../schema"
import { createSupplierPayment } from "../actions"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Controller } from "react-hook-form"

import { useEffect } from "react"

interface SupplierPaymentFormProps {
  supplierId: string
  purchases: any[]
  payments: any[]
  onSuccess?: () => void
}

export function SupplierPaymentForm({ supplierId, purchases, payments, onSuccess }: SupplierPaymentFormProps) {
  const queryClient = useQueryClient()
  
  const { register, handleSubmit, control, setValue, formState: { errors } } = useForm<SupplierPaymentFormValues>({
    resolver: zodResolver(supplierPaymentSchema),
    defaultValues: {
      amount: 0,
      method: "CASH",
      reference: "",
    }
  })

  // We don't link payments to specific purchases anymore, it's just a general payment
  // but if we did, we'd use purchaseId. For now, it's a general payment against the total balance.
  const currentMaxAmount = (() => {
    const totalCost = purchases.reduce((acc, curr) => acc + curr.grandTotal, 0)
    const totalPaid = payments.reduce((acc, curr) => acc + curr.amount, 0)
    return Math.max(0, totalCost - totalPaid)
  })()

  useEffect(() => {
    setValue("amount", currentMaxAmount)
  }, [currentMaxAmount, setValue])

  const mutation = useMutation({
    mutationFn: (data: SupplierPaymentFormValues) => createSupplierPayment(supplierId, data),
    onSuccess: () => {
      toast.success("Payment recorded successfully")
      queryClient.invalidateQueries({ queryKey: ['supplier', supplierId] })
      onSuccess?.()
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save payment")
    }
  })

  const onSubmit = (data: SupplierPaymentFormValues) => {
    if (data.amount > currentMaxAmount) {
      toast.error(`Amount cannot exceed pending total of ${currentMaxAmount.toFixed(3)}`)
      return
    }
    const submitData = { ...data }
    mutation.mutate(submitData)
  }

  const stats = (() => {
    const cost = purchases.reduce((acc, curr) => acc + curr.grandTotal, 0)
    const paid = payments.reduce((acc, curr) => acc + curr.amount, 0)
    return { cost, paid, pending: cost - paid }
  })()

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="bg-muted p-4 rounded-lg">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-muted-foreground">Total Parts Cost:</span>
          <span>{stats.cost.toFixed(3)} OMR</span>
        </div>
        <div className="flex justify-between text-sm mb-1">
          <span className="text-muted-foreground">Total Paid:</span>
          <span className="text-green-600">{stats.paid.toFixed(3)} OMR</span>
        </div>
        <div className="flex justify-between font-bold border-t pt-2 mt-2">
          <span>Pending Amount:</span>
          <span className="text-destructive">{stats.pending.toFixed(3)} OMR</span>
        </div>
      </div>



      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="amount">Amount (OMR) <span className="text-destructive">*</span></Label>
          <Input id="amount" type="number" step="0.001" max={currentMaxAmount} {...register("amount", { valueAsNumber: true })} />
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

      <div className="space-y-2">
        <Label htmlFor="reference">Reference / Details</Label>
        <Input id="reference" placeholder="Check #1234 or Bank Transfer" {...register("reference")} />
        {errors.reference && <p className="text-sm text-destructive">{errors.reference.message}</p>}
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={() => onSuccess?.()}>Cancel</Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : "Record Payment"}
        </Button>
      </div>
    </form>
  )
}
