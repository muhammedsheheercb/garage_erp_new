"use client"

import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { VehicleFormValues, vehicleSchema } from "../schema"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query"
import { createVehicle, updateVehicle, getCustomersForDropdown, getVehicleCatalog } from "../actions"
import { toast } from "sonner"
import { useTranslation } from "@/i18n"

interface VehicleFormProps {
  initialData?: VehicleFormValues & { id?: string }
  onSuccess?: (vehicle?: any) => void
}

export function VehicleForm({ initialData, onSuccess }: VehicleFormProps) {
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const fuelTypeLabels: Record<string, string> = {
    Petrol: t.vehicles.fuelPetrol,
    Diesel: t.vehicles.fuelDiesel,
    Electric: t.vehicles.fuelElectric,
    Hybrid: t.vehicles.fuelHybrid,
  }
  
  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<VehicleFormValues>({
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

  const { data: savedVehicleCatalog = {} } = useQuery({
    queryKey: ['vehicle-catalog'],
    queryFn: getVehicleCatalog,
  })
  const vehicleCatalog = { ...savedVehicleCatalog }
  if (initialData?.brand && initialData.model) {
    const existingModels = vehicleCatalog[initialData.brand] || []
    if (!existingModels.includes(initialData.model)) {
      vehicleCatalog[initialData.brand] = [...existingModels, initialData.model]
    }
  }
  const selectedBrand = watch("brand")
  const availableModels = vehicleCatalog[selectedBrand] || []

  const mutation = useMutation({
    mutationFn: async (data: VehicleFormValues) => {
      if (initialData?.id) {
        return updateVehicle(initialData.id, data)
      }
      return createVehicle(data)
    },
    onSuccess: (data) => {
      toast.success(initialData?.id ? t.vehicles.vehicleUpdated : t.vehicles.vehicleCreated)
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
      onSuccess?.(data)
    },
    onError: () => {
      toast.error(t.common.somethingWrong)
    }
  })

  const onSubmit = (data: VehicleFormValues) => {
    mutation.mutate(data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="plateNumber">{t.vehicles.plateNumber} <span className="text-destructive">*</span></Label>
        <Input id="plateNumber" placeholder="e.g. ABC 1234" {...register("plateNumber")} />
        {errors.plateNumber && <p className="text-sm text-destructive">{errors.plateNumber.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="brand">{t.vehicles.companyName} <span className="text-destructive">*</span></Label>
          <Controller control={control} name="brand" render={({ field }) => (
            <Select value={field.value} onValueChange={(brand) => {
              field.onChange(brand)
              setValue("model", "", { shouldValidate: true })
            }}>
              <SelectTrigger id="brand" className="w-full"><SelectValue placeholder={t.vehicles.selectCompany} /></SelectTrigger>
              <SelectContent>
                {Object.keys(vehicleCatalog).sort().map((brand) => <SelectItem key={brand} value={brand}>{brand}</SelectItem>)}
              </SelectContent>
            </Select>
          )} />
          {errors.brand && <p className="text-sm text-destructive">{errors.brand.message}</p>}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="model">{t.vehicles.model} <span className="text-destructive">*</span></Label>
          <Controller control={control} name="model" render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange} disabled={!selectedBrand}>
              <SelectTrigger id="model" className="w-full"><SelectValue placeholder={selectedBrand ? t.vehicles.selectModel : t.vehicles.selectCompanyFirst} /></SelectTrigger>
              <SelectContent>
                {availableModels.map((model) => <SelectItem key={model} value={model}>{model}</SelectItem>)}
              </SelectContent>
            </Select>
          )} />
          {errors.model && <p className="text-sm text-destructive">{errors.model.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="year">{t.vehicles.year} <span className="text-destructive">*</span></Label>
          <Input id="year" type="number" {...register("year", { valueAsNumber: true })} />
          {errors.year && <p className="text-sm text-destructive">{errors.year.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="fuelType">{t.vehicles.fuelType} <span className="text-destructive">*</span></Label>
          <Controller
            control={control}
            name="fuelType"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t.vehicles.selectFuelType}>
                    {(value: string) => fuelTypeLabels[value] || value}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Petrol">{t.vehicles.fuelPetrol}</SelectItem>
                  <SelectItem value="Diesel">{t.vehicles.fuelDiesel}</SelectItem>
                  <SelectItem value="Electric">{t.vehicles.fuelElectric}</SelectItem>
                  <SelectItem value="Hybrid">{t.vehicles.fuelHybrid}</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          {errors.fuelType && <p className="text-sm text-destructive">{errors.fuelType.message}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="customerId">{t.vehicles.owner} <span className="text-destructive">*</span></Label>
        <Controller
          control={control}
          name="customerId"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange} disabled={customers.length === 0}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={customers.length > 0 ? t.vehicles.selectCustomer : t.common.loading}>
                  {(value: string) => customers.find((customer) => customer.id === value)?.name || null}
                </SelectValue>
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
          {mutation.isPending ? t.common.saving : t.vehicles.saveVehicle}
        </Button>
      </div>
    </form>
  )
}
