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
import { useTranslation } from "@/i18n"

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
  const { t } = useTranslation()
  
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
      toast.success(t.payments.paymentRecordedSuccess)
      queryClient.invalidateQueries({ queryKey: ['supplier', supplierId] })
      onSuccess?.()
    },
    onError: (error: any) => {
      toast.error(error.message || t.common.somethingWrong)
    }
  })

  const onSubmit = (data: SupplierPaymentFormValues) => {
    if (data.amount > currentMaxAmount) {
      toast.error(`${t.payments.amountExceedsDue} ${currentMaxAmount.toFixed(3)}`)
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
          <span className="text-muted-foreground">{t.payments.total}:</span>
          <span>{stats.cost.toFixed(3)} OMR</span>
        </div>
        <div className="flex justify-between text-sm mb-1">
          <span className="text-muted-foreground">{t.payments.paid}:</span>
          <span className="text-green-600">{stats.paid.toFixed(3)} OMR</span>
        </div>
        <div className="flex justify-between font-bold border-t pt-2 mt-2">
          <span>{t.purchases.pendingAmount}:</span>
          <span className="text-destructive">{stats.pending.toFixed(3)} OMR</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="amount">{t.payments.amount} (OMR) <span className="text-destructive">*</span></Label>
          <Input id="amount" type="number" step="0.001" max={currentMaxAmount} {...register("amount", { valueAsNumber: true })} />
          {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="method">{t.payments.paymentMethod} <span className="text-destructive">*</span></Label>
          <Controller
            control={control}
            name="method"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger>
                  <SelectValue placeholder={t.payments.selectMethod} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">{t.payments.cash}</SelectItem>
                  <SelectItem value="CARD">{t.payments.card}</SelectItem>
                  <SelectItem value="UPI">{t.payments.upi}</SelectItem>
                  <SelectItem value="TRANSFER">{t.payments.bankTransfer}</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          {errors.method && <p className="text-sm text-destructive">{errors.method.message}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="reference">{t.payments.reference}</Label>
        <Input id="reference" placeholder={t.payments.reference} {...register("reference")} />
        {errors.reference && <p className="text-sm text-destructive">{errors.reference.message}</p>}
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={() => onSuccess?.()}>{t.common.cancel}</Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? t.common.saving : t.payments.recordPayment}
        </Button>
      </div>
    </form>
  )
}
