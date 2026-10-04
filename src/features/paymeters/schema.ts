import { z } from "zod"
import { isDirectPaymeterName } from "@/lib/paymeter"

export const paymeterSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Name is required").refine(
    (name) => !isDirectPaymeterName(name),
    "This name is reserved for direct payments. Please use a different paymeter name.",
  ),
})

export type PaymeterFormValues = z.infer<typeof paymeterSchema>
