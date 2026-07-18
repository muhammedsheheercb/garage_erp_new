import { z } from "zod"

export const invoiceSchema = z.object({
  id: z.string().optional(),
  jobCardId: z.string().min(1, "Job Card is required"),
  customerId: z.string().min(1, "Customer is required"),
  serviceCharge: z.number().min(0),
  labourCharge: z.number().min(0),
  partsCost: z.number().min(0),
  discount: z.number().min(0),
  tax: z.number().min(0),
  servicesDetails: z.string().optional(),
  partsDetails: z.string().optional(),
  status: z.enum(["UNPAID", "PARTIAL", "PAID"]),
})

export type InvoiceFormValues = z.infer<typeof invoiceSchema>
