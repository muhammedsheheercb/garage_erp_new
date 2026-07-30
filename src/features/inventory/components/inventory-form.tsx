"use client"

import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { InventoryFormValues, inventorySchema, openingStockSchema } from "../schema"
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
  openingStockMode?: boolean
}

export function InventoryForm({ initialData, onSuccess, openingStockMode = false }: InventoryFormProps) {
  const queryClient = useQueryClient()
  const { t } = useTranslation()

  const formSchema = openingStockMode ? openingStockSchema : inventorySchema
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<any>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      itemName: initialData?.itemName || "",
      partNumber: initialData?.partNumber || "",
      openingStock: 0,
      purchasePrice: initialData?.purchasePrice ?? 0,
      sellingPrice: initialData?.sellingPrice ?? undefined,
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
      initialData ? updateInventoryItem(initialData.id, data) : createInventoryItem(data, openingStockMode),
    onSuccess: (result) => {
      if ("success" in result && result.success === false) {
        toast.error(result.message || t.common.somethingWrong)
        return
      }
      toast.success(initialData ? t.inventoryMod.itemUpdated : t.inventoryMod.itemCreated)
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      queryClient.invalidateQueries({ queryKey: ['purchases'] })
      queryClient.invalidateQueries({ queryKey: ['purchase-dropdowns'] })
      queryClient.invalidateQueries({ queryKey: ['jobcards'] })
      queryClient.invalidateQueries({ queryKey: ['jobcards-dropdowns'] })
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
          <Input id="itemName" placeholder="Brake Pads" required {...register("itemName")} />
        {errors.itemName && <p className="text-sm text-destructive">{String(errors.itemName.message)}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="partNumber">{t.inventoryMod.partNumber} <span className="text-destructive">*</span></Label>
          <Input id="partNumber" placeholder={t.inventoryMod.generatingPartNo} readOnly className="bg-muted" {...register("partNumber")} />
          {errors.partNumber && <p className="text-sm text-destructive">{String(errors.partNumber.message)}</p>}
        </div>

      </div>

      {!initialData && openingStockMode && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="openingStock">{t.inventoryMod.openingStock}</Label>
            <Input id="openingStock" type="number" min="0" step="1" {...register("openingStock", { valueAsNumber: true })} />
            {errors.openingStock && <p className="text-sm text-destructive">{String(errors.openingStock.message)}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="purchasePrice">{t.inventoryMod.pur}</Label>
            <Input id="purchasePrice" type="number" min="0" step="0.001" {...register("purchasePrice", { valueAsNumber: true })} />
            {errors.purchasePrice && <p className="text-sm text-destructive">{String(errors.purchasePrice.message)}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="sellingPrice">{t.inventoryMod.sel} <span className="text-destructive">*</span></Label>
            <Input id="sellingPrice" type="number" min="0" step="0.001" required {...register("sellingPrice", { valueAsNumber: true })} />
            {errors.sellingPrice && <p className="text-sm text-destructive">{String(errors.sellingPrice.message)}</p>}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={() => onSuccess?.()}>{t.common.cancel}</Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? t.common.saving : t.inventoryMod.saveItem}
        </Button>
      </div>
    </form>
  )
}
