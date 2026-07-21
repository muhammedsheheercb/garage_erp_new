import { z } from "zod"

export const jobCardServiceSchema = z.object({
  serviceId: z.string().trim().min(1, "Service is required"),
  name: z.string().trim().min(1, "Service name is required"),
  quantity: z.number().finite("Quantity is required").int("Quantity must be a whole number").min(1, "Quantity must be at least 1"),
  price: z.number().finite("Price is required").min(0, "Price cannot be negative"),
})

export const jobCardPartSchema = z
  .object({
    batchId: z.string().trim().min(1, "Part is required"),
    name: z.string().trim().min(1, "Part name is required"),
    quantity: z.number().finite("Quantity is required").int("Quantity must be a whole number").min(1, "Quantity must be at least 1"),
    price: z.number().finite("Price is required").min(0, "Price cannot be negative"),
    maxStock: z.number().finite(), // Used for validation in UI
  })
  .refine((part) => part.quantity <= part.maxStock, {
    message: "Quantity cannot exceed available stock",
    path: ["quantity"],
  })

export const jobCardSchema = z.object({
  id: z.string().optional(),
  customerId: z.string().trim().min(1, "Customer is required"),
  vehicleId: z.string().trim().min(1, "Vehicle is required"),
  mechanicId: z.string().trim().min(1, "Mechanic is required"),
  status: z.enum(["PENDING", "IN_PROGRESS", "WORKING", "COMPLETED", "CANCELLED"]),
  complaint: z.string().trim().min(3, "Complaint description is required"),
  workDone: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  
  services: z.array(jobCardServiceSchema),
  parts: z.array(jobCardPartSchema),
  
  serviceTotal: z.number().finite().min(0, "Service total cannot be negative"),
  partsTotal: z.number().finite().min(0, "Parts total cannot be negative"),
  discount: z.number().finite("Discount is required").min(0, "Discount cannot be negative"),
  tax: z.number().finite("Tax is required").min(0, "Tax cannot be negative"),
  grandTotal: z.number().finite().min(0, "Grand total cannot be negative"),
})

export type JobCardFormValues = z.infer<typeof jobCardSchema>
export type JobCardServiceValues = z.infer<typeof jobCardServiceSchema>
export type JobCardPartValues = z.infer<typeof jobCardPartSchema>
