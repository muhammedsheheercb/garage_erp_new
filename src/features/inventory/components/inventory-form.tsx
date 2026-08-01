"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { InventoryFormValues, inventorySchema, openingStockSchema } from "../schema"
import { createInventoryItem, updateInventoryItem, getNextPartNumber, getInventoryItemOptions, addOpeningStockToItem } from "../actions"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "@/i18n"
import { Check, Search, X } from "lucide-react"

interface InventoryFormProps {
  initialData?: any
  onSuccess?: () => void
  openingStockMode?: boolean
}

type InventoryMutationResult =
  | Awaited<ReturnType<typeof addOpeningStockToItem>>
  | Awaited<ReturnType<typeof createInventoryItem>>
  | Awaited<ReturnType<typeof updateInventoryItem>>

export function InventoryForm({ initialData, onSuccess, openingStockMode = false }: InventoryFormProps) {
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const [selectedInventoryId, setSelectedInventoryId] = useState<string>("")
  const [itemSearch, setItemSearch] = useState("")
  const [isItemPickerOpen, setIsItemPickerOpen] = useState(false)
  const { data: itemOptions = [] } = useQuery({
    queryKey: ["inventory-item-options"],
    queryFn: getInventoryItemOptions,
    enabled: openingStockMode && !initialData,
  })
  const filteredItems = useMemo(() => {
    const search = itemSearch.trim().toLowerCase()
    if (!search) return itemOptions
    return itemOptions.filter((item) =>
      item.itemName.toLowerCase().includes(search) || item.partNumber.toLowerCase().includes(search)
    )
  }, [itemOptions, itemSearch])

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
    if (!initialData && !openingStockMode) {
      getNextPartNumber().then((val) => {
        setValue("partNumber", val)
      })
    }
  }, [initialData, openingStockMode, setValue])

  const mutation = useMutation<InventoryMutationResult, Error, InventoryFormValues>({
    mutationFn: (data: InventoryFormValues) => 
      initialData
        ? updateInventoryItem(initialData.id, data)
        : openingStockMode && selectedInventoryId
          ? addOpeningStockToItem(selectedInventoryId, data)
          : createInventoryItem(data, openingStockMode),
    onSuccess: (result) => {
      if ("success" in result && result.success === false) {
        toast.error(result.message || t.common.somethingWrong)
        return
      }
      toast.success(initialData ? t.inventoryMod.itemUpdated : t.inventoryMod.itemCreated)
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-item-options'] })
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
    if (openingStockMode && !initialData && !selectedInventoryId) {
      toast.error("Please select a saved item.")
      return
    }
    mutation.mutate(data)
  }

  const selectSavedItem = (itemName: string) => {
    const item = itemOptions.find((option) => option.itemName.toLowerCase() === itemName.trim().toLowerCase())
    setValue("itemName", itemName)
    setSelectedInventoryId(item?.id ?? "")
    if (item) {
      setValue("partNumber", item.partNumber)
      setValue("purchasePrice", item.purchasePrice)
      setValue("sellingPrice", item.sellingPrice)
    } else {
      setValue("partNumber", "")
    }
  }

  const clearSavedItem = () => {
    setItemSearch("")
    setSelectedInventoryId("")
    setValue("itemName", "")
    setValue("partNumber", "")
    setValue("purchasePrice", 0)
    setValue("sellingPrice", 0)
    setIsItemPickerOpen(true)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        <div className="space-y-2">
          <Label htmlFor="itemName">{t.inventoryMod.itemName} <span className="text-destructive">*</span></Label>
          {openingStockMode && !initialData ? (
            <div className="relative">
              <input type="hidden" {...register("itemName")} value={itemSearch} readOnly />
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="itemName"
                value={itemSearch}
                placeholder={t.inventoryMod.selectItem}
                autoComplete="off"
                required
                className="pl-9 pr-9"
                onFocus={() => setIsItemPickerOpen(true)}
                onBlur={() => window.setTimeout(() => setIsItemPickerOpen(false), 150)}
                onChange={(event) => {
                  const value = event.target.value
                  setItemSearch(value)
                  selectSavedItem(value)
                  setIsItemPickerOpen(true)
                }}
              />
              {itemSearch && (
                <button
                  type="button"
                  aria-label="Clear selected item"
                  className="absolute right-2 top-1.5 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={clearSavedItem}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              {isItemPickerOpen && (
                <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg">
                  <div className="max-h-60 overflow-y-auto p-1">
                    {filteredItems.length > 0 ? filteredItems.map((item) => {
                      const isSelected = selectedInventoryId === item.id
                      return (
                        <button
                          key={item.id}
                          type="button"
                          className="flex w-full items-center justify-between rounded-sm px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            setItemSearch(item.itemName)
                            selectSavedItem(item.itemName)
                            setIsItemPickerOpen(false)
                          }}
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{item.itemName}</span>
                            <span className="block text-xs text-muted-foreground">{item.partNumber}</span>
                          </span>
                          {isSelected && <Check className="ml-3 h-4 w-4 shrink-0 text-primary" />}
                        </button>
                      )
                    }) : (
                      <p className="px-3 py-4 text-center text-sm text-muted-foreground">No matching items found.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Input id="itemName" placeholder="Brake Pads" required {...register("itemName")} />
          )}
        {errors.itemName && <p className="text-sm text-destructive">{String(errors.itemName.message)}</p>}
        {openingStockMode && !initialData && selectedInventoryId && (
          <p className="text-xs text-muted-foreground">Selected item prices loaded. You can adjust them before saving.</p>
        )}
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
