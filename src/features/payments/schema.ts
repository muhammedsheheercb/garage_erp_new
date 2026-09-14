import { z } from "zod"

export const paymentSchema = z.object({
  invoiceId: z.string().min(1, "Invoice is required"),
  amount: z.number().finite("Amount is required").min(0, "Amount cannot be negative"),
  discountAmount: z.number().finite("Discount amount is required").min(0, "Discount amount cannot be negative"),
  method: z.enum(["CASH", "CARD", "TRANSFER"]),
}).refine((data) => data.amount > 0 || data.discountAmount > 0, {
  message: "Enter a payment amount or discount amount",
  path: ["amount"],
})

export type PaymentFormValues = z.infer<typeof paymentSchema>
