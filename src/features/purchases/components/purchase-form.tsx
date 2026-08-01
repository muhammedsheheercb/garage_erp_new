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
import { createPortal } from "react-dom"
import { Check, Plus, Search, Trash2, Loader2, UserPlus, X } from "lucide-react"
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
  const [jobCardPickerPosition, setJobCardPickerPosition] = useState<{ top: number; left: number; width: number } | null>(null)
  const [itemSearches, setItemSearches] = useState<Record<string, string>>({})
  const [openItemPicker, setOpenItemPicker] = useState<string | null>(null)
  const [itemPickerPosition, setItemPickerPosition] = useState<{ top: number; left: number; width: number } | null>(null)
  const [supplierSearch, setSupplierSearch] = useState("")
  const [isSupplierPickerOpen, setIsSupplierPickerOpen] = useState(false)
  const [supplierPickerPosition, setSupplierPickerPosition] = useState<{ top: number; left: number; width: number } | null>(null)
  const selectedJobCard = dropdownData?.jobCards?.find((jc: any) => jc.id === watch("jobCardId"))

  const matchingPurchaseJobCards = dropdownData?.jobCards?.filter((jc: any) => {
    const query = vehicleSearch.trim().toLowerCase()
    return !query || jc.vehicle.plateNumber.toLowerCase().includes(query) || jc.customer.name.toLowerCase().includes(query) || jc.complaint.toLowerCase().includes(query)
  }) || []

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
      queryClient.invalidateQueries({ queryKey: ['jobcards'] })
      queryClient.invalidateQueries({ queryKey: ['jobcards-dropdowns'] })
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
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

  const updateJobCardPickerPosition = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect()
    setJobCardPickerPosition({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 320) })
  }

  const updateItemPickerPosition = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect()
    setItemPickerPosition({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 260) })
  }

  const updateSupplierPickerPosition = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect()
    setSupplierPickerPosition({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 280) })
  }

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
          <div className="space-y-2">
            <Label htmlFor="jobCardId">Select Job Card <span className="text-destructive">*</span></Label>
            <Controller
              control={control}
              name="jobCardId"
              render={({ field }) => (
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-2.5 z-10 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="jobCardId"
                    value={isJobCardSelectOpen ? vehicleSearch : (selectedJobCard ? `${selectedJobCard.vehicle.plateNumber} - ${selectedJobCard.customer.name}` : "")}
                    placeholder="Search and select job card"
                    className="pl-9 pr-9"
                    autoComplete="off"
                    onFocus={(event) => {
                      setVehicleSearch("")
                      setIsJobCardSelectOpen(true)
                      updateJobCardPickerPosition(event.currentTarget)
                    }}
                    onBlur={() => window.setTimeout(() => {
                      setIsJobCardSelectOpen(false)
                      setJobCardPickerPosition(null)
                    }, 150)}
                    onChange={(event) => {
                      setVehicleSearch(event.target.value)
                      field.onChange("")
                      setIsJobCardSelectOpen(true)
                      updateJobCardPickerPosition(event.currentTarget)
                    }}
                  />
                  {(field.value || vehicleSearch) && <button type="button" aria-label="Clear job card" className="absolute right-2 top-1.5 z-10 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" onMouseDown={(event) => event.preventDefault()} onClick={(event) => {
                    const input = event.currentTarget.parentElement?.querySelector("input") as HTMLInputElement | null
                    field.onChange(null)
                    setVehicleSearch("")
                    setIsJobCardSelectOpen(true)
                    if (input) updateJobCardPickerPosition(input)
                  }}><X className="h-4 w-4" /></button>}
                  {isJobCardSelectOpen && jobCardPickerPosition && typeof document !== "undefined" && createPortal(
                    <div className="fixed z-[100] max-h-60 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-lg" style={jobCardPickerPosition}>
                      {matchingPurchaseJobCards.length > 0 ? matchingPurchaseJobCards.map((jc: any) => (
                        <button key={jc.id} type="button" className="flex w-full items-center justify-between rounded-sm px-3 py-2 text-left text-sm hover:bg-accent" onMouseDown={(event) => event.preventDefault()} onClick={() => {
                          field.onChange(jc.id)
                          setVehicleSearch(`${jc.vehicle.plateNumber} - ${jc.customer.name}`)
                          setIsJobCardSelectOpen(false)
                          setJobCardPickerPosition(null)
                        }}>
                          <span className="min-w-0"><span className="block font-medium">{jc.vehicle.plateNumber} - {jc.customer.name}</span><span className="block truncate text-xs text-muted-foreground">{jc.complaint}</span></span>
                          {field.value === jc.id && <Check className="ml-3 h-4 w-4 text-primary" />}
                        </button>
                      )) : <p className="px-3 py-4 text-center text-sm text-muted-foreground">No active job cards found.</p>}
                    </div>, document.body
                  )}
                </div>
              )}
            />
            {errors.jobCardId && <p className="text-sm text-destructive">{errors.jobCardId.message}</p>}
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
            render={({ field }) => {
              const selectedSupplier = dropdownData?.suppliers.find((s: any) => s.id === field.value)
              const filteredSuppliers = dropdownData?.suppliers.filter((s: any) => s.name.toLowerCase().includes(supplierSearch.trim().toLowerCase())) || []
              return (
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-2.5 z-10 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="supplierId"
                    value={isSupplierPickerOpen ? supplierSearch : (selectedSupplier?.name || "")}
                    placeholder={t.suppliers.selectSupplier}
                    className="pl-9 pr-9"
                    autoComplete="off"
                    onFocus={(event) => {
                      setSupplierSearch("")
                      setIsSupplierPickerOpen(true)
                      updateSupplierPickerPosition(event.currentTarget)
                    }}
                    onBlur={() => window.setTimeout(() => {
                      setIsSupplierPickerOpen(false)
                      setSupplierPickerPosition(null)
                    }, 150)}
                    onChange={(event) => {
                      setSupplierSearch(event.target.value)
                      field.onChange("")
                      setIsSupplierPickerOpen(true)
                      updateSupplierPickerPosition(event.currentTarget)
                    }}
                  />
                  {(selectedSupplier || supplierSearch) && <button type="button" aria-label="Clear supplier" className="absolute right-2 top-1.5 z-10 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" onMouseDown={(event) => event.preventDefault()} onClick={(event) => {
                    const input = event.currentTarget.parentElement?.querySelector("input") as HTMLInputElement | null
                    field.onChange("")
                    setSupplierSearch("")
                    setIsSupplierPickerOpen(true)
                    if (input) updateSupplierPickerPosition(input)
                  }}><X className="h-4 w-4" /></button>}
                  {isSupplierPickerOpen && supplierPickerPosition && typeof document !== "undefined" && createPortal(
                    <div className="fixed z-[100] max-h-60 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-lg" style={supplierPickerPosition}>
                      {filteredSuppliers.length > 0 ? filteredSuppliers.map((supplier: any) => (
                        <button key={supplier.id} type="button" className="flex w-full items-center justify-between rounded-sm px-3 py-2 text-left text-sm hover:bg-accent" onMouseDown={(event) => event.preventDefault()} onClick={() => {
                          field.onChange(supplier.id)
                          setSupplierSearch(supplier.name)
                          setIsSupplierPickerOpen(false)
                          setSupplierPickerPosition(null)
                        }}>
                          <span>{supplier.name}</span>
                          {field.value === supplier.id && <Check className="h-4 w-4 text-primary" />}
                        </button>
                      )) : <p className="px-3 py-4 text-center text-sm text-muted-foreground">No matching suppliers found.</p>}
                    </div>, document.body
                  )}
                </div>
              )
            }}
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

        <div className="border rounded-md overflow-visible bg-card">
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
                        render={({ field: selectField }) => {
                          const selectedInv = dropdownData?.inventory.find((i: any) => i.id === selectField.value)
                          const search = itemSearches[field.id] ?? ""
                          const filteredInventory = dropdownData?.inventory.filter((inv: any) => {
                            const query = search.trim().toLowerCase()
                            return !query || inv.itemName.toLowerCase().includes(query) || inv.partNumber.toLowerCase().includes(query)
                          }) || []

                          return (
                            <div className="relative min-w-[190px]">
                              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                              <Input
                                value={openItemPicker === field.id ? search : (selectedInv?.itemName || "")}
                                placeholder={t.inventoryMod.selectItem}
                                autoComplete="off"
                                className="h-9 pl-9 pr-9"
                                onFocus={(event) => {
                                  setItemSearches((current) => ({ ...current, [field.id]: "" }))
                                  setOpenItemPicker(field.id)
                                  updateItemPickerPosition(event.currentTarget)
                                }}
                                onBlur={() => window.setTimeout(() => {
                                  setOpenItemPicker((current) => current === field.id ? null : current)
                                  setItemPickerPosition(null)
                                }, 150)}
                                onChange={(event) => {
                                  const value = event.target.value
                                  setItemSearches((current) => ({ ...current, [field.id]: value }))
                                  updateItemPickerPosition(event.currentTarget)
                                  const exactMatch = dropdownData?.inventory.find((inv: any) =>
                                    inv.itemName.toLowerCase() === value.trim().toLowerCase() ||
                                    inv.partNumber.toLowerCase() === value.trim().toLowerCase()
                                  )
                                  if (exactMatch) {
                                    selectField.onChange(exactMatch.id)
                                    setValue(`items.${index}.purchasePrice`, exactMatch.purchasePrice)
                                    setValue(`items.${index}.sellingPrice`, exactMatch.sellingPrice)
                                  } else {
                                    selectField.onChange("")
                                  }
                                  setOpenItemPicker(field.id)
                                }}
                              />
                              {(selectedInv || search) && (
                                <button
                                  type="button"
                                  aria-label="Clear selected item"
                                  className="absolute right-2 top-1.5 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                                  onMouseDown={(event) => event.preventDefault()}
                                  onClick={(event) => {
                                    const input = event.currentTarget.parentElement?.querySelector("input") as HTMLInputElement | null
                                    selectField.onChange("")
                                    setValue(`items.${index}.purchasePrice`, 0)
                                    setValue(`items.${index}.sellingPrice`, 0)
                                    setItemSearches((current) => ({ ...current, [field.id]: "" }))
                                    setOpenItemPicker(field.id)
                                    if (input) updateItemPickerPosition(input)
                                  }}
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              )}
                              {openItemPicker === field.id && itemPickerPosition && typeof document !== "undefined" ? createPortal(
                                <div
                                  className="fixed z-[100] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg"
                                  style={itemPickerPosition ? {
                                    top: itemPickerPosition.top,
                                    left: itemPickerPosition.left,
                                    width: itemPickerPosition.width,
                                  } : undefined}
                                >
                                  <div className="max-h-56 overflow-y-auto p-1">
                                    {filteredInventory.length > 0 ? filteredInventory.map((inv: any) => (
                                      <button
                                        key={inv.id}
                                        type="button"
                                        className="flex w-full items-center justify-between rounded-sm px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                                        onMouseDown={(event) => event.preventDefault()}
                                        onClick={() => {
                                          selectField.onChange(inv.id)
                                          setValue(`items.${index}.purchasePrice`, inv.purchasePrice)
                                          setValue(`items.${index}.sellingPrice`, inv.sellingPrice)
                                          setItemSearches((current) => ({ ...current, [field.id]: inv.itemName }))
                                          setOpenItemPicker(null)
                                          setItemPickerPosition(null)
                                        }}
                                      >
                                        <span className="min-w-0">
                                          <span className="block truncate font-medium">{inv.itemName}</span>
                                          <span className="block text-xs text-muted-foreground">{inv.partNumber}</span>
                                        </span>
                                        {selectedInv?.id === inv.id && <Check className="ml-3 h-4 w-4 shrink-0 text-primary" />}
                                      </button>
                                    )) : (
                                      <p className="px-3 py-4 text-center text-sm text-muted-foreground">No matching items found.</p>
                                    )}
                                  </div>
                                </div>,
                                document.body
                              ) : null}
                            </div>
                          )
                        }}
                      />
                      {errors.items?.[index]?.inventoryId && <p className="mt-1 text-xs text-destructive">{errors.items[index]?.inventoryId?.message}</p>}
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
