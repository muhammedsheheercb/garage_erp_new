import { z } from "zod"

export const inventorySchema = z.object({
  itemName: z.string().trim().min(2, "Item name must be at least 2 characters"),
  partNumber: z.string().trim().min(1, "Part number is required"),
  openingStock: z.preprocess((value) => value === "" || Number.isNaN(value) || value === undefined ? 0 : value, z.number().finite("Opening stock is required").int("Opening stock must be a whole number").min(0, "Opening stock cannot be negative")).default(0),
  purchasePrice: z.preprocess((value) => value === "" || Number.isNaN(value) || value === undefined ? 0 : value, z.number().finite("Purchase price must be a number").min(0, "Purchase price cannot be negative")).default(0),
  sellingPrice: z.preprocess((value) => value === "" || Number.isNaN(value) || value === undefined ? 0 : value, z.number().finite("Selling price cannot be negative").min(0, "Selling price cannot be negative")).default(0),
})

export const openingStockSchema = inventorySchema.extend({
  sellingPrice: z.number().finite("Selling price is required").min(0, "Selling price cannot be negative"),
})

export type InventoryFormValues = z.infer<typeof inventorySchema>
