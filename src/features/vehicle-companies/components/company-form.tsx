"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createVehicleCompany, updateVehicleCompany } from "../actions"
import { companyCreateSchema, type CompanyCreateFormValues } from "../schema"
import { toast } from "sonner"
import { useTranslation } from "@/i18n"

export function CompanyForm({ company, onSuccess }: { company?: { id: string; name: string }; onSuccess: () => void }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { register, handleSubmit, formState: { errors } } = useForm<CompanyCreateFormValues>({
    resolver: zodResolver(companyCreateSchema),
    defaultValues: { name: company?.name || "", modelName: company ? "existing" : "" },
  })
  const mutation = useMutation({
    mutationFn: (data: CompanyCreateFormValues) => company ? updateVehicleCompany(company.id, { name: data.name }) : createVehicleCompany(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicle-companies"] })
      queryClient.invalidateQueries({ queryKey: ["vehicle-catalog"] })
      toast.success(company ? t.common.update : t.common.save)
      onSuccess()
    },
    onError: (error: Error) => toast.error(error.message || t.common.somethingWrong),
  })
  return <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
    <div className="space-y-2"><Label htmlFor="company-name">{t.vehicles.companyName} <span className="text-destructive">*</span></Label><Input id="company-name" {...register("name")} autoFocus />{errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}</div>
    {!company && <div className="space-y-2"><Label htmlFor="first-model-name">{t.vehicles.model} <span className="text-destructive">*</span></Label><Input id="first-model-name" {...register("modelName")} />{errors.modelName && <p className="text-sm text-destructive">{errors.modelName.message}</p>}</div>}
    <div className="flex justify-end"><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? t.common.saving : t.common.save}</Button></div>
  </form>
}
