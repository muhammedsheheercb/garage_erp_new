"use client"

import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { VehicleFormValues, vehicleSchema } from "../schema"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query"
import { createPortal } from "react-dom"
import { createVehicle, updateVehicle, getCustomersForDropdown, getVehicleCatalog } from "../actions"
import { toast } from "sonner"
import { useState } from "react"
import { useTranslation } from "@/i18n"
import { Check, Search, X } from "lucide-react"

interface VehicleFormProps {
  initialData?: VehicleFormValues & { id?: string }
  onSuccess?: (vehicle?: any) => void
}

export function VehicleForm({ initialData, onSuccess }: VehicleFormProps) {
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const [brandSearch, setBrandSearch] = useState("")
  const [isBrandPickerOpen, setIsBrandPickerOpen] = useState(false)
  const [brandPickerPosition, setBrandPickerPosition] = useState<{ top: number; left: number; width: number } | null>(null)
  const [ownerSearch, setOwnerSearch] = useState("")
  const [isOwnerPickerOpen, setIsOwnerPickerOpen] = useState(false)
  const [ownerPickerPosition, setOwnerPickerPosition] = useState<{ top: number; left: number; width: number } | null>(null)
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
      if ("success" in data && data.success === false) {
        toast.error(data.message || t.common.somethingWrong)
        return
      }
      toast.success(initialData?.id ? t.vehicles.vehicleUpdated : t.vehicles.vehicleCreated)
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
      onSuccess?.(data)
    },
    onError: (error: any) => {
      toast.error(error.message || t.common.somethingWrong)
    }
  })

  const onSubmit = (data: VehicleFormValues) => {
    mutation.mutate(data)
  }

  const updateBrandPickerPosition = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect()
    setBrandPickerPosition({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 240) })
  }

  const updateOwnerPickerPosition = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect()
    setOwnerPickerPosition({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 280) })
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
          <Controller control={control} name="brand" render={({ field }) => {
            const brands = Object.keys(vehicleCatalog).sort()
            const filteredBrands = brands.filter((brand) => brand.toLowerCase().includes(brandSearch.trim().toLowerCase()))
            return (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 z-10 h-4 w-4 text-muted-foreground" />
                <Input
                  id="brand"
                  value={isBrandPickerOpen ? brandSearch : (field.value || "")}
                  placeholder={t.vehicles.selectCompany}
                  className="pl-9 pr-9"
                  autoComplete="off"
                  onFocus={(event) => {
                    setBrandSearch("")
                    setIsBrandPickerOpen(true)
                    updateBrandPickerPosition(event.currentTarget)
                  }}
                  onBlur={() => window.setTimeout(() => {
                    setIsBrandPickerOpen(false)
                    setBrandPickerPosition(null)
                  }, 150)}
                  onChange={(event) => {
                    setBrandSearch(event.target.value)
                    field.onChange("")
                    setValue("model", "", { shouldValidate: true })
                    setIsBrandPickerOpen(true)
                    updateBrandPickerPosition(event.currentTarget)
                  }}
                />
                {(field.value || brandSearch) && <button type="button" aria-label="Clear company" className="absolute right-2 top-1.5 z-10 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" onMouseDown={(event) => event.preventDefault()} onClick={(event) => {
                  const input = event.currentTarget.parentElement?.querySelector("input") as HTMLInputElement | null
                  field.onChange("")
                  setValue("model", "", { shouldValidate: true })
                  setBrandSearch("")
                  setIsBrandPickerOpen(true)
                  if (input) updateBrandPickerPosition(input)
                }}><X className="h-4 w-4" /></button>}
                {isBrandPickerOpen && brandPickerPosition && typeof document !== "undefined" && createPortal(
                  <div className="fixed z-[100] max-h-60 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-lg" style={brandPickerPosition}>
                    {filteredBrands.length > 0 ? filteredBrands.map((brand) => (
                      <button key={brand} type="button" className="flex w-full items-center justify-between rounded-sm px-3 py-2 text-left text-sm hover:bg-accent" onMouseDown={(event) => event.preventDefault()} onClick={() => {
                        field.onChange(brand)
                        setValue("model", "", { shouldValidate: true })
                        setBrandSearch(brand)
                        setIsBrandPickerOpen(false)
                        setBrandPickerPosition(null)
                      }}>
                        <span>{brand}</span>
                        {field.value === brand && <Check className="h-4 w-4 text-primary" />}
                      </button>
                    )) : <p className="px-3 py-4 text-center text-sm text-muted-foreground">No matching companies found.</p>}
                  </div>, document.body
                )}
              </div>
            )
          }} />
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
          render={({ field }) => {
            const selectedOwner = customers.find((customer) => customer.id === field.value)
            const filteredOwners = customers.filter((customer) => {
              const query = ownerSearch.trim().toLowerCase()
              return !query || customer.name.toLowerCase().includes(query) || customer.phone?.toLowerCase().includes(query)
            })
            return (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 z-10 h-4 w-4 text-muted-foreground" />
                <Input
                  id="customerId"
                  value={isOwnerPickerOpen ? ownerSearch : (selectedOwner?.name || "")}
                  placeholder={customers.length > 0 ? t.vehicles.selectCustomer : t.common.loading}
                  className="pl-9 pr-9"
                  autoComplete="off"
                  disabled={customers.length === 0}
                  onFocus={(event) => {
                    setOwnerSearch("")
                    setIsOwnerPickerOpen(true)
                    updateOwnerPickerPosition(event.currentTarget)
                  }}
                  onBlur={() => window.setTimeout(() => {
                    setIsOwnerPickerOpen(false)
                    setOwnerPickerPosition(null)
                  }, 150)}
                  onChange={(event) => {
                    setOwnerSearch(event.target.value)
                    field.onChange("")
                    setIsOwnerPickerOpen(true)
                    updateOwnerPickerPosition(event.currentTarget)
                  }}
                />
                {(selectedOwner || ownerSearch) && <button type="button" aria-label="Clear owner" className="absolute right-2 top-1.5 z-10 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" onMouseDown={(event) => event.preventDefault()} onClick={(event) => {
                  const input = event.currentTarget.parentElement?.querySelector("input") as HTMLInputElement | null
                  field.onChange("")
                  setOwnerSearch("")
                  setIsOwnerPickerOpen(true)
                  if (input) updateOwnerPickerPosition(input)
                }}><X className="h-4 w-4" /></button>}
                {isOwnerPickerOpen && ownerPickerPosition && typeof document !== "undefined" && createPortal(
                  <div className="fixed z-[100] max-h-60 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-lg" style={ownerPickerPosition}>
                    {filteredOwners.length > 0 ? filteredOwners.map((customer) => (
                      <button key={customer.id} type="button" className="flex w-full items-center justify-between rounded-sm px-3 py-2 text-left text-sm hover:bg-accent" onMouseDown={(event) => event.preventDefault()} onClick={() => {
                        field.onChange(customer.id)
                        setOwnerSearch(customer.name)
                        setIsOwnerPickerOpen(false)
                        setOwnerPickerPosition(null)
                      }}>
                        <span className="min-w-0"><span className="block truncate font-medium">{customer.name}</span>{customer.phone && <span className="block text-xs text-muted-foreground">{customer.phone}</span>}</span>
                        {field.value === customer.id && <Check className="ml-3 h-4 w-4 text-primary" />}
                      </button>
                    )) : <p className="px-3 py-4 text-center text-sm text-muted-foreground">No matching owners found.</p>}
                  </div>, document.body
                )}
              </div>
            )
          }}
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
