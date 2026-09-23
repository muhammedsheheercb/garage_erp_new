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
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Check, Search, X } from "lucide-react"
import { useTranslation } from "@/i18n"

export function PaymentForm({ onSuccess, initialJobCardId }: { onSuccess?: () => void, initialJobCardId?: string }) {
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const paymentMethodLabels: Record<string, string> = {
    CASH: t.payments.cash,
    CARD: t.payments.card,
    TRANSFER: t.payments.bankTransfer,
  }

  const { data: jobCards, isLoading } = useQuery({
    queryKey: ['pending-jobcards-dropdown'],
    queryFn: () => getPendingInvoicesDropdown()
  })
  const [jobCardSearch, setJobCardSearch] = useState("")
  const [isJobCardPickerOpen, setIsJobCardPickerOpen] = useState(false)
  const [jobCardPickerPosition, setJobCardPickerPosition] = useState<{ top: number; left: number; width: number } | null>(null)

  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      jobCardId: initialJobCardId || "",
      amount: 0,
      discountAmount: 0,
      method: "CASH"
    }
  })

  // Watch jobCardId to auto-fill amount with due amount
  const watchJobCardId = watch("jobCardId")
  const watchedPaymentAmount = watch("amount") || 0
  const watchedDiscountAmount = watch("discountAmount") || 0
  const selectedJobCard = jobCards?.find(i => i.id === watchJobCardId)
  const currentBalance = selectedJobCard?.dueAmount || 0
  const combinedAmount = Math.max(0, Number(watchedPaymentAmount) || 0) + Math.max(0, Number(watchedDiscountAmount) || 0)
  const remainingBalance = Math.max(0, currentBalance - combinedAmount)
  const exceedsBalance = combinedAmount > currentBalance
  const hasNegativeAmount = Number(watchedPaymentAmount) < 0 || Number(watchedDiscountAmount) < 0

  useEffect(() => {
    if (watchJobCardId && jobCards) {
      const inv = jobCards.find(i => i.id === watchJobCardId)
      if (inv) {
        setValue("amount", 0)
        setValue("discountAmount", 0)
      }
    }
  }, [watchJobCardId, jobCards, setValue])

  const mutation = useMutation({
    mutationFn: (data: PaymentFormValues) => createPayment(data),
    onSuccess: () => {
      toast.success(t.payments.paymentRecordedSuccess)
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['pending-jobcards'] })
      queryClient.invalidateQueries({ queryKey: ['pending-jobcards-dropdown'] })
      queryClient.invalidateQueries({ queryKey: ['jobcards'] })
      onSuccess?.()
    },
    onError: (error: any) => {
      toast.error(error.message || t.common.somethingWrong)
    }
  })

  const onSubmit = (data: PaymentFormValues) => {
    if (watchJobCardId && jobCards) {
      const inv = jobCards.find(i => i.id === watchJobCardId)
      if (inv && data.amount + (data.discountAmount || 0) > inv.dueAmount) {
        toast.error(`Payment amount and discount cannot exceed the available balance of ${(inv.dueAmount)} OMR`)
        return
      }
    }
    mutation.mutate(data)
  }

  const updateJobCardPickerPosition = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect()
    setJobCardPickerPosition({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 320) })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="jobCardId">{"Job Card"} <span className="text-destructive">*</span></Label>
        <Controller
          control={control}
          name="jobCardId"
          render={({ field }) => {
            const selectedJobCard = jobCards?.find((jobCard: any) => jobCard.id === field.value)
            const filteredjobCards = jobCards?.filter((jobCard: any) => jobCard.label.toLowerCase().includes(jobCardSearch.trim().toLowerCase())) || []
            return (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 z-10 h-4 w-4 text-muted-foreground" />
                <Input
                  value={isJobCardPickerOpen ? jobCardSearch : (selectedJobCard?.label || "")}
                  placeholder={"Select payable Job Card"}
                  className="pl-9 pr-9"
                  autoComplete="off"
                  disabled={!!initialJobCardId || isLoading}
                  onFocus={(event) => {
                    setJobCardSearch("")
                    setIsJobCardPickerOpen(true)
                    updateJobCardPickerPosition(event.currentTarget)
                  }}
                  onBlur={() => window.setTimeout(() => {
                    setIsJobCardPickerOpen(false)
                    setJobCardPickerPosition(null)
                  }, 150)}
                  onChange={(event) => {
                    setJobCardSearch(event.target.value)
                    field.onChange("")
                    setIsJobCardPickerOpen(true)
                    updateJobCardPickerPosition(event.currentTarget)
                  }}
                />
                {(selectedJobCard || jobCardSearch) && !initialJobCardId && <button type="button" aria-label="Clear Job Card" className="absolute right-2 top-1.5 z-10 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" onMouseDown={(event) => event.preventDefault()} onClick={(event) => {
                  const input = event.currentTarget.parentElement?.querySelector("input") as HTMLInputElement | null
                  field.onChange("")
                  setJobCardSearch("")
                  setIsJobCardPickerOpen(true)
                  if (input) updateJobCardPickerPosition(input)
                }}><X className="h-4 w-4" /></button>}
                {isJobCardPickerOpen && jobCardPickerPosition && typeof document !== "undefined" && createPortal(
                  <div className="fixed z-[100] max-h-60 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-lg" style={jobCardPickerPosition}>
                    {filteredjobCards.length > 0 ? filteredjobCards.map((jobCard: any) => (
                      <button key={jobCard.id} type="button" className="flex w-full items-center justify-between rounded-sm px-3 py-2 text-left text-sm hover:bg-accent" onMouseDown={(event) => event.preventDefault()} onClick={() => {
                        field.onChange(jobCard.id)
                        setJobCardSearch(jobCard.label)
                        setIsJobCardPickerOpen(false)
                        setJobCardPickerPosition(null)
                      }}>
                        <span>{jobCard.label}</span>
                        {field.value === jobCard.id && <Check className="ml-3 h-4 w-4 text-primary" />}
                      </button>
                    )) : <p className="px-3 py-4 text-center text-sm text-muted-foreground">No payable Job Cards</p>}
                  </div>, document.body
                )}
              </div>
            )
          }}
        />
        {errors.jobCardId && <p className="text-sm text-destructive">{errors.jobCardId.message}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
        <div className="order-1 min-h-[108px] space-y-2">
          <Label className="whitespace-nowrap text-xs" htmlFor="currentBalance">Balance Amount (OMR)</Label>
          <Input id="currentBalance" readOnly value={selectedJobCard ? currentBalance : ""} className="bg-muted font-medium tabular-nums" placeholder="Select an Job Card" />
        </div>
        <div className="order-3 min-h-[108px] space-y-2">
          <Label className="whitespace-nowrap text-xs" htmlFor="discountAmount">Discount (OMR)</Label>
          <Input
            id="discountAmount"
            type="number"
            step="any"
            min="0"
            max={currentBalance || undefined}
            {...register("discountAmount", { valueAsNumber: true })}
          />
          {errors.discountAmount && <p className="text-sm text-destructive">{errors.discountAmount.message}</p>}
          {watchedDiscountAmount < 0 && (
            <p className="text-sm text-destructive">
              Discount amount cannot be negative.
            </p>
          )}
        </div>

        <div className="order-2 min-h-[108px] space-y-2">
          <Label className="whitespace-nowrap text-xs" htmlFor="amount">Paid Amount (OMR) <span className="text-destructive">*</span></Label>
          <Input
            id="amount"
            type="number"
            step="any"
            min="0"
            max={currentBalance || undefined}
            {...register("amount", { valueAsNumber: true })}
          />
          {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
          {Number(watchedPaymentAmount) < 0 && <p className="text-sm text-destructive">Payment amount cannot be negative.</p>}
        </div>

        <div className="order-4 min-h-[108px] space-y-2">
          <Label className="whitespace-nowrap text-xs" htmlFor="remainingBalance">Remaining Balance (OMR)</Label>
          <Input id="remainingBalance" readOnly value={selectedJobCard ? remainingBalance : ""} className="bg-muted font-semibold tabular-nums" placeholder="Select an Job Card" />
        </div>
      </div>

      <div className="max-w-sm space-y-2 pt-1">
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
                  <SelectItem value="TRANSFER">{t.payments.bankTransfer}</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          {errors.method && <p className="text-sm text-destructive">{errors.method.message}</p>}
        </div>

      {selectedJobCard && (
        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          <p className="font-medium">Balance calculation</p>
          <div className="mt-1 flex justify-between"><span className="text-muted-foreground">{currentBalance} − {watchedPaymentAmount} − {watchedDiscountAmount}</span><span className="font-semibold">{remainingBalance} OMR</span></div>
          {(exceedsBalance || hasNegativeAmount) && <p className="mt-2 text-sm text-destructive">{hasNegativeAmount ? "Payment and discount amounts cannot be negative." : "Payment Amount + Discount Amount cannot exceed the current balance."}</p>}
        </div>
      )}

      <div className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => onSuccess?.()}>{t.common.cancel}</Button>
        <Button type="submit" className="w-full sm:w-auto" disabled={mutation.isPending || jobCards?.length === 0 || exceedsBalance || hasNegativeAmount}>
          {mutation.isPending ? t.common.saving : t.payments.recordPayment}
        </Button>
      </div>
    </form>
  )
}
