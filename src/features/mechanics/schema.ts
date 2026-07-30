import { z } from "zod"

export const mechanicSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z.string().trim().email("Invalid email address").or(z.literal("")).optional(),
  phone: z.string().trim().refine(
    (value) => value === "" || (value.length >= 8 && /^[0-9+\-\s()]+$/.test(value)),
    "Invalid contact number format"
  ).optional(),
})

export type MechanicFormValues = z.infer<typeof mechanicSchema>
