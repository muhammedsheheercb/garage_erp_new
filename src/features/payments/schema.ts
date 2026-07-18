import { z } from "zod"

export const paymentSchema = z.object({
  invoiceId: z.string().min(1, "Invoice is required"),
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  method: z.enum(["CASH", "CARD", "UPI", "TRANSFER"]),
})

export type PaymentFormValues = z.infer<typeof paymentSchema>
