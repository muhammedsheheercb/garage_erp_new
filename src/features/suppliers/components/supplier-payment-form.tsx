"use client"

import { Controller, useForm, useWatch } from "react-hook-form"
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

import { useEffect } from "react"

interface SupplierPaymentFormProps {
  supplierId: string
  purchases: any[]
  paymentMethods: { id: string; name: string }[]
  onSuccess?: () => void
}

export function SupplierPaymentForm({ supplierId, purchases, paymentMethods, onSuccess }: SupplierPaymentFormProps) {
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const getPaymentMethodLabel = (name: string) => ({
    "Direct Cash": t.payments.cash,
    "Direct Bank Transfer": t.payments.bankTransfer,
    "Direct Card": t.payments.card,
    "Direct UPI": t.payments.upi,
  }[name] || name)
  
  const { register, handleSubmit, control, setValue, formState: { errors } } = useForm<SupplierPaymentFormValues>({
    resolver: zodResolver(supplierPaymentSchema),
    defaultValues: {
      purchaseId: "",
      paymentSource: "PAYMETER",
      paymeterId: "",
      directPaymentMethod: undefined,
      amount: 0,
    }
  })

  const selectedPurchaseId = useWatch({ control, name: "purchaseId" })
  const selectedPurchase = purchases.find((purchase) => purchase.id === selectedPurchaseId)
  const currentMaxAmount = selectedPurchase?.pendingAmount ?? 0
  const paymentSource = useWatch({ control, name: "paymentSource" })

  useEffect(() => {
    setValue("amount", currentMaxAmount, { shouldValidate: true })
  }, [selectedPurchaseId, currentMaxAmount, setValue])

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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="bg-muted p-4 rounded-lg">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-muted-foreground">{t.invoicesMod.grandTotal}:</span>
          <span>{(selectedPurchase?.grandTotal ?? 0).toFixed(3)} OMR</span>
        </div>
        <div className="flex justify-between text-sm mb-1">
          <span className="text-muted-foreground">{t.purchases.paidAmount}:</span>
          <span className="text-green-600">{(selectedPurchase?.paidAmount ?? 0).toFixed(3)} OMR</span>
        </div>
        <div className="flex justify-between font-bold border-t pt-2 mt-2">
          <span>{t.purchases.pendingAmount}:</span>
          <span className="text-destructive">{currentMaxAmount.toFixed(3)} OMR</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="purchaseId">{t.purchases.purchaseNo} <span className="text-destructive">*</span></Label>
          <Controller
            control={control}
            name="purchaseId"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger id="purchaseId">
                  <SelectValue placeholder={t.suppliers.refNo}>
                    {(value: string) => purchases.find((purchase) => purchase.id === value)?.purchaseNumber || null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {purchases.filter((purchase) => purchase.pendingAmount > 0).map((purchase) => (
                    <SelectItem key={purchase.id} value={purchase.id}>
                      {purchase.purchaseNumber} — {purchase.pendingAmount.toFixed(3)} OMR {t.purchases.pending}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.purchaseId && <p className="text-sm text-destructive">{errors.purchaseId.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="amount">{t.payments.amount} (OMR) <span className="text-destructive">*</span></Label>
          <Input id="amount" type="number" step="0.001" min="0.001" max={currentMaxAmount} disabled={!selectedPurchase} {...register("amount", { valueAsNumber: true })} />
          {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="paymentSource">{t.payments.paymentMethod} <span className="text-destructive">*</span></Label>
          <Controller
            control={control}
            name="paymentSource"
            render={({ field }) => (
              <Select onValueChange={(value) => {
                field.onChange(value)
                setValue("paymeterId", "")
                setValue("directPaymentMethod", undefined)
              }} value={field.value}>
                <SelectTrigger id="paymentSource"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PAYMETER">{t.purchases.paymeterLedger}</SelectItem>
                  <SelectItem value="DIRECT">{t.payments.directPayment}</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>

        {paymentSource === "PAYMETER" ? (
        <div className="space-y-2">
          <Label htmlFor="paymeterId">{t.purchases.paymeterLedger} <span className="text-destructive">*</span></Label>
          <Controller
            control={control}
            name="paymeterId"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger id="paymeterId">
                  <SelectValue placeholder={t.payments.selectMethod} />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((method) => (
                    <SelectItem key={method.id} value={method.id}>{getPaymentMethodLabel(method.name)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.paymeterId && <p className="text-sm text-destructive">{errors.paymeterId.message}</p>}
        </div>
        ) : (
        <div className="space-y-2">
          <Label htmlFor="directPaymentMethod">{t.payments.paymentMethod} <span className="text-destructive">*</span></Label>
          <Controller
            control={control}
            name="directPaymentMethod"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value || ""}>
                <SelectTrigger id="directPaymentMethod"><SelectValue placeholder={t.payments.selectMethod} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">{t.payments.cash}</SelectItem>
                  <SelectItem value="BANK_TRANSFER">{t.payments.bankTransfer}</SelectItem>
                  <SelectItem value="CARD">{t.payments.card}</SelectItem>
                  <SelectItem value="UPI">{t.payments.upi}</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          {errors.directPaymentMethod && <p className="text-sm text-destructive">{errors.directPaymentMethod.message}</p>}
        </div>
        )}
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
