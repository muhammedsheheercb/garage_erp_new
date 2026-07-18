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
  inventoryItems: any[]
  payments: any[]
  onSuccess?: () => void
}

export function SupplierPaymentForm({ supplierId, inventoryItems, payments, onSuccess }: SupplierPaymentFormProps) {
  const queryClient = useQueryClient()
  
  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<SupplierPaymentFormValues>({
    resolver: zodResolver(supplierPaymentSchema),
    defaultValues: {
      amount: 0,
      method: "CASH",
      reference: "",
      inventoryId: "none",
    }
  })

  // Watch selected inventoryId to calculate its pending amount
  const watchInventoryId = watch("inventoryId")
  const currentMaxAmount = watchInventoryId && watchInventoryId !== "none" ? (() => {
    const item = inventoryItems.find((i: any) => i.id === watchInventoryId)
    if (!item) return 0
    const totalCost = item.quantity * item.purchasePrice
    const paidForThisItem = payments.filter((p: any) => p.inventoryId === watchInventoryId).reduce((acc, curr) => acc + curr.amount, 0)
    return Math.max(0, totalCost - paidForThisItem)
  })() : (() => {
    const totalCost = inventoryItems.reduce((acc, curr) => acc + (curr.quantity * curr.purchasePrice), 0)
    const totalPaid = payments.reduce((acc, curr) => acc + curr.amount, 0)
    return Math.max(0, totalCost - totalPaid)
  })()

  useEffect(() => {
    if (watchInventoryId) {
      setValue("amount", currentMaxAmount)
    }
  }, [watchInventoryId, currentMaxAmount, setValue])

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
    // If 'none' is selected, don't pass inventoryId
    const submitData = { ...data }
    if (submitData.inventoryId === "none") {
      delete submitData.inventoryId
    }
    mutation.mutate(submitData)
  }

  const stats = watchInventoryId && watchInventoryId !== "none" ? (() => {
    const item = inventoryItems.find((i: any) => i.id === watchInventoryId)
    if (!item) return { cost: 0, paid: 0, pending: 0 }
    const cost = item.quantity * item.purchasePrice
    const paid = payments.filter((p: any) => p.inventoryId === watchInventoryId).reduce((acc, curr) => acc + curr.amount, 0)
    return { cost, paid, pending: cost - paid }
  })() : (() => {
    const cost = inventoryItems.reduce((acc, curr) => acc + (curr.quantity * curr.purchasePrice), 0)
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

      <div className="space-y-2">
        <Label htmlFor="inventoryId">Pay For Specific Transaction</Label>
        <Controller
          control={control}
          name="inventoryId"
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger>
                <SelectValue placeholder="General Supplier Payment (None selected)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">General Supplier Payment</SelectItem>
                {inventoryItems.map((item: any) => {
                  const cost = item.quantity * item.purchasePrice
                  const paid = payments.filter((p: any) => p.inventoryId === item.id).reduce((acc, curr) => acc + curr.amount, 0)
                  const pending = cost - paid
                  if (pending <= 0) return null
                  return (
                    <SelectItem key={item.id} value={item.id}>
                      {item.itemName} (Pending: {pending.toFixed(3)})
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          )}
        />
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
