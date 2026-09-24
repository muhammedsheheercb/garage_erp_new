import { z } from "zod"

export const paymentSchema = z.object({
  jobCardId: z.string().min(1, "Job Card is required"),
  paymentDate: z.string().min(1, "Payment date is required").refine((value) => { const date = new Date(value + "T00:00:00"); const today = new Date(); today.setHours(23, 59, 59, 999); return !Number.isNaN(date.getTime()) && date <= today }, "Payment date cannot be in the future"),
  amount: z.number().finite("Amount is required").min(0, "Amount cannot be negative"),
  discountAmount: z.number().finite("Discount amount is required").min(0, "Discount amount cannot be negative"),
  method: z.enum(["CASH", "CARD", "TRANSFER"]),
}).refine((data) => data.amount > 0 || data.discountAmount > 0, {
  message: "Enter a payment amount or discount amount",
  path: ["amount"],
})

export type PaymentFormValues = z.infer<typeof paymentSchema>
