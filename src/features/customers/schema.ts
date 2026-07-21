import { z } from "zod";

export const customerSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z.string().trim().email("Invalid email address").or(z.literal("")).optional(),
  phone: z
    .string().trim()
    .min(8, "Contact number must be at least 8 digits")
    .regex(/^[0-9+\-\s()]+$/, "Invalid contact number format"),
  address: z.string().trim().optional(),
  type: z.string().optional().default("Individual"),
});

export type CustomerFormValues = z.infer<typeof customerSchema>;
