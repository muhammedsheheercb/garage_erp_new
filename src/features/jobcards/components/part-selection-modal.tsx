"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { getInventoryList } from "../actions"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Plus } from "lucide-react"
import { useTranslation } from "@/i18n"

interface PartSelectionModalProps {
  onSelect: (part: any) => void
}

export function PartSelectionModal({ onSelect }: PartSelectionModalProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const { t } = useTranslation()

  const { data: parts, isLoading } = useQuery({
    queryKey: ['parts-list', search],
    queryFn: () => getInventoryList(search)
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button variant="outline" size="sm" type="button">
          <Plus className="h-4 w-4 mr-2" /> {t.jobcards.addPart}
        </Button>
      } />
      <DialogContent className="max-w-3xl sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t.jobcards.selectPart}</DialogTitle>
        </DialogHeader>
        
        <div className="relative mb-4">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder={t.jobcards.searchParts}
            className="pl-8" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="border rounded-md max-h-80 overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead>{t.purchases.partName}</TableHead>
                <TableHead>{t.inventoryMod.partNo}</TableHead>
                <TableHead>{t.inventoryMod.stock}</TableHead>
                <TableHead className="text-right">{t.invoicesMod.price}</TableHead>
                <TableHead className="w-[100px] text-right">{t.common.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center">{t.common.loading}</TableCell></TableRow>
              ) : parts?.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center">{t.jobcards.noPartsFound}</TableCell></TableRow>
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
                        {part.quantity <= 0 ? t.jobcards.outOfStock : t.jobcards.select}
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
