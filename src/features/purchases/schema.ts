import { z } from "zod"

export const purchaseItemSchema = z.object({
  inventoryId: z.string().trim().min(1, "Item is required"),
  quantity: z.number().finite("Quantity is required").int("Quantity must be a whole number").min(1, "Quantity must be at least 1"),
  purchasePrice: z.number().finite("Purchase price is required").min(0, "Purchase price cannot be negative"),
  sellingPrice: z.number().finite("Selling price is required").min(0, "Selling price cannot be negative"),
  taxRate: z.number().finite("Tax rate must be a valid number").min(0, "Tax rate cannot be negative"),
})

export const purchaseSchema = z.object({
  id: z.string().optional(),
  purchaseDate: z.string().or(z.date()),
  supplierId: z.string().trim().min(1, "Supplier is required"),
  purchaseType: z.enum(["STOCK", "VEHICLE"]),
  jobCardId: z.string().optional().nullable(),
  paymentSource: z.enum(["PAYMETER", "DIRECT"]),
  paymentMethodId: z.string().trim().optional(),
  directPaymentMethod: z.enum(["CASH", "BANK_TRANSFER", "CARD"]).optional(),
  discount: z.number().finite("Discount is required").min(0, "Discount cannot be negative"),
  paidAmount: z.number().finite("Paid amount is required").min(0, "Paid amount cannot be negative"),
  items: z.array(purchaseItemSchema).min(1, "At least one item is required"),
}).superRefine((data, ctx) => {
  if (data.paymentSource === "PAYMETER" && !data.paymentMethodId) {
    ctx.addIssue({ code: "custom", path: ["paymentMethodId"], message: "Select a paymeter or ledger" })
  }
  if (data.paymentSource === "DIRECT" && !data.directPaymentMethod) {
    ctx.addIssue({ code: "custom", path: ["directPaymentMethod"], message: "Select a direct payment method" })
  }
  if (data.purchaseType === "VEHICLE" && !data.jobCardId) {
    ctx.addIssue({ code: "custom", path: ["jobCardId"], message: "Select a Job Card for vehicle purchase" })
  }

  const subTotal = (data.items || []).reduce((acc, it) => acc + Math.round((it.quantity || 0) * (it.purchasePrice || 0)), 0)
  const totalTax = (data.items || []).reduce((acc, it) => {
    const itemAmount = Math.round((it.quantity || 0) * (it.purchasePrice || 0))
    const taxRate = Number(it.taxRate) || 0
    return acc + Math.round((itemAmount * taxRate) / 100)
  }, 0)
  const grandTotal = Math.round(Math.max(0, subTotal + totalTax - (data.discount || 0)))

  if (data.discount > subTotal) {
    ctx.addIssue({ code: "custom", path: ["discount"], message: "Discount cannot exceed the purchase subtotal" })
  }
  if (data.paidAmount > grandTotal) {
    ctx.addIssue({ code: "custom", path: ["paidAmount"], message: "Paid amount cannot exceed Grand Total" })
  }
})

export type PurchaseFormValues = z.infer<typeof purchaseSchema>
