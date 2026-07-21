import { z } from "zod"

export const paymeterSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Name is required"),
})

export type PaymeterFormValues = z.infer<typeof paymeterSchema>
