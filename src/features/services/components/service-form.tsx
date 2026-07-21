"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ServiceFormValues, serviceSchema } from "../schema"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createService, updateService } from "../actions"
import { toast } from "sonner"
import { useTranslation } from "@/i18n"

interface ServiceFormProps {
  initialData?: ServiceFormValues & { id?: string }
  onSuccess?: () => void
}

export function ServiceForm({ initialData, onSuccess }: ServiceFormProps) {
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  
  const { register, handleSubmit, formState: { errors } } = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: initialData?.name || "",
      category: initialData?.category || "",
      estimatedTime: initialData?.estimatedTime || "",
      price: initialData?.price || 0,
    }
  })

  const mutation = useMutation({
    mutationFn: async (data: ServiceFormValues) => {
      if (initialData?.id) {
        return updateService(initialData.id, data)
      }
      return createService(data)
    },
    onSuccess: () => {
      toast.success(initialData?.id ? t.services.serviceUpdated : t.services.serviceCreated)
      queryClient.invalidateQueries({ queryKey: ['services'] })
      onSuccess?.()
    },
    onError: () => {
      toast.error(t.common.somethingWrong)
    }
  })

  const onSubmit = (data: ServiceFormValues) => {
    mutation.mutate(data)
  }

  // Common garage services for quick selection
  const commonServices = [
    "Oil Change",
    "Brake Service",
    "Wheel Alignment",
    "Battery Change",
    "Engine Work",
    "General Service"
  ]

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">{t.services.serviceName} <span className="text-destructive">*</span></Label>
        <Input id="name" placeholder="E.g. Oil Change" {...register("name")} list="common-services" />
        <datalist id="common-services">
          {commonServices.map(service => (
            <option key={service} value={service} />
          ))}
        </datalist>
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="price">{t.services.price} <span className="text-destructive">*</span></Label>
        <Input id="price" type="number" step="0.01" {...register("price", { valueAsNumber: true })} />
        {errors.price && <p className="text-sm text-destructive">{errors.price.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">{t.services.category}</Label>
        <Input id="category" placeholder="E.g. Mechanical, Electrical..." {...register("category")} />
        {errors.category && <p className="text-sm text-destructive">{errors.category.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="estimatedTime">{t.services.estimatedTime}</Label>
        <Input id="estimatedTime" placeholder="E.g. 1 hour, 30 mins" {...register("estimatedTime")} />
        {errors.estimatedTime && <p className="text-sm text-destructive">{errors.estimatedTime.message}</p>}
      </div>

      <div className="pt-4 flex justify-end">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? t.common.saving : t.services.saveService}
        </Button>
      </div>
    </form>
  )
}
