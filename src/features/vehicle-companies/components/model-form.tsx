"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createVehicleModel, updateVehicleModel } from "../actions"
import { modelSchema, type ModelFormValues } from "../schema"
import { toast } from "sonner"
import { useTranslation } from "@/i18n"

export function ModelForm({ companyId, model, onSuccess }: { companyId: string; model?: { id: string; name: string }; onSuccess: () => void }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { register, handleSubmit, formState: { errors } } = useForm<ModelFormValues>({ resolver: zodResolver(modelSchema), defaultValues: { companyId, name: model?.name || "" } })
  const mutation = useMutation({
    mutationFn: (data: ModelFormValues) => model ? updateVehicleModel(model.id, data) : createVehicleModel(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["vehicle-companies"] }); queryClient.invalidateQueries({ queryKey: ["vehicle-catalog"] }); toast.success(model ? t.common.update : t.common.save); onSuccess() },
    onError: (error: Error) => toast.error(error.message || t.common.somethingWrong),
  })
  return <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
    <input type="hidden" {...register("companyId")} />
    <div className="space-y-2"><Label htmlFor="model-name">{t.vehicles.model} <span className="text-destructive">*</span></Label><Input id="model-name" {...register("name")} autoFocus />{errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}</div>
    <div className="flex justify-end"><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? t.common.saving : t.common.save}</Button></div>
  </form>
}
