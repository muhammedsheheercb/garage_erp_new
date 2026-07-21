"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { MechanicFormValues, mechanicSchema } from "../schema"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createMechanic, updateMechanic } from "../actions"
import { toast } from "sonner"
import { useTranslation } from "@/i18n"

interface MechanicFormProps {
  initialData?: MechanicFormValues & { id?: string }
  onSuccess?: () => void
}

export function MechanicForm({ initialData, onSuccess }: MechanicFormProps) {
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  
  const { register, handleSubmit, formState: { errors } } = useForm<MechanicFormValues>({
    resolver: zodResolver(mechanicSchema),
    defaultValues: {
      name: initialData?.name || "",
      email: initialData?.email || "",
      phone: initialData?.phone || "",
    }
  })

  const mutation = useMutation({
    mutationFn: async (data: MechanicFormValues) => {
      if (initialData?.id) {
        return updateMechanic(initialData.id, data)
      }
      return createMechanic(data)
    },
    onSuccess: () => {
      toast.success(initialData?.id ? t.mechanics.mechanicUpdated : t.mechanics.mechanicAdded)
      queryClient.invalidateQueries({ queryKey: ['mechanics'] })
      onSuccess?.()
    },
    onError: () => {
      toast.error(t.common.somethingWrong)
    }
  })

  const onSubmit = (data: MechanicFormValues) => {
    mutation.mutate(data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">{t.common.name} <span className="text-destructive">*</span></Label>
        <Input id="name" placeholder={t.mechanics.namePlaceholder} {...register("name")} />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="phone">{t.common.phone} <span className="text-destructive">*</span></Label>
        <Input id="phone" placeholder={t.mechanics.phonePlaceholder} {...register("phone")} />
        {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">{t.common.email}</Label>
        <Input id="email" type="email" placeholder={t.mechanics.emailPlaceholder} {...register("email")} />
        {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
      </div>

      <div className="pt-4 flex justify-end">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? t.common.saving : t.mechanics.saveMechanic}
        </Button>
      </div>
    </form>
  )
}
