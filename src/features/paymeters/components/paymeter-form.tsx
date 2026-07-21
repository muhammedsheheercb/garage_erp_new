"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { PaymeterFormValues, paymeterSchema } from "../schema"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createPaymeter, updatePaymeter } from "../actions"
import { toast } from "sonner"
import { useTranslation } from "@/i18n"

interface PaymeterFormProps {
  initialData?: PaymeterFormValues & { id?: string }
  onSuccess?: () => void
}

export function PaymeterForm({ initialData, onSuccess }: PaymeterFormProps) {
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  
  const { register, handleSubmit, formState: { errors } } = useForm<PaymeterFormValues>({
    resolver: zodResolver(paymeterSchema),
    defaultValues: {
      name: initialData?.name || "",
    }
  })

  const mutation = useMutation({
    mutationFn: async (data: PaymeterFormValues) => {
      if (initialData?.id) {
        return updatePaymeter(initialData.id, data)
      }
      return createPaymeter(data)
    },
    onSuccess: () => {
      toast.success(initialData?.id ? t.settings.databaseTab.paymeterUpdated : t.settings.databaseTab.paymeterCreated)
      queryClient.invalidateQueries({ queryKey: ['paymeters'] })
      onSuccess?.()
    },
    onError: (error: any) => {
      toast.error(error.message || t.common.somethingWrong)
    }
  })

  const onSubmit = (data: PaymeterFormValues) => {
    mutation.mutate(data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">{t.settings.databaseTab.paymeterName} <span className="text-destructive">*</span></Label>
        <Input id="name" placeholder={t.settings.databaseTab.paymeterNamePlaceholder} {...register("name")} />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      <div className="pt-4 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onSuccess}>{t.common.cancel}</Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? t.common.saving : t.settings.databaseTab.savePaymeter}
        </Button>
      </div>
    </form>
  )
}
