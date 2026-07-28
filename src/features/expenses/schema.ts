import { z } from "zod"

export const expenseCategories = [
  "Rent",
  "Electricity",
  "Salary",
  "Water Bill",
  "Other Expenses"
] as const

export const expenseSchema = z.object({
  id: z.string().optional(),
  category: z.enum(expenseCategories),
  amount: z.number().finite("Amount is required").min(0.001, "Amount must be greater than 0"),
  description: z.string().trim().optional(),
  date: z.coerce.date(),
  paymentType: z.enum(["DIRECT", "PAYMETER"]).default("DIRECT"),
  paymentMethod: z.string().default("CASH"),
  paymeterId: z.string().nullable().optional(),
})

export type ExpenseFormValues = z.infer<typeof expenseSchema>
