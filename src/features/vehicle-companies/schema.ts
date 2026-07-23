import { z } from "zod"

export const companySchema = z.object({
  name: z.string().trim().min(1, "Company name is required").max(100),
})

export const companyCreateSchema = companySchema.extend({
  modelName: z.string().trim().min(1, "Model name is required").max(100),
})

export const modelSchema = z.object({
  companyId: z.string().min(1, "Company is required"),
  name: z.string().trim().min(1, "Model name is required").max(100),
})

export type CompanyFormValues = z.infer<typeof companySchema>
export type CompanyCreateFormValues = z.infer<typeof companyCreateSchema>
export type ModelFormValues = z.infer<typeof modelSchema>
