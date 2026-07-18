"use client"

import { useForm, Controller, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { JobCardFormValues, jobCardSchema } from "../schema"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query"
import { createJobCard, updateJobCard, getDropdownData } from "../actions"
import { toast } from "sonner"
import { Trash } from "lucide-react"
import { useEffect } from "react"
import { ServiceSelectionModal } from "./service-selection-modal"
import { PartSelectionModal } from "./part-selection-modal"

interface JobCardFormProps {
  initialData?: any // JobCard with relations
  onSuccess?: () => void
}

export function JobCardForm({ initialData, onSuccess }: JobCardFormProps) {
  const queryClient = useQueryClient()
  
  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<JobCardFormValues>({
    resolver: zodResolver(jobCardSchema),
    defaultValues: {
      id: initialData?.id || undefined,
      customerId: initialData?.customerId || "",
      vehicleId: initialData?.vehicleId || "",
      mechanicId: initialData?.mechanicId || "",
      status: initialData?.status || "PENDING",
      complaint: initialData?.complaint || "",
      workDone: initialData?.workDone || "",
      notes: initialData?.notes || "",
      
      services: initialData?.services?.map((s: any) => ({
        serviceId: s.serviceId,
        name: s.service?.name || "Unknown",
        quantity: s.quantity,
        price: s.price,
      })) || [],
      
      parts: initialData?.parts?.map((p: any) => ({
        inventoryId: p.inventoryId,
        name: p.inventory?.itemName || "Unknown",
        quantity: p.quantity,
        price: p.price,
        maxStock: p.inventory?.quantity || 999, // We just need a default max for edit mode
      })) || [],
      
      serviceTotal: initialData?.serviceTotal || 0,
      partsTotal: initialData?.partsTotal || 0,
      discount: initialData?.discount || 0,
      tax: initialData?.tax || 0,
      grandTotal: initialData?.grandTotal || 0,
    }
  })

  const { fields: serviceFields, append: appendService, remove: removeService } = useFieldArray({
    control,
    name: "services"
  })

  const { fields: partFields, append: appendPart, remove: removePart } = useFieldArray({
    control,
    name: "parts"
  })

  // Watch for totals calculation
  const watchedServices = watch("services")
  const watchedParts = watch("parts")
  const watchedDiscount = watch("discount")
  const watchedTax = watch("tax")

  useEffect(() => {
    const sTotal = watchedServices.reduce((acc, curr) => acc + ((curr.quantity || 0) * (curr.price || 0)), 0)
    const pTotal = watchedParts.reduce((acc, curr) => acc + ((curr.quantity || 0) * (curr.price || 0)), 0)
    
    setValue("serviceTotal", sTotal)
    setValue("partsTotal", pTotal)
    
    const subTotal = sTotal + pTotal
    const taxAmt = (subTotal * (watchedTax || 0)) / 100
    const gTotal = subTotal + taxAmt - (watchedDiscount || 0)
    
    setValue("grandTotal", gTotal > 0 ? gTotal : 0)
  }, [watchedServices, watchedParts, watchedDiscount, watchedTax, setValue])

  const { data: dropdowns = { customers: [], vehicles: [], mechanics: [] }, isLoading } = useQuery({
    queryKey: ['jobcards-dropdowns'],
    queryFn: getDropdownData
  })

  const mutation = useMutation({
    mutationFn: async (data: JobCardFormValues) => {
      if (initialData?.id) {
        return updateJobCard(initialData.id, data)
      }
      return createJobCard(data)
    },
    onSuccess: () => {
      toast.success(initialData?.id ? "Job Card updated!" : "Job Card created!")
      queryClient.invalidateQueries({ queryKey: ['jobcards'] })
      queryClient.invalidateQueries({ queryKey: ['mechanics'] })
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
      onSuccess?.()
    },
    onError: () => {
      toast.error("Something went wrong.")
    }
  })

  const onSubmit = (data: JobCardFormValues) => {
    mutation.mutate(data)
  }

  const selectedCustomerId = watch("customerId")
  const filteredVehicles = dropdowns.vehicles.filter((v: any) => v.customerId === selectedCustomerId)

  const serviceTotal = watch("serviceTotal")
  const partsTotal = watch("partsTotal")
  const grandTotal = watch("grandTotal")

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN: Main Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customerId">Customer <span className="text-destructive">*</span></Label>
              <Controller
                control={control}
                name="customerId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(val) => { field.onChange(val); setValue("vehicleId", "") }} disabled={isLoading}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {dropdowns.customers.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.customerId && <p className="text-sm text-destructive">{errors.customerId.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="vehicleId">Vehicle <span className="text-destructive">*</span></Label>
              <Controller
                control={control}
                name="vehicleId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={!selectedCustomerId || filteredVehicles.length === 0}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={!selectedCustomerId ? "Select customer first" : "Select vehicle"} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredVehicles.map((v: any) => (
                        <SelectItem key={v.id} value={v.id}>{v.plateNumber} ({v.brand})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.vehicleId && <p className="text-sm text-destructive">{errors.vehicleId.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="mechanicId">Assign Mechanic <span className="text-destructive">*</span></Label>
              <Controller
                control={control}
                name="mechanicId"
                render={({ field }) => (
                  <Select value={field.value || ""} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Mechanic" />
                    </SelectTrigger>
                    <SelectContent>
                      {dropdowns.mechanics.map((m: any) => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.mechanicId && <p className="text-sm text-destructive">{errors.mechanicId.message}</p>}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="status">Status <span className="text-destructive">*</span></Label>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="IN_PROGRESS">Working</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="complaint">Complaint / Issue <span className="text-destructive">*</span></Label>
            <Textarea id="complaint" rows={3} placeholder="Describe the customer's issue..." {...register("complaint")} />
            {errors.complaint && <p className="text-sm text-destructive">{errors.complaint.message}</p>}
          </div>

          {/* SERVICES SECTION */}
          <div className="space-y-4 border rounded-md p-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-lg">Services</h3>
              <ServiceSelectionModal onSelect={(service) => {
                if (!watchedServices.find(s => s.serviceId === service.id)) {
                  appendService({ serviceId: service.id, name: service.name, quantity: 1, price: service.price })
                } else {
                  toast.error("Service already added.")
                }
              }} />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead className="w-24">Qty</TableHead>
                  <TableHead className="w-32">Price</TableHead>
                  <TableHead className="w-32 text-right">Amount</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {serviceFields.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No services added.</TableCell></TableRow>
                ) : (
                  serviceFields.map((field, index) => {
                    const qty = watchedServices[index]?.quantity || 0
                    const price = watchedServices[index]?.price || 0
                    return (
                      <TableRow key={field.id}>
                        <TableCell>{field.name}</TableCell>
                        <TableCell>
                          <Input type="number" min="1" {...register(`services.${index}.quantity`, { valueAsNumber: true })} />
                        </TableCell>
                        <TableCell>
                          <Input type="number" step="0.001" min="0" {...register(`services.${index}.price`, { valueAsNumber: true })} />
                        </TableCell>
                        <TableCell className="text-right font-medium">{(qty * price).toFixed(3)}</TableCell>
                        <TableCell>
                          <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => removeService(index)}>
                            <Trash className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* PARTS SECTION */}
          <div className="space-y-4 border rounded-md p-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-lg">Parts</h3>
              <PartSelectionModal onSelect={(part) => {
                if (!watchedParts.find(p => p.inventoryId === part.id)) {
                  appendPart({ inventoryId: part.id, name: part.itemName, quantity: 1, price: part.sellingPrice, maxStock: part.quantity })
                } else {
                  toast.error("Part already added.")
                }
              }} />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Part</TableHead>
                  <TableHead className="w-24">Qty</TableHead>
                  <TableHead className="w-32">Price</TableHead>
                  <TableHead className="w-32 text-right">Amount</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partFields.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No parts added.</TableCell></TableRow>
                ) : (
                  partFields.map((field, index) => {
                    const qty = watchedParts[index]?.quantity || 0
                    const price = watchedParts[index]?.price || 0
                    const maxStock = field.maxStock
                    return (
                      <TableRow key={field.id}>
                        <TableCell>{field.name} <span className="text-xs text-muted-foreground block">Stock: {maxStock}</span></TableCell>
                        <TableCell>
                          <Input 
                            type="number" 
                            min="1" 
                            max={maxStock} 
                            {...register(`parts.${index}.quantity`, { 
                              valueAsNumber: true,
                              max: { value: maxStock, message: `Max stock is ${maxStock}` }
                            })} 
                          />
                          {errors.parts?.[index]?.quantity && (
                            <span className="text-xs text-destructive">{errors.parts[index]?.quantity?.message}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input type="number" step="0.001" min="0" {...register(`parts.${index}.price`, { valueAsNumber: true })} />
                        </TableCell>
                        <TableCell className="text-right font-medium">{(qty * price).toFixed(3)}</TableCell>
                        <TableCell>
                          <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => removePart(index)}>
                            <Trash className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes / Remarks</Label>
            <Textarea id="notes" rows={2} placeholder="Any additional notes..." {...register("notes")} />
          </div>
        </div>

        {/* RIGHT COLUMN: Summary */}
        <div className="space-y-6">
          <div className="bg-muted p-6 rounded-lg space-y-4 sticky top-6">
            <h3 className="font-bold text-xl mb-4">Summary</h3>
            
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Service Total:</span>
              <span>{serviceTotal.toFixed(3)} OMR</span>
            </div>
            
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Parts Total:</span>
              <span>{partsTotal.toFixed(3)} OMR</span>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <div className="flex justify-between items-center">
                <Label htmlFor="discount">Discount Amount (OMR)</Label>
                <Input id="discount" type="number" step="0.001" className="w-24 h-8 text-right" {...register("discount", { valueAsNumber: true })} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="tax">Tax (%)</Label>
                <Input id="tax" type="number" step="0.1" className="w-24 h-8 text-right" {...register("tax", { valueAsNumber: true })} />
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t font-bold text-lg">
              <span>Grand Total:</span>
              <span>{grandTotal.toFixed(3)} OMR</span>
            </div>

            <Button type="submit" className="w-full mt-4" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving..." : "Save Job Card"}
            </Button>
          </div>
        </div>

      </div>
    </form>
  )
}
