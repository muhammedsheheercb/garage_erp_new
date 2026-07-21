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
import { useTranslation } from "@/i18n"

export function PaymentForm({ onSuccess, initialInvoiceId }: { onSuccess?: () => void, initialInvoiceId?: string }) {
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const paymentMethodLabels: Record<string, string> = {
    CASH: t.payments.cash,
    CARD: t.payments.card,
    UPI: t.payments.upi,
    TRANSFER: t.payments.bankTransfer,
  }
  
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
      toast.success(t.payments.paymentRecordedSuccess)
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['pending-invoices'] })
      queryClient.invalidateQueries({ queryKey: ['pending-invoices-dropdown'] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      onSuccess?.()
    },
    onError: (error: any) => {
      toast.error(error.message || t.common.somethingWrong)
    }
  })

  const onSubmit = (data: PaymentFormValues) => {
    if (watchInvoiceId && invoices) {
      const inv = invoices.find(i => i.id === watchInvoiceId)
      if (inv && data.amount > inv.dueAmount) {
        toast.error(`${t.payments.amountExceedsDue} ${inv.dueAmount.toFixed(3)}`)
        return
      }
    }
    mutation.mutate(data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="invoiceId">{t.payments.invoice} <span className="text-destructive">*</span></Label>
        <Controller
          control={control}
          name="invoiceId"
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value} disabled={!!initialInvoiceId}>
              <SelectTrigger>
                <SelectValue placeholder={t.payments.selectPendingInvoice}>
                  {(val: string) => invoices?.find((i: any) => i.id === val)?.label || null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {isLoading ? (
                  <SelectItem value="loading" disabled>{t.common.loading}</SelectItem>
                ) : invoices?.length === 0 ? (
                  <SelectItem value="none" disabled>{t.payments.noPendingInvoices}</SelectItem>
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
          <Label htmlFor="amount">{t.payments.amount} (OMR) <span className="text-destructive">*</span></Label>
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
          <Label htmlFor="method">{t.payments.paymentMethod} <span className="text-destructive">*</span></Label>
          <Controller
            control={control}
            name="method"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger>
                  <SelectValue placeholder={t.payments.selectMethod}>
                    {(value: string) => paymentMethodLabels[value] || value}
                  </SelectValue>
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

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={() => onSuccess?.()}>{t.common.cancel}</Button>
        <Button type="submit" disabled={mutation.isPending || invoices?.length === 0}>
          {mutation.isPending ? t.common.saving : t.payments.recordPayment}
        </Button>
      </div>
    </form>
  )
}
