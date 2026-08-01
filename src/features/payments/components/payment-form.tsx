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

export function PaymentForm({ onSuccess, initialInvoiceId }: { onSuccess?: () => void, initialInvoiceId?: string }) {
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const paymentMethodLabels: Record<string, string> = {
    CASH: t.payments.cash,
    CARD: t.payments.card,
    TRANSFER: t.payments.bankTransfer,
  }
  
  const { data: invoices, isLoading } = useQuery({
    queryKey: ['pending-invoices-dropdown'],
    queryFn: () => getPendingInvoicesDropdown()
  })
  const [invoiceSearch, setInvoiceSearch] = useState("")
  const [isInvoicePickerOpen, setIsInvoicePickerOpen] = useState(false)
  const [invoicePickerPosition, setInvoicePickerPosition] = useState<{ top: number; left: number; width: number } | null>(null)

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

  const updateInvoicePickerPosition = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect()
    setInvoicePickerPosition({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 320) })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="invoiceId">{t.payments.invoice} <span className="text-destructive">*</span></Label>
        <Controller
          control={control}
          name="invoiceId"
          render={({ field }) => {
            const selectedInvoice = invoices?.find((invoice: any) => invoice.id === field.value)
            const filteredInvoices = invoices?.filter((invoice: any) => invoice.label.toLowerCase().includes(invoiceSearch.trim().toLowerCase())) || []
            return (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 z-10 h-4 w-4 text-muted-foreground" />
                <Input
                  value={isInvoicePickerOpen ? invoiceSearch : (selectedInvoice?.label || "")}
                  placeholder={t.payments.selectPendingInvoice}
                  className="pl-9 pr-9"
                  autoComplete="off"
                  disabled={!!initialInvoiceId || isLoading}
                  onFocus={(event) => {
                    setInvoiceSearch("")
                    setIsInvoicePickerOpen(true)
                    updateInvoicePickerPosition(event.currentTarget)
                  }}
                  onBlur={() => window.setTimeout(() => {
                    setIsInvoicePickerOpen(false)
                    setInvoicePickerPosition(null)
                  }, 150)}
                  onChange={(event) => {
                    setInvoiceSearch(event.target.value)
                    field.onChange("")
                    setIsInvoicePickerOpen(true)
                    updateInvoicePickerPosition(event.currentTarget)
                  }}
                />
                {(selectedInvoice || invoiceSearch) && !initialInvoiceId && <button type="button" aria-label="Clear invoice" className="absolute right-2 top-1.5 z-10 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" onMouseDown={(event) => event.preventDefault()} onClick={(event) => {
                  const input = event.currentTarget.parentElement?.querySelector("input") as HTMLInputElement | null
                  field.onChange("")
                  setInvoiceSearch("")
                  setIsInvoicePickerOpen(true)
                  if (input) updateInvoicePickerPosition(input)
                }}><X className="h-4 w-4" /></button>}
                {isInvoicePickerOpen && invoicePickerPosition && typeof document !== "undefined" && createPortal(
                  <div className="fixed z-[100] max-h-60 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-lg" style={invoicePickerPosition}>
                    {filteredInvoices.length > 0 ? filteredInvoices.map((invoice: any) => (
                      <button key={invoice.id} type="button" className="flex w-full items-center justify-between rounded-sm px-3 py-2 text-left text-sm hover:bg-accent" onMouseDown={(event) => event.preventDefault()} onClick={() => {
                        field.onChange(invoice.id)
                        setInvoiceSearch(invoice.label)
                        setIsInvoicePickerOpen(false)
                        setInvoicePickerPosition(null)
                      }}>
                        <span>{invoice.label}</span>
                        {field.value === invoice.id && <Check className="ml-3 h-4 w-4 text-primary" />}
                      </button>
                    )) : <p className="px-3 py-4 text-center text-sm text-muted-foreground">{t.payments.noPendingInvoices}</p>}
                  </div>, document.body
                )}
              </div>
            )
          }}
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
