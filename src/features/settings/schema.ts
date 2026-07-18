import { z } from "zod"

export const settingsSchema = z.object({
  garageName: z.string().min(1, "Garage name is required"),
  ownerName: z.string().min(1, "Owner name is required"),
  phone: z.string().min(1, "Phone number is required"),
  email: z.string().email("Invalid email address"),
  address: z.string().min(1, "Address is required"),
  gstNumber: z.string().optional(),
  invoicePrefix: z.string().min(1, "Invoice prefix is required"),
})

export type SettingsFormValues = z.infer<typeof settingsSchema>
