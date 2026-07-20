import { z } from "zod"

export const supplierSchema = z.object({
  name: z.string().min(2, "Supplier name is required"),
  contact: z.string().min(3, "Contact number is required"),
  email: z.string().email("Invalid email").or(z.literal("")).optional(),
  address: z.string().optional(),
})

export type SupplierFormValues = z.infer<typeof supplierSchema>

export const supplierPaymentSchema = z.object({
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  method: z.enum(["CASH", "CARD", "UPI", "TRANSFER"]),
  reference: z.string().optional(),
})

export type SupplierPaymentFormValues = z.infer<typeof supplierPaymentSchema>
