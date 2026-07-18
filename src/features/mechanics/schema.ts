import { z } from "zod"

export const mechanicSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address").or(z.literal("")).optional(),
  phone: z.string().min(8, "Contact number must be at least 8 digits").regex(/^[0-9+\-\s()]+$/, "Invalid contact number format"),
})

export type MechanicFormValues = z.infer<typeof mechanicSchema>
