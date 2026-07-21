import { z } from "zod"

export const supplierSchema = z.object({
  name: z.string().trim().min(2, "Supplier name is required"),
  contact: z.string().trim().min(3, "Contact number is required"),
  email: z.string().trim().email("Invalid email").or(z.literal("")).optional(),
  address: z.string().trim().optional(),
})

export type SupplierFormValues = z.infer<typeof supplierSchema>

export const supplierPaymentSchema = z.object({
  purchaseId: z.string().trim().min(1, "Purchase bill is required"),
  paymentSource: z.enum(["PAYMETER", "DIRECT"]),
  paymeterId: z.string().trim().optional(),
  directPaymentMethod: z.enum(["CASH", "BANK_TRANSFER", "CARD", "UPI"]).optional(),
  amount: z.number().finite("Amount is required").min(0.01, "Amount must be greater than 0"),
}).superRefine((data, ctx) => {
  if (data.paymentSource === "PAYMETER" && !data.paymeterId) {
    ctx.addIssue({ code: "custom", path: ["paymeterId"], message: "Select a paymeter or ledger" })
  }
  if (data.paymentSource === "DIRECT" && !data.directPaymentMethod) {
    ctx.addIssue({ code: "custom", path: ["directPaymentMethod"], message: "Select a direct payment method" })
  }
})

export type SupplierPaymentFormValues = z.infer<typeof supplierPaymentSchema>
