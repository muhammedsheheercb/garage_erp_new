import { z } from "zod"

export const inventorySchema = z.object({
  itemName: z.string().min(2, "Item name must be at least 2 characters"),
  partNumber: z.string().min(1, "Part number is required"),
})

export type InventoryFormValues = z.infer<typeof inventorySchema>
