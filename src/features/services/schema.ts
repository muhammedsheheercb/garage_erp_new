import { z } from "zod"

export const serviceSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Service name must be at least 2 characters"),
  category: z.string().trim().optional(),
  estimatedTime: z.string().trim().optional(),
  price: z.number().finite("Price is required").min(0, "Price cannot be negative"),
})

export type ServiceFormValues = z.infer<typeof serviceSchema>
