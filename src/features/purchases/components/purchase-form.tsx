"use client"

import { useForm, Controller, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { PurchaseFormValues, purchaseSchema } from "../schema"
import { createPurchase, getPurchaseDropdownData, getNextPurchaseNumber } from "../actions"
import { getActiveTaxSetting } from "../../settings/actions"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useEffect, useState } from "react"
import { Plus, Trash2, Loader2 } from "lucide-react"

interface PurchaseFormProps {
  onSuccess?: () => void
}

export function PurchaseForm({ onSuccess }: PurchaseFormProps) {
  const queryClient = useQueryClient()
  const [purchaseNumber, setPurchaseNumber] = useState("Generating...")

  const { data: dropdownData, isLoading: dropdownsLoading } = useQuery({
    queryKey: ['purchase-dropdowns'],
    queryFn: () => getPurchaseDropdownData()
  })

  const { data: activeTax } = useQuery({
    queryKey: ['active-tax'],
    queryFn: () => getActiveTaxSetting()
  })

  const activeTaxRate = activeTax ? activeTax.percentage : 0
  const activeTaxName = activeTax ? activeTax.name : "VAT"

  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<PurchaseFormValues>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: {
      purchaseDate: new Date().toISOString().split('T')[0],
      supplierId: "",
      paymentMethodId: "",
      discount: 0,
      paidAmount: 0,
      items: [{ inventoryId: "", quantity: 1, purchasePrice: 0, sellingPrice: 0 }]
    }
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items"
  })

  useEffect(() => {
    getNextPurchaseNumber().then(num => setPurchaseNumber(num))
  }, [])

  const mutation = useMutation({
    mutationFn: (data: PurchaseFormValues) => createPurchase(data),
    onSuccess: () => {
      toast.success("Purchase registered successfully")
      queryClient.invalidateQueries({ queryKey: ['purchases'] })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      queryClient.invalidateQueries({ queryKey: ['paymeters'] })
      onSuccess?.()
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save purchase")
    }
  })

  const items = watch("items") || []
  const discountVal = watch("discount") || 0
  const paidVal = watch("paidAmount") || 0

  const subTotal = items.reduce((acc, item) => {
    const qty = Number(item.quantity) || 0
    const price = Number(item.purchasePrice) || 0
    return acc + (qty * price)
  }, 0)

  const taxAmount = (subTotal - discountVal) * (activeTaxRate / 100)
  const grandTotal = Math.max(0, subTotal + taxAmount - discountVal)
  const pendingAmount = Math.max(0, grandTotal - paidVal)

  const onSubmit = (data: PurchaseFormValues) => {
    if (data.paidAmount > grandTotal) {
      toast.error("Paid amount cannot exceed Grand Total")
      return
    }
    mutation.mutate(data)
  }

  if (dropdownsLoading) {
    return (
      <div className="flex justify-center items-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label>Purchase Number</Label>
          <Input value={purchaseNumber} readOnly className="bg-muted" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="purchaseDate">Purchase Date <span className="text-destructive">*</span></Label>
          <Input id="purchaseDate" type="date" {...register("purchaseDate")} />
          {errors.purchaseDate && <p className="text-sm text-destructive">{errors.purchaseDate.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="supplierId">Supplier <span className="text-destructive">*</span></Label>
          <Controller
            control={control}
            name="supplierId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="supplierId">
                  <SelectValue placeholder="Select Supplier">
                    {(val: string) => dropdownData?.suppliers.find((s: any) => s.id === val)?.name || null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {dropdownData?.suppliers.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.supplierId && <p className="text-sm text-destructive">{errors.supplierId.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="paymentMethodId">Paymeter / Ledger <span className="text-destructive">*</span></Label>
          <Controller
            control={control}
            name="paymentMethodId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="paymentMethodId">
                  <SelectValue placeholder="Select Paymeter">
                    {(val: string) => dropdownData?.paymeters.find((p: any) => p.id === val)?.name || null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {dropdownData?.paymeters.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.paymentMethodId && <p className="text-sm text-destructive">{errors.paymentMethodId.message}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label className="text-base font-semibold">Purchase Items</Label>
          <Button 
            type="button" 
            variant="outline" 
            size="sm"
            onClick={() => append({ inventoryId: "", quantity: 1, purchasePrice: 0, sellingPrice: 0 })}
          >
            <Plus className="mr-1 h-4 w-4" /> Add Item
          </Button>
        </div>

        <div className="border rounded-md overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30%]">Item / Part</TableHead>
                <TableHead className="w-[15%]">Qty</TableHead>
                <TableHead className="w-[20%]">Purchase Price (OMR)</TableHead>
                <TableHead className="w-[20%]">Selling Price (OMR)</TableHead>
                <TableHead className="w-[10%]">Total</TableHead>
                <TableHead className="w-[5%] text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field, index) => {
                const itemQty = watch(`items.${index}.quantity`) || 0
                const itemPrice = watch(`items.${index}.purchasePrice`) || 0
                const rowTotal = itemQty * itemPrice

                return (
                  <TableRow key={field.id}>
                    <TableCell>
                      <Controller
                        control={control}
                        name={`items.${index}.inventoryId`}
                        render={({ field: selectField }) => (
                          <Select 
                            value={selectField.value} 
                            onValueChange={(val) => {
                              selectField.onChange(val)
                              // Auto pre-populate purchase price & selling price
                              const selectedInv = dropdownData?.inventory.find((i: any) => i.id === val)
                              if (selectedInv) {
                                setValue(`items.${index}.purchasePrice`, selectedInv.purchasePrice)
                                setValue(`items.${index}.sellingPrice`, selectedInv.sellingPrice)
                              }
                            }}
                          >
                          <SelectTrigger>
                              <SelectValue placeholder="Select Item">
                                {(val: string) => {
                                  const inv = dropdownData?.inventory.find((i: any) => i.id === val)
                                  return inv ? `${inv.itemName} (${inv.partNumber})` : null
                                }}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {dropdownData?.inventory.map((inv: any) => (
                                <SelectItem key={inv.id} value={inv.id}>
                                  {inv.itemName} ({inv.partNumber})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </TableCell>

                    <TableCell>
                      <Input 
                        type="number" 
                        min="1"
                        {...register(`items.${index}.quantity` as const, { valueAsNumber: true })} 
                      />
                    </TableCell>

                    <TableCell>
                      <Input 
                        type="number" 
                        step="0.001"
                        min="0"
                        {...register(`items.${index}.purchasePrice` as const, { valueAsNumber: true })} 
                      />
                    </TableCell>

                    <TableCell>
                      <Input 
                        type="number" 
                        step="0.001"
                        min="0"
                        {...register(`items.${index}.sellingPrice` as const, { valueAsNumber: true })} 
                      />
                    </TableCell>

                    <TableCell className="font-semibold text-sm">
                      {rowTotal.toFixed(3)}
                    </TableCell>

                    <TableCell className="text-right">
                      {fields.length > 1 && (
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          className="text-destructive hover:text-destructive"
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
        {errors.items && <p className="text-sm text-destructive">{errors.items.message}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="discount">Discount Amount (OMR)</Label>
              <Input 
                id="discount" 
                type="number" 
                step="0.001"
                min="0"
                {...register("discount", { valueAsNumber: true })} 
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="paidAmount">Paid Amount (OMR) <span className="text-destructive">*</span></Label>
              <Input 
                id="paidAmount" 
                type="number" 
                step="0.001"
                min="0"
                max={grandTotal}
                {...register("paidAmount", { valueAsNumber: true })} 
              />
              {errors.paidAmount && <p className="text-sm text-destructive">{errors.paidAmount.message}</p>}
            </div>
          </div>
        </div>

        <div className="bg-muted/30 p-4 rounded-lg space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal:</span>
            <span className="font-medium">{subTotal.toFixed(3)} OMR</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Discount:</span>
            <span className="font-medium">-{discountVal.toFixed(3)} OMR</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tax ({activeTaxName} {activeTaxRate}%):</span>
            <span className="font-medium">+{taxAmount.toFixed(3)} OMR</span>
          </div>

          <div className="flex justify-between border-t pt-2 text-base font-bold">
            <span>Grand Total:</span>
            <span className="text-primary">{grandTotal.toFixed(3)} OMR</span>
          </div>

          <div className="flex justify-between text-sm pt-1">
            <span className="text-muted-foreground font-semibold">Paid Amount:</span>
            <span className="text-green-600 font-semibold">{paidVal.toFixed(3)} OMR</span>
          </div>

          <div className="flex justify-between text-sm border-t border-dashed pt-2 font-bold text-destructive">
            <span>Pending Amount:</span>
            <span>{pendingAmount.toFixed(3)} OMR</span>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onSuccess}>Cancel</Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : "Save Purchase"}
        </Button>
      </div>
    </form>
  )
}
