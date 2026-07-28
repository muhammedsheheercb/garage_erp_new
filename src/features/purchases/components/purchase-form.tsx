"use client"

import { useForm, Controller, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { PurchaseFormValues, purchaseSchema } from "../schema"
import { createPurchase, updatePurchase, getPurchaseDropdownData, getNextPurchaseNumber } from "../actions"
import { getActiveTaxSetting } from "../../settings/actions"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useEffect, useState } from "react"
import { Plus, Trash2, Loader2, UserPlus } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { SupplierForm } from "../../suppliers/components/supplier-form"
import { useTranslation } from "@/i18n"

interface PurchaseFormProps {
  onSuccess?: () => void
  initialData?: any
}

export function PurchaseForm({ onSuccess, initialData }: PurchaseFormProps) {
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const [purchaseNumber, setPurchaseNumber] = useState<string>(initialData?.purchaseNumber || t.inventoryMod.generatingPartNo)
  const [isSupplierAddOpen, setIsSupplierAddOpen] = useState(false)

  const { data: dropdownData, isLoading: dropdownsLoading } = useQuery({
    queryKey: ['purchase-dropdowns'],
    queryFn: () => getPurchaseDropdownData()
  })

  const { data: activeTax } = useQuery({
    queryKey: ['active-tax'],
    queryFn: () => getActiveTaxSetting()
  })

  const activeTaxRate = activeTax ? activeTax.percentage : 0
  const activeTaxName = activeTax ? activeTax.name : t.settings.taxTab.taxName

  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<PurchaseFormValues>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: initialData ? {
      purchaseDate: new Date(initialData.purchaseDate).toISOString().split('T')[0],
      purchaseType: initialData.purchaseType || "STOCK",
      jobCardId: initialData.jobCardId || null,
      supplierId: initialData.supplierId,
      paymentSource: "PAYMETER",
      paymentMethodId: initialData.paymentMethodId,
      directPaymentMethod: undefined,
      discount: initialData.discount,
      paidAmount: initialData.paidAmount,
      items: initialData.items.map((item: any) => ({
        inventoryId: item.inventoryId,
        quantity: item.quantity,
        purchasePrice: item.purchasePrice,
        sellingPrice: item.sellingPrice
      }))
    } : {
      purchaseDate: new Date().toISOString().split('T')[0],
      purchaseType: "STOCK",
      jobCardId: null,
      supplierId: "",
      paymentSource: "PAYMETER",
      paymentMethodId: "",
      directPaymentMethod: undefined,
      discount: 0,
      paidAmount: 0,
      items: [{ inventoryId: "", quantity: 1, purchasePrice: 0, sellingPrice: 0 }]
    }
  })

  const purchaseType = watch("purchaseType")
  const [vehicleSearch, setVehicleSearch] = useState("")
  const [isJobCardSelectOpen, setIsJobCardSelectOpen] = useState(false)
  const selectedJobCard = dropdownData?.jobCards?.find((jc: any) => jc.id === watch("jobCardId"))

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items"
  })

  useEffect(() => {
    if (!initialData) {
      getNextPurchaseNumber().then(num => setPurchaseNumber(num))
    }
  }, [initialData])

  const mutation = useMutation({
    mutationFn: (data: PurchaseFormValues) => 
      initialData ? updatePurchase(initialData.id, data) : createPurchase(data),
    onSuccess: () => {
      toast.success(initialData ? t.common.save : t.purchases.purchaseRegisteredSuccess)
      queryClient.invalidateQueries({ queryKey: ['purchases'] })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      queryClient.invalidateQueries({ queryKey: ['paymeters'] })
      onSuccess?.()
    },
    onError: (error: any) => {
      toast.error(error.message || t.common.somethingWrong)
    }
  })

  const items = watch("items") || []
  const discountVal = watch("discount") || 0
  const paidVal = watch("paidAmount") || 0
  const paymentSource = watch("paymentSource")

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
      toast.error(t.purchases.paidExceedsGrand)
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
          <Label>{t.purchases.purchaseNumber}</Label>
          <Input value={purchaseNumber} readOnly className="bg-muted" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="purchaseType">Purchase Type <span className="text-destructive">*</span></Label>
          <Controller
            control={control}
            name="purchaseType"
            render={({ field }) => (
              <Select value={field.value} onValueChange={(val) => {
                field.onChange(val)
                if (val === "STOCK") {
                  setValue("jobCardId", null)
                }
              }}>
                <SelectTrigger id="purchaseType"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="STOCK">Stock Purchase</SelectItem>
                  <SelectItem value="VEHICLE">Vehicle Purchase</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="purchaseDate">{t.purchases.purchaseDate} <span className="text-destructive">*</span></Label>
          <Input id="purchaseDate" type="date" {...register("purchaseDate")} />
          {errors.purchaseDate && <p className="text-sm text-destructive">{errors.purchaseDate.message}</p>}
        </div>
      </div>
      
      {purchaseType === "VEHICLE" && (
        <div className="bg-muted/30 p-4 rounded-lg border space-y-4">
          <h3 className="font-semibold">Vehicle & Job Card Selection</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Search Vehicle Plate Number</Label>
              <Input 
                placeholder="e.g. 1234 A" 
                value={vehicleSearch} 
                onChange={(e) => setVehicleSearch(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jobCardId">Select Job Card <span className="text-destructive">*</span></Label>
              <Controller
                control={control}
                name="jobCardId"
                render={({ field }) => {
                  const filteredJobCards = dropdownData?.jobCards?.filter((jc: any) => 
                    jc.vehicle.plateNumber.toLowerCase().includes(vehicleSearch.toLowerCase())
                  ) || []
                  
                  return (
                    <Select value={field.value || ""} onValueChange={field.onChange} open={isJobCardSelectOpen} onOpenChange={setIsJobCardSelectOpen}>
                      <SelectTrigger id="jobCardId">
                        <SelectValue placeholder="Select Job Card">
                          {(val: string) => {
                            const jc = dropdownData?.jobCards?.find((j: any) => j.id === val)
                            return jc ? `${jc.vehicle.plateNumber} - ${jc.customer.name}` : null
                          }}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {filteredJobCards.length > 0 ? (
                          filteredJobCards.map((jc: any) => (
                            <SelectItem key={jc.id} value={jc.id}>
                              {jc.vehicle.plateNumber} - {jc.customer.name} (Complaints: {jc.complaint.substring(0, 20)})
                            </SelectItem>
                          ))
                        ) : (
                          <div className="p-2 text-sm text-muted-foreground text-center">No active job cards found</div>
                        )}
                      </SelectContent>
                    </Select>
                  )
                }}
              />
              {errors.jobCardId && <p className="text-sm text-destructive">{errors.jobCardId.message}</p>}
            </div>
          </div>
          
          {selectedJobCard && (
            <div className="grid grid-cols-3 gap-2 text-sm bg-background p-3 rounded border">
              <div>
                <span className="text-muted-foreground block text-xs">Customer</span>
                <span className="font-medium">{selectedJobCard.customer.name}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs">Vehicle</span>
                <span className="font-medium">{selectedJobCard.vehicle.brand} {selectedJobCard.vehicle.model} ({selectedJobCard.vehicle.plateNumber})</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs">Complaint</span>
                <span className="font-medium truncate block" title={selectedJobCard.complaint}>{selectedJobCard.complaint}</span>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label htmlFor="supplierId">{t.suppliers.supplierTitle} <span className="text-destructive">*</span></Label>
            <Dialog open={isSupplierAddOpen} onOpenChange={setIsSupplierAddOpen}>
              <DialogTrigger render={
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                  <UserPlus className="h-3 w-3 mr-1" />
                  {t.common.add || 'Add'}
                </Button>
              } />
              <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle>{t.suppliers.addNewSupplier}</DialogTitle>
                </DialogHeader>
                <SupplierForm onSuccess={async (newSupplier) => {
                  setIsSupplierAddOpen(false)
                  await queryClient.invalidateQueries({ queryKey: ['purchase-dropdowns'] })
                  if (newSupplier && newSupplier.id) {
                    setValue("supplierId", newSupplier.id)
                  }
                }} />
              </DialogContent>
            </Dialog>
          </div>
          <Controller
            control={control}
            name="supplierId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="supplierId">
                  <SelectValue placeholder={t.suppliers.selectSupplier}>
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
          <Label htmlFor="paymentSource">{t.payments.paymentMethod} <span className="text-destructive">*</span></Label>
          <Controller
            control={control}
            name="paymentSource"
            render={({ field }) => (
              <Select value={field.value} onValueChange={(value) => {
                field.onChange(value)
                setValue("paymentMethodId", "")
                setValue("directPaymentMethod", undefined)
              }}>
                <SelectTrigger id="paymentSource"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PAYMETER">{t.purchases.paymeterLedger}</SelectItem>
                  <SelectItem value="DIRECT">{t.payments.directPayment}</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>

        {paymentSource === "PAYMETER" ? (
        <div className="space-y-2">
          <Label htmlFor="paymentMethodId">{t.purchases.paymeterLedger} <span className="text-destructive">*</span></Label>
          <Controller
            control={control}
            name="paymentMethodId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="paymentMethodId">
                  <SelectValue placeholder={t.purchases.selectPaymeter}>
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
        ) : (
        <div className="space-y-2">
          <Label htmlFor="directPaymentMethod">{t.payments.paymentMethod} <span className="text-destructive">*</span></Label>
          <Controller
            control={control}
            name="directPaymentMethod"
            render={({ field }) => (
              <Select value={field.value || ""} onValueChange={field.onChange}>
                <SelectTrigger id="directPaymentMethod"><SelectValue placeholder={t.payments.selectMethod} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">{t.payments.cash}</SelectItem>
                  <SelectItem value="BANK_TRANSFER">{t.payments.bankTransfer}</SelectItem>
                  <SelectItem value="CARD">{t.payments.card}</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          {errors.directPaymentMethod && <p className="text-sm text-destructive">{errors.directPaymentMethod.message}</p>}
        </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label className="text-base font-semibold">{t.purchases.purchaseItems}</Label>
          <Button 
            type="button" 
            variant="outline" 
            size="sm"
            onClick={() => append({ inventoryId: "", quantity: 1, purchasePrice: 0, sellingPrice: 0 })}
          >
            <Plus className="mr-1 h-4 w-4" /> {t.purchases.addItem}
          </Button>
        </div>

        <div className="border rounded-md overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30%]">{t.purchases.itemPart}</TableHead>
                <TableHead className="w-[15%]">{t.invoicesMod.qty}</TableHead>
                <TableHead className="w-[20%]">{t.purchases.purchasePrice} (OMR)</TableHead>
                <TableHead className="w-[20%]">{t.purchases.sellingPrice} (OMR)</TableHead>
                <TableHead className="w-[10%]">{t.purchases.totalAmount}</TableHead>
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
                              <SelectValue placeholder={t.inventoryMod.selectItem}>
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
              <Label htmlFor="discount">{t.jobcards.discountAmount}</Label>
              <Input 
                id="discount" 
                type="number" 
                step="0.001"
                min="0"
                {...register("discount", { valueAsNumber: true })} 
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="paidAmount">{t.purchases.paidAmount} (OMR) <span className="text-destructive">*</span></Label>
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
            <span className="text-muted-foreground">{t.invoicesMod.subTotal}:</span>
            <span className="font-medium">{subTotal.toFixed(3)} OMR</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t.invoicesMod.discount}:</span>
            <span className="font-medium">-{discountVal.toFixed(3)} OMR</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t.invoicesMod.tax} ({activeTaxName} {activeTaxRate}%):</span>
            <span className="font-medium">+{taxAmount.toFixed(3)} OMR</span>
          </div>

          <div className="flex justify-between border-t pt-2 text-base font-bold">
            <span>{t.invoicesMod.grandTotal}:</span>
            <span className="text-primary">{grandTotal.toFixed(3)} OMR</span>
          </div>

          <div className="flex justify-between text-sm pt-1">
            <span className="text-muted-foreground font-semibold">{t.purchases.paidAmount}:</span>
            <span className="text-green-600 font-semibold">{paidVal.toFixed(3)} OMR</span>
          </div>

          <div className="flex justify-between text-sm border-t border-dashed pt-2 font-bold text-destructive">
            <span>{t.purchases.pendingAmount}:</span>
            <span>{pendingAmount.toFixed(3)} OMR</span>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onSuccess}>{t.common.cancel}</Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? t.common.saving : t.purchases.savePurchase}
        </Button>
      </div>
    </form>
  )
}
