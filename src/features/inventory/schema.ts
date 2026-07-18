import { z } from "zod"

export const inventorySchema = z.object({
  itemName: z.string().min(2, "Item name must be at least 2 characters"),
  partNumber: z.string().min(1, "Part number is required"),
  quantity: z.number().int().min(0, "Quantity cannot be negative"),
  minStockLevel: z.number().int().min(0, "Min stock level cannot be negative"),
  purchasePrice: z.number().min(0.01, "Purchase price must be greater than 0"),
  sellingPrice: z.number().min(0.01, "Selling price must be greater than 0"),
  supplierId: z.string().min(1, "Supplier is required"),
})

export type InventoryFormValues = z.infer<typeof inventorySchema>
