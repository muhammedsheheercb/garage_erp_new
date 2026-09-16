"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { getDirectSaleStock } from "../actions"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Plus, Search } from "lucide-react"

export function DirectSalePartPicker({ onSelect }: { onSelect: (part: any) => void }) {
  const [open, setOpen] = useState(false), [search, setSearch] = useState("")
  const { data: parts = [], isLoading } = useQuery({ queryKey: ["direct-sale-stock", search], queryFn: () => getDirectSaleStock(search), enabled: open })
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger render={<Button type="button" variant="outline"><Plus className="mr-2 h-4 w-4" />Add Part</Button>} /><DialogContent className="max-w-4xl sm:max-w-4xl max-h-[80dvh] overflow-y-auto"><DialogHeader><DialogTitle>Select Part</DialogTitle></DialogHeader><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search parts..." value={search} onChange={event => setSearch(event.target.value)} /></div><div className="overflow-x-auto rounded-md border"><table className="w-full min-w-[720px] text-sm"><thead className="sticky top-0 bg-muted"><tr><th className="p-3 text-left">Part Name / Batch</th><th className="text-left">Part No.</th><th>Stock</th><th className="text-right">Purchase Price</th><th className="p-2 text-right">Actions</th></tr></thead><tbody>{isLoading ? <tr><td className="p-6 text-center" colSpan={5}>Loading...</td></tr> : !parts.length ? <tr><td className="p-6 text-center" colSpan={5}>No available parts found.</td></tr> : parts.map(part => <tr className="border-t" key={part.id}><td className="p-3 font-medium">{part.itemName}<span className="block text-xs text-muted-foreground">Batch: {part.batchNumber}</span></td><td>{part.partNumber}</td><td className="text-center"><b>{part.availableQuantity}</b><span className="block text-xs text-muted-foreground">{part.quantity} total, {part.reservedQuantity} reserved</span></td><td className="text-right">{part.purchasePrice}</td><td className="p-2 text-right"><Button type="button" size="sm" onClick={() => { onSelect(part); setOpen(false) }}>Select</Button></td></tr>)}</tbody></table></div></DialogContent></Dialog>
}
