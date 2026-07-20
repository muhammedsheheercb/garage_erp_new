"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { CustomerFormValues, customerSchema } from "../schema"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createCustomer, updateCustomer } from "../actions"
import { toast } from "sonner"

interface CustomerFormProps {
  initialData?: CustomerFormValues & { id?: string }
  onSuccess?: (customer?: any) => void
}

export function CustomerForm({ initialData, onSuccess }: CustomerFormProps) {
  const queryClient = useQueryClient()
  
  const { register, handleSubmit, formState: { errors } } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: initialData?.name || "",
      email: initialData?.email || "",
      phone: initialData?.phone || "",
      address: initialData?.address || "",
    }
  })

  const mutation = useMutation({
    mutationFn: async (data: CustomerFormValues) => {
      if (initialData?.id) {
        return updateCustomer(initialData.id, data)
      }
      return createCustomer(data)
    },
    onSuccess: (data) => {
      toast.success(initialData?.id ? "Customer updated!" : "Customer created!")
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      onSuccess?.(data)
    },
    onError: () => {
      toast.error("Something went wrong.")
    }
  })

  const onSubmit = (data: CustomerFormValues) => {
    mutation.mutate(data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name <span className="text-destructive">*</span></Label>
        <Input id="name" placeholder="John Doe" {...register("name")} />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" placeholder="john@example.com" {...register("email")} />
        {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Phone <span className="text-destructive">*</span></Label>
        <Input id="phone" placeholder="+1234567890" {...register("phone")} />
        {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Address</Label>
        <Input id="address" placeholder="123 Main St, City" {...register("address")} />
        {errors.address && <p className="text-sm text-destructive">{errors.address.message}</p>}
      </div>

      <div className="pt-4 flex justify-end">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : "Save Customer"}
        </Button>
      </div>
    </form>
  )
}
