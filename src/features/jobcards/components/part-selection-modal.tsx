"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { getInventoryList } from "../actions"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Plus } from "lucide-react"

interface PartSelectionModalProps {
  onSelect: (part: any) => void
}

export function PartSelectionModal({ onSelect }: PartSelectionModalProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")

  const { data: parts, isLoading } = useQuery({
    queryKey: ['parts-list', search],
    queryFn: () => getInventoryList(search)
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button variant="outline" size="sm" type="button">
          <Plus className="h-4 w-4 mr-2" /> Add Part
        </Button>
      } />
      <DialogContent className="max-w-3xl sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Select Part</DialogTitle>
        </DialogHeader>
        
        <div className="relative mb-4">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search parts..." 
            className="pl-8" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="border rounded-md max-h-80 overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead>Part Name</TableHead>
                <TableHead>Part No.</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="w-[100px] text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center">Loading...</TableCell></TableRow>
              ) : parts?.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center">No parts found.</TableCell></TableRow>
              ) : (
                parts?.map((part: any) => (
                  <TableRow key={part.id}>
                    <TableCell className="font-medium">{part.inventory.itemName}</TableCell>
                    <TableCell>{part.inventory.partNumber}</TableCell>
                    <TableCell>{part.quantity}</TableCell>
                    <TableCell className="text-right">{part.sellingPrice.toFixed(3)} OMR</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" type="button" disabled={part.quantity <= 0} onClick={() => {
                        onSelect(part)
                        setOpen(false)
                      }}>
                        {part.quantity <= 0 ? 'Out of Stock' : 'Select'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  )
}
