"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { PaymeterFormValues, paymeterSchema } from "../schema"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createPaymeter, updatePaymeter } from "../actions"
import { toast } from "sonner"

interface PaymeterFormProps {
  initialData?: PaymeterFormValues & { id?: string }
  onSuccess?: () => void
}

export function PaymeterForm({ initialData, onSuccess }: PaymeterFormProps) {
  const queryClient = useQueryClient()
  
  const { register, handleSubmit, formState: { errors } } = useForm<PaymeterFormValues>({
    resolver: zodResolver(paymeterSchema),
    defaultValues: {
      name: initialData?.name || "",
    }
  })

  const mutation = useMutation({
    mutationFn: async (data: PaymeterFormValues) => {
      if (initialData?.id) {
        return updatePaymeter(initialData.id, data)
      }
      return createPaymeter(data)
    },
    onSuccess: () => {
      toast.success(initialData?.id ? "Paymeter updated!" : "Paymeter created!")
      queryClient.invalidateQueries({ queryKey: ['paymeters'] })
      onSuccess?.()
    },
    onError: (error: any) => {
      toast.error(error.message || "Something went wrong.")
    }
  })

  const onSubmit = (data: PaymeterFormValues) => {
    mutation.mutate(data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Paymeter Name <span className="text-destructive">*</span></Label>
        <Input id="name" placeholder="e.g. Bank Account 1, Cash Drawer" {...register("name")} />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      <div className="pt-4 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onSuccess}>Cancel</Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : "Save Paymeter"}
        </Button>
      </div>
    </form>
  )
}
