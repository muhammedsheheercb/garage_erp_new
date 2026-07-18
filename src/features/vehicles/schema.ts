import { z } from "zod"

export const vehicleSchema = z.object({
  id: z.string().optional(),
  plateNumber: z.string().min(2, "Vehicle number is required"),
  brand: z.string().min(1, "Brand is required"),
  model: z.string().min(1, "Model is required"),
  fuelType: z.string().min(1, "Fuel type is required"),
  year: z.number().int().min(1900, "Invalid year").max(new Date().getFullYear() + 1, "Invalid year"),
  customerId: z.string().min(1, "Customer is required"),
})

export type VehicleFormValues = z.infer<typeof vehicleSchema>
