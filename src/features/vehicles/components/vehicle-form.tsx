"use client"

import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { VehicleFormValues, vehicleSchema } from "../schema"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query"
import { createVehicle, updateVehicle, getCustomersForDropdown } from "../actions"
import { toast } from "sonner"

interface VehicleFormProps {
  initialData?: VehicleFormValues & { id?: string }
  onSuccess?: (vehicle?: any) => void
}

export function VehicleForm({ initialData, onSuccess }: VehicleFormProps) {
  const queryClient = useQueryClient()
  
  const { register, handleSubmit, control, formState: { errors } } = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      plateNumber: initialData?.plateNumber || "",
      brand: initialData?.brand || "",
      model: initialData?.model || "",
      fuelType: initialData?.fuelType || "",
      year: initialData?.year || new Date().getFullYear(),
      customerId: initialData?.customerId || "",
    }
  })

  // Fetch customers for the dropdown
  const { data: customers = [] } = useQuery({
    queryKey: ['customers-dropdown'],
    queryFn: getCustomersForDropdown
  })

  const mutation = useMutation({
    mutationFn: async (data: VehicleFormValues) => {
      if (initialData?.id) {
        return updateVehicle(initialData.id, data)
      }
      return createVehicle(data)
    },
    onSuccess: (data) => {
      toast.success(initialData?.id ? "Vehicle updated!" : "Vehicle added!")
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
      onSuccess?.(data)
    },
    onError: () => {
      toast.error("Something went wrong.")
    }
  })

  const onSubmit = (data: VehicleFormValues) => {
    mutation.mutate(data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="plateNumber">Plate Number <span className="text-destructive">*</span></Label>
        <Input id="plateNumber" placeholder="e.g. ABC 1234" {...register("plateNumber")} />
        {errors.plateNumber && <p className="text-sm text-destructive">{errors.plateNumber.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="brand">Brand <span className="text-destructive">*</span></Label>
          <Input id="brand" placeholder="Toyota" {...register("brand")} />
          {errors.brand && <p className="text-sm text-destructive">{errors.brand.message}</p>}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="model">Model <span className="text-destructive">*</span></Label>
          <Input id="model" placeholder="Camry" {...register("model")} />
          {errors.model && <p className="text-sm text-destructive">{errors.model.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="year">Year <span className="text-destructive">*</span></Label>
          <Input id="year" type="number" {...register("year", { valueAsNumber: true })} />
          {errors.year && <p className="text-sm text-destructive">{errors.year.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="fuelType">Fuel Type <span className="text-destructive">*</span></Label>
          <Controller
            control={control}
            name="fuelType"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select fuel type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Petrol">Petrol</SelectItem>
                  <SelectItem value="Diesel">Diesel</SelectItem>
                  <SelectItem value="Electric">Electric</SelectItem>
                  <SelectItem value="Hybrid">Hybrid</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          {errors.fuelType && <p className="text-sm text-destructive">{errors.fuelType.message}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="customerId">Owner (Customer) <span className="text-destructive">*</span></Label>
        <Controller
          control={control}
          name="customerId"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange} disabled={customers.length === 0}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={customers.length > 0 ? "Select a customer" : "Loading customers..."} />
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name} {customer.phone ? `(${customer.phone})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.customerId && <p className="text-sm text-destructive">{errors.customerId.message}</p>}
      </div>

      <div className="pt-4 flex justify-end">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : "Save Vehicle"}
        </Button>
      </div>
    </form>
  )
}
