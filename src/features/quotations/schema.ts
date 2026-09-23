import { z } from "zod"

export const quotationServiceSchema = z.object({
  serviceId: z.string().min(1),
  name: z.string().min(1),
  quantity: z.number().int().min(1),
  price: z.number().finite().min(0),
})

export const quotationPartSchema = z.object({
  inventoryId: z.string().min(1),
  name: z.string().min(1),
  quantity: z.number().int().min(1),
  price: z.number().finite().min(0),
})

export const quotationSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  vehicleId: z.string().min(1, "Vehicle is required"),
  complaint: z.string().trim().min(3, "Complaint description is required"),
  notes: z.string().trim().optional(),
  date: z.string().min(1, "Date is required"),
  validUntil: z.string().min(1, "Valid until date is required"),
  vehicleKm: z.number().finite().min(0),
  services: z.array(quotationServiceSchema),
  parts: z.array(quotationPartSchema),
  serviceTotal: z.number().finite().min(0),
  partsTotal: z.number().finite().min(0),
  grandTotal: z.number().finite().min(0),
}).refine((data) => data.validUntil >= data.date, { path: ["validUntil"], message: "Valid until date cannot be earlier than the quotation date" })

export type QuotationFormValues = z.infer<typeof quotationSchema>
