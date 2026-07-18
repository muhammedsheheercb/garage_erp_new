import { z } from "zod"

export const serviceSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Service name must be at least 2 characters"),
  category: z.string().optional(),
  estimatedTime: z.string().optional(),
  price: z.number().min(0, "Price cannot be negative"),
})

export type ServiceFormValues = z.infer<typeof serviceSchema>
