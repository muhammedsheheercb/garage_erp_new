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
  date: z.date(),
})

export type ExpenseFormValues = z.infer<typeof expenseSchema>
