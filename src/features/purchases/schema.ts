import { z } from "zod"

export const purchaseItemSchema = z.object({
  inventoryId: z.string().min(1, "Item is required"),
  quantity: z.number().min(1, "Quantity must be at least 1"),
  purchasePrice: z.number().min(0, "Purchase price must be positive"),
  sellingPrice: z.number().min(0, "Selling price must be positive"),
})

export const purchaseSchema = z.object({
  id: z.string().optional(),
  purchaseDate: z.string().or(z.date()),
  supplierId: z.string().min(1, "Supplier is required"),
  paymentMethodId: z.string().min(1, "Payment method is required"),
  discount: z.number().min(0),
  paidAmount: z.number().min(0),
  items: z.array(purchaseItemSchema).min(1, "At least one item is required"),
})

export type PurchaseFormValues = z.infer<typeof purchaseSchema>
