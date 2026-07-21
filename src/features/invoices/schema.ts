import { z } from "zod"

export const invoiceSchema = z.object({
  id: z.string().optional(),
  jobCardId: z.string().trim().min(1, "Job Card is required"),
  customerId: z.string().trim().min(1, "Customer is required"),
  serviceCharge: z.number().finite("Service charge is required").min(0, "Service charge cannot be negative"),
  labourCharge: z.number().finite("Labour charge is required").min(0, "Labour charge cannot be negative"),
  partsCost: z.number().finite("Parts cost is required").min(0, "Parts cost cannot be negative"),
  discount: z.number().finite("Discount is required").min(0, "Discount cannot be negative"),
  tax: z.number().finite("Tax is required").min(0, "Tax cannot be negative"),
  servicesDetails: z.string().trim().optional(),
  partsDetails: z.string().trim().optional(),
  status: z.enum(["UNPAID", "PARTIAL", "PAID"]),
  otherCharges: z.string().trim().optional(),
})

export type InvoiceFormValues = z.infer<typeof invoiceSchema>
