"use client"

import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { InventoryFormValues, inventorySchema } from "../schema"
import { createInventoryItem, updateInventoryItem, getNextPartNumber } from "../actions"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useEffect } from "react"
import { useTranslation } from "@/i18n"

interface InventoryFormProps {
  initialData?: any
  onSuccess?: () => void
}

export function InventoryForm({ initialData, onSuccess }: InventoryFormProps) {
  const queryClient = useQueryClient()
  const { t } = useTranslation()

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<InventoryFormValues>({
    resolver: zodResolver(inventorySchema),
    defaultValues: {
      itemName: initialData?.itemName || "",
      partNumber: initialData?.partNumber || "",
    }
  })

  useEffect(() => {
    if (!initialData) {
      getNextPartNumber().then((val) => {
        setValue("partNumber", val)
      })
    }
  }, [initialData, setValue])

  const mutation = useMutation({
    mutationFn: (data: InventoryFormValues) => 
      initialData ? updateInventoryItem(initialData.id, data) : createInventoryItem(data),
    onSuccess: () => {
      toast.success(initialData ? t.inventoryMod.itemUpdated : t.inventoryMod.itemCreated)
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      onSuccess?.()
    },
    onError: (error: any) => {
      toast.error(error.message || t.common.somethingWrong)
    }
  })

  const onSubmit = (data: InventoryFormValues) => {
    mutation.mutate(data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        <div className="space-y-2">
          <Label htmlFor="itemName">{t.inventoryMod.itemName} <span className="text-destructive">*</span></Label>
          <Input id="itemName" placeholder="Brake Pads" {...register("itemName")} />
          {errors.itemName && <p className="text-sm text-destructive">{errors.itemName.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="partNumber">{t.inventoryMod.partNumber} <span className="text-destructive">*</span></Label>
          <Input id="partNumber" placeholder={t.inventoryMod.generatingPartNo} readOnly className="bg-muted" {...register("partNumber")} />
          {errors.partNumber && <p className="text-sm text-destructive">{errors.partNumber.message}</p>}
        </div>

      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={() => onSuccess?.()}>{t.common.cancel}</Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? t.common.saving : t.inventoryMod.saveItem}
        </Button>
      </div>
    </form>
  )
}
