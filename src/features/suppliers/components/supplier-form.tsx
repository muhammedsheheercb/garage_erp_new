"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { SupplierFormValues, supplierSchema } from "../schema"
import { createSupplier, updateSupplier } from "../actions"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Textarea } from "@/components/ui/textarea"
import { useTranslation } from "@/i18n"

interface SupplierFormProps {
  initialData?: any
  onSuccess?: () => void
}

export function SupplierForm({ initialData, onSuccess }: SupplierFormProps) {
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  
  const { register, handleSubmit, formState: { errors } } = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: initialData?.name || "",
      contact: initialData?.contact || "",
      email: initialData?.email || "",
      address: initialData?.address || "",
    }
  })

  const mutation = useMutation({
    mutationFn: (data: SupplierFormValues) => 
      initialData ? updateSupplier(initialData.id, data) : createSupplier(data),
    onSuccess: () => {
      toast.success(initialData ? t.suppliers.supplierUpdated : t.suppliers.supplierCreated)
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      queryClient.invalidateQueries({ queryKey: ['supplier', initialData?.id] })
      onSuccess?.()
    },
    onError: (error: any) => {
      toast.error(error.message || t.common.somethingWrong)
    }
  })

  const onSubmit = (data: SupplierFormValues) => {
    mutation.mutate(data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">{t.suppliers.supplierName} <span className="text-destructive">*</span></Label>
        <Input id="name" placeholder="Auto Parts LLC" {...register("name")} />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="contact">{t.suppliers.contact} <span className="text-destructive">*</span></Label>
          <Input id="contact" placeholder="+968 1234 5678" {...register("contact")} />
          {errors.contact && <p className="text-sm text-destructive">{errors.contact.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">{t.common.email}</Label>
          <Input id="email" type="email" placeholder="contact@autoparts.com" {...register("email")} />
          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">{t.common.address}</Label>
        <Textarea id="address" placeholder="123 Industrial Area, Muscat" {...register("address")} />
        {errors.address && <p className="text-sm text-destructive">{errors.address.message}</p>}
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={() => onSuccess?.()}>{t.common.cancel}</Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? t.common.saving : t.suppliers.saveSupplier}
        </Button>
      </div>
    </form>
  )
}
