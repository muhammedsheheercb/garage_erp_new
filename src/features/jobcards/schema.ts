import { z } from "zod"

export const jobCardServiceSchema = z.object({
  serviceId: z.string(),
  name: z.string(),
  quantity: z.number().min(1),
  price: z.number().min(0),
})

export const jobCardPartSchema = z.object({
  inventoryId: z.string(),
  name: z.string(),
  quantity: z.number().min(1),
  price: z.number().min(0),
  maxStock: z.number(), // Used for validation in UI
})

export const jobCardSchema = z.object({
  id: z.string().optional(),
  customerId: z.string().min(1, "Customer is required"),
  vehicleId: z.string().min(1, "Vehicle is required"),
  mechanicId: z.string().min(1, "Mechanic is required"),
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED"]),
  complaint: z.string().min(3, "Complaint description is required"),
  workDone: z.string().optional(),
  notes: z.string().optional(),
  
  services: z.array(jobCardServiceSchema),
  parts: z.array(jobCardPartSchema),
  
  serviceTotal: z.number(),
  partsTotal: z.number(),
  discount: z.number().min(0),
  tax: z.number().min(0),
  grandTotal: z.number(),
})

export type JobCardFormValues = z.infer<typeof jobCardSchema>
export type JobCardServiceValues = z.infer<typeof jobCardServiceSchema>
export type JobCardPartValues = z.infer<typeof jobCardPartSchema>
