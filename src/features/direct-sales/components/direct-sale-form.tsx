"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createDirectSale, updateDirectSale } from "../actions"
import { DirectSalePartPicker } from "./direct-sale-part-picker"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Trash } from "lucide-react"
import { toast } from "sonner"

type Row = { batchId: string; label: string; available: number; quantity: number; purchasePrice: number; salesPrice: number; vat: number }
type Errors = { vehicleNumber?: string; customerName?: string; saleDate?: string; items?: string }
const money = (amount: number) => amount.toFixed(3).replace(/\.?0+$/, "")

export function DirectSaleForm({ initialData, onSuccess }: { initialData?: any; onSuccess: () => void }) {
  const queryClient = useQueryClient()
  const [customer, setCustomer] = useState({ vehicleNumber: initialData?.vehicleNumber || "", customerName: initialData?.customerName || "", customerMobile: initialData?.customerMobile || "" })
  const [saleDate, setSaleDate] = useState(() => initialData?.saleDate ? new Date(initialData.saleDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10))
  const [rows, setRows] = useState<Row[]>(() => initialData?.items?.map((item: any) => ({ batchId: item.batchId, label: `${item.batch.inventory.itemName} — Batch ${item.batch.batchNumber}`, available: item.quantity, quantity: item.quantity, purchasePrice: item.purchasePrice, salesPrice: item.salesPrice, vat: item.vat })) || [])
  const [discount, setDiscount] = useState(initialData?.discount || 0)
  const [errors, setErrors] = useState<Errors>({})
  const subtotal = rows.reduce((sum, row) => sum + row.quantity * row.salesPrice, 0)
  const vat = rows.reduce((sum, row) => sum + row.quantity * row.salesPrice * row.vat / 100, 0)
  const billDiscount = Math.min(Math.max(0, Number(discount) || 0), subtotal)
  const total = subtotal + vat - billDiscount
  const updateRow = (index: number, patch: Partial<Row>) => setRows(current => current.map((row, rowIndex) => rowIndex !== index ? row : { ...row, ...patch, quantity: patch.quantity === undefined ? row.quantity : Math.min(Math.max(1, patch.quantity), row.available) }))
  const mutation = useMutation({
    mutationFn: async () => {
      const data = { ...customer, saleDate, discount: billDiscount, items: rows.map(row => ({ batchId: row.batchId, quantity: row.quantity, purchasePrice: row.purchasePrice, salesPrice: row.salesPrice, vat: row.vat })) }
      if (initialData) await updateDirectSale(initialData.id, data); else await createDirectSale(data)
      return { success: true }
    },
    onSuccess: () => { toast.success(initialData ? "Direct sale updated." : "Direct sale created successfully."); queryClient.invalidateQueries({ queryKey: ["direct-sales"] }); queryClient.invalidateQueries({ queryKey: ["direct-sale-stock"] }); onSuccess() },
    onError: (error: Error) => { const message = error.message || "Direct sale could not be created."; setErrors({ items: message }); toast.error(message) },
  })
  const submit = () => {
    const next: Errors = {}
    if (!customer.vehicleNumber.trim()) next.vehicleNumber = "Vehicle number is required."
    if (!customer.customerName.trim()) next.customerName = "Customer name is required."
    if (!saleDate) next.saleDate = "Sale date is required."
    if (saleDate > new Date().toISOString().slice(0, 10)) next.saleDate = "Sale date cannot be in the future."
    if (!rows.length) next.items = "Add at least one available part before completing the sale."
    if (Object.keys(next).length) { setErrors(next); return }
    setErrors({}); mutation.mutate()
  }
  const addPart = (part: any) => setRows(current => [...current, { batchId: part.id, label: `${part.itemName} — Batch ${part.batchNumber}`, available: part.availableQuantity, quantity: 1, purchasePrice: part.purchasePrice, salesPrice: part.purchasePrice, vat: 0 }])
  return <div className="direct-sale-form space-y-5">
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <CustomerField id="sale-vehicle" label="Vehicle Number" required value={customer.vehicleNumber} error={errors.vehicleNumber} onChange={value => { setCustomer({ ...customer, vehicleNumber: value }); setErrors({ ...errors, vehicleNumber: undefined }) }} />
      <CustomerField id="sale-customer" label="Customer Name" required value={customer.customerName} error={errors.customerName} onChange={value => { setCustomer({ ...customer, customerName: value }); setErrors({ ...errors, customerName: undefined }) }} />
      <CustomerField id="sale-mobile" label="Customer Mobile Number" value={customer.customerMobile} onChange={value => setCustomer({ ...customer, customerMobile: value })} />
      <CustomerField id="sale-date" label="Sale Date" required type="date" max={new Date().toISOString().slice(0, 10)} value={saleDate} error={errors.saleDate} onChange={value => { setSaleDate(value); setErrors({ ...errors, saleDate: undefined }) }} />
    </div>
    <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Products</h3><DirectSalePartPicker onSelect={addPart} /></div>
    {errors.items && <p className="text-sm text-destructive">{errors.items}</p>}
    {!rows.length ? <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No products added yet. Select <b>Add Part</b> to begin the bill.</div> : <ProductRows rows={rows} updateRow={updateRow} removeRow={index => setRows(rows.filter((_, rowIndex) => rowIndex !== index))} />}
    <div className="ml-auto w-full max-w-md space-y-2 rounded-lg bg-muted/50 p-4 text-sm"><div className="flex justify-between"><span>Subtotal</span><span>{money(subtotal)}</span></div><div className="flex items-center justify-between gap-3 text-destructive"><Label htmlFor="sale-discount">Discount</Label><Input id="sale-discount" className="h-9 w-32 text-right" type="number" min="0" max={subtotal} step="any" value={discount} onChange={event => setDiscount(Math.min(Math.max(0, Number(event.target.value)), subtotal))} /></div><div className="flex justify-between"><span>Total VAT</span><span>{money(vat)}</span></div><div className="flex justify-between border-t pt-2 text-base font-bold"><span>Grand Total</span><span>{money(total)}</span></div></div>
    <div className="sticky bottom-0 -mx-4 flex justify-end border-t bg-popover px-4 pt-3"><Button className="min-h-11 w-full sm:w-auto" disabled={mutation.isPending} onClick={submit}>{mutation.isPending ? "Saving..." : initialData ? "Update Direct Sale" : "Complete Direct Sale"}</Button></div>
  </div>
}

function CustomerField({ id, label, required, type, max, value, error, onChange }: { id: string; label: string; required?: boolean; type?: string; max?: string; value: string; error?: string; onChange: (value: string) => void }) { return <div className="space-y-1.5"><Label htmlFor={id}>{label}{required && <span className="text-destructive"> *</span>}</Label><Input id={id} type={type} max={max} value={value} onChange={event => onChange(event.target.value)} />{error && <p className="text-sm text-destructive">{error}</p>}</div> }

function ProductRows({ rows, updateRow, removeRow }: { rows: Row[]; updateRow: (index: number, patch: Partial<Row>) => void; removeRow: (index: number) => void }) {
  return <><div className="space-y-3 md:hidden">{rows.map((row, index) => <ProductCard key={row.batchId} row={row} index={index} updateRow={updateRow} remove={() => removeRow(index)} />)}</div><div className="hidden overflow-x-auto rounded-lg border md:block"><table className="w-full min-w-[900px] text-sm"><thead className="bg-muted"><tr><th className="p-3 text-left">Part / Batch</th><th>Available</th><th>Qty</th><th>Purchase Price</th><th>Sales Price</th><th>VAT %</th><th>VAT Amount</th><th>Total Amount</th><th /></tr></thead><tbody>{rows.map((row, index) => { const tax = row.quantity * row.salesPrice * row.vat / 100; return <tr className="border-t" key={row.batchId}><td className="p-3 font-medium">{row.label}</td><td className="text-center">{row.available}</td><td className="p-2"><Input type="number" min="1" max={row.available} value={row.quantity} onChange={event => updateRow(index, { quantity: Number(event.target.value) || 1 })} /></td><td className="p-2"><Input readOnly value={row.purchasePrice} /></td><td className="p-2"><Input type="number" min="0" step="any" value={row.salesPrice} onChange={event => updateRow(index, { salesPrice: Math.max(0, Number(event.target.value)) })} /></td><td className="p-2"><Input aria-label={`VAT percentage for ${row.label}`} type="number" min="0" step="any" value={row.vat} onChange={event => updateRow(index, { vat: Math.max(0, Number(event.target.value) || 0) })} /></td><td className="text-right">{money(tax)}</td><td className="pr-3 text-right font-medium">{money(row.quantity * row.salesPrice + tax)}</td><td><Button type="button" variant="ghost" size="icon" onClick={() => removeRow(index)}><Trash className="h-4 w-4 text-destructive" /></Button></td></tr> })}</tbody></table></div></>
}

function ProductCard({ row, index, updateRow, remove }: { row: Row; index: number; updateRow: (index: number, patch: Partial<Row>) => void; remove: () => void }) { const tax = row.quantity * row.salesPrice * row.vat / 100; return <div className="space-y-3 rounded-lg border p-3"><div className="flex items-start justify-between gap-2"><div><p className="font-medium">{row.label}</p><p className="text-xs text-muted-foreground">Available in this batch: {row.available}</p></div><Button type="button" variant="ghost" size="icon" onClick={remove}><Trash className="h-4 w-4 text-destructive" /></Button></div><div className="grid grid-cols-2 gap-3"><MiniField label="Quantity"><Input type="number" min="1" max={row.available} value={row.quantity} onChange={event => updateRow(index, { quantity: Number(event.target.value) || 1 })} /></MiniField><MiniField label="Purchase Price"><Input readOnly value={row.purchasePrice} /></MiniField><MiniField label="Sales Price"><Input type="number" min="0" step="any" value={row.salesPrice} onChange={event => updateRow(index, { salesPrice: Math.max(0, Number(event.target.value)) })} /></MiniField><MiniField label="VAT %"><Input type="number" min="0" step="any" value={row.vat} onChange={event => updateRow(index, { vat: Math.max(0, Number(event.target.value) || 0) })} /></MiniField><MiniField label="VAT Amount"><Input readOnly value={money(tax)} /></MiniField><MiniField label="Total Amount"><Input readOnly value={money(row.quantity * row.salesPrice + tax)} /></MiniField></div></div> }
function MiniField({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1"><Label>{label}</Label>{children}</div> }
