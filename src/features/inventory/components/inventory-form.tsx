"use client"

import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { InventoryFormValues, inventorySchema } from "../schema"
import { createInventoryItem, updateInventoryItem, getSuppliersDropdown } from "../actions"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface InventoryFormProps {
  initialData?: any
  onSuccess?: () => void
}

export function InventoryForm({ initialData, onSuccess }: InventoryFormProps) {
  const queryClient = useQueryClient()
  
  const { data: suppliers, isLoading: suppliersLoading } = useQuery({
    queryKey: ['suppliers-dropdown'],
    queryFn: () => getSuppliersDropdown()
  })

  const { register, handleSubmit, control, formState: { errors } } = useForm<InventoryFormValues>({
    resolver: zodResolver(inventorySchema),
    defaultValues: {
      itemName: initialData?.itemName || "",
      partNumber: initialData?.partNumber || "",
      quantity: initialData?.quantity ?? 0,
      minStockLevel: initialData?.minStockLevel ?? 5,
      purchasePrice: initialData?.purchasePrice ?? ("" as unknown as number),
      sellingPrice: initialData?.sellingPrice ?? ("" as unknown as number),
      supplierId: initialData?.supplierId || "",
    }
  })

  const mutation = useMutation({
    mutationFn: (data: InventoryFormValues) => 
      initialData ? updateInventoryItem(initialData.id, data) : createInventoryItem(data),
    onSuccess: () => {
      toast.success(initialData ? "Item updated successfully" : "Item created successfully")
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      onSuccess?.()
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save item")
    }
  })

  const onSubmit = (data: InventoryFormValues) => {
    mutation.mutate(data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        <div className="space-y-2">
          <Label htmlFor="itemName">Item Name <span className="text-destructive">*</span></Label>
          <Input id="itemName" placeholder="Brake Pads" {...register("itemName")} />
          {errors.itemName && <p className="text-sm text-destructive">{errors.itemName.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="partNumber">Part Number <span className="text-destructive">*</span></Label>
          <Input id="partNumber" placeholder="BP-12345" {...register("partNumber")} />
          {errors.partNumber && <p className="text-sm text-destructive">{errors.partNumber.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="quantity">Current Quantity <span className="text-destructive">*</span></Label>
          <Input 
            id="quantity" 
            type="number" 
            {...register("quantity", { valueAsNumber: true })} 
          />
          {errors.quantity && <p className="text-sm text-destructive">{errors.quantity.message}</p>}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="minStockLevel">Min Stock Level <span className="text-destructive">*</span></Label>
          <Input 
            id="minStockLevel" 
            type="number" 
            {...register("minStockLevel", { valueAsNumber: true })} 
          />
          {errors.minStockLevel && <p className="text-sm text-destructive">{errors.minStockLevel.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="purchasePrice">Purchase Price (OMR) <span className="text-destructive">*</span></Label>
          <Input 
            id="purchasePrice" 
            type="number" 
            step="0.001" 
            {...register("purchasePrice", { valueAsNumber: true })} 
          />
          {errors.purchasePrice && <p className="text-sm text-destructive">{errors.purchasePrice.message}</p>}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="sellingPrice">Selling Price (OMR) <span className="text-destructive">*</span></Label>
          <Input 
            id="sellingPrice" 
            type="number" 
            step="0.001" 
            {...register("sellingPrice", { valueAsNumber: true })} 
          />
          {errors.sellingPrice && <p className="text-sm text-destructive">{errors.sellingPrice.message}</p>}
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="supplierId">Supplier <span className="text-destructive">*</span></Label>
          <Controller
            control={control}
            name="supplierId"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value || ""}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliersLoading ? (
                    <SelectItem value="loading" disabled>Loading...</SelectItem>
                  ) : suppliers?.length === 0 ? (
                    <SelectItem value="none" disabled>No suppliers found</SelectItem>
                  ) : (
                    <>
                      {suppliers?.map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            )}
          />
          {errors.supplierId && <p className="text-sm text-destructive">{errors.supplierId.message}</p>}
        </div>

      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={() => onSuccess?.()}>Cancel</Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : "Save Item"}
        </Button>
      </div>
    </form>
  )
}
