"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { getQuotationInventory } from "../actions"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Search } from "lucide-react"

export function QuotationPartSelectionModal({ onSelect }: { onSelect: (part: any) => void }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const { data: parts = [], isLoading } = useQuery({ queryKey: ["quotation-parts", search], queryFn: () => getQuotationInventory(search) })
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger render={<Button type="button" variant="outline" size="sm"><Plus className="mr-2 h-4 w-4" />Add Part</Button>} />
    <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-5xl overflow-x-hidden overflow-y-auto p-3 sm:w-[calc(100vw-2rem)] sm:max-w-5xl sm:p-6"><DialogHeader><DialogTitle>Select Part</DialogTitle></DialogHeader>
      <div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-8" placeholder="Search parts" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
      <div className="max-h-80 overflow-auto rounded-md border"><Table className="min-w-[620px]"><TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Part No.</TableHead><TableHead>Current Stock</TableHead><TableHead className="text-right">Price</TableHead><TableHead /></TableRow></TableHeader><TableBody>
        {isLoading ? <TableRow><TableCell colSpan={5} className="text-center">Loading...</TableCell></TableRow> : parts.map((part) => <TableRow key={part.id}><TableCell className="font-medium">{part.itemName}</TableCell><TableCell>{part.partNumber}</TableCell><TableCell>{part.availableQuantity}</TableCell><TableCell className="text-right">{part.sellingPrice} OMR</TableCell><TableCell className="text-right"><Button type="button" size="sm" disabled={part.availableQuantity <= 0} onClick={() => { onSelect(part); setOpen(false) }}>Select</Button></TableCell></TableRow>)}
      </TableBody></Table></div>
    </DialogContent>
  </Dialog>
}
