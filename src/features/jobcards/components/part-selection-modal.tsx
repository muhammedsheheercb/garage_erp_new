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
  jobCardId?: string
}

export function PartSelectionModal({ onSelect, jobCardId }: PartSelectionModalProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const { t } = useTranslation()

  const { data: parts, isLoading } = useQuery({
    queryKey: ['parts-list', search, jobCardId],
    queryFn: () => getInventoryList(search, jobCardId)
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button variant="outline" size="sm" type="button">
          <Plus className="h-4 w-4 mr-2" /> {t.jobcards.addPart}
        </Button>
      } />
      <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-5xl overflow-x-hidden overflow-y-auto p-3 sm:w-[calc(100vw-2rem)] sm:max-w-5xl sm:p-6">
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

        <div className="border rounded-md max-h-80 overflow-x-auto overflow-y-auto">
          <Table className="min-w-[820px]">
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead>{t.purchases.partName}</TableHead>
                <TableHead>{t.inventoryMod.partNo}</TableHead>
                <TableHead className="text-center">{t.inventoryMod.stock}</TableHead>
                <TableHead className="text-right">{t.inventoryMod.pur}</TableHead>
                <TableHead className="text-right">{t.inventoryMod.sel}</TableHead>
                <TableHead className="w-[100px] text-right">{t.common.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center">{t.common.loading}</TableCell></TableRow>
              ) : parts?.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center">{t.jobcards.noPartsFound}</TableCell></TableRow>
              ) : (
                parts?.map((part: any) => (
                  <TableRow key={part.id}>
                    <TableCell className="font-medium">{part.inventory.itemName}</TableCell>
                    <TableCell>{part.inventory.partNumber}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col">
                        <span>{part.availableQuantity}</span>
                        {part.reservedQuantity > 0 && (
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            ({part.quantity} total, {part.reservedQuantity} used)
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{part.purchasePrice} OMR</TableCell>
                    <TableCell className="text-right">{part.sellingPrice} OMR</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" type="button" variant={part.availableQuantity <= 0 ? "secondary" : "default"} onClick={() => {
                        onSelect({ ...part, isPending: part.availableQuantity <= 0 })
                        setOpen(false)
                      }}>
                        {part.availableQuantity <= 0 ? "Add as pending" : t.jobcards.select}
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
