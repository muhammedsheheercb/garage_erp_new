"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getInventory, deleteInventoryItem } from "../actions"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Plus, Edit, Trash, ChevronLeft, ChevronRight } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { InventoryForm } from "./inventory-form"
import { toast } from "sonner"
import { useTranslation } from "@/i18n"

export function InventoryList() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const { t } = useTranslation()

  const { data, isLoading } = useQuery({
    queryKey: ['inventory', page, search],
    queryFn: () => getInventory(page, search)
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteInventoryItem(id),
    onSuccess: () => {
      toast.success(t.inventoryMod.itemDeleted)
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
    }
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-center">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder={t.inventoryMod.searchItems} 
            className="pl-8" 
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger render={
            <Button className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" /> {t.inventoryMod.addItem}</Button>
          } />
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t.inventoryMod.addNewItem}</DialogTitle>
            </DialogHeader>
            <InventoryForm onSuccess={() => setIsAddOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-md overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.inventoryMod.item}</TableHead>
              <TableHead>{t.inventoryMod.partNo}</TableHead>
              <TableHead>{t.inventoryMod.stock}</TableHead>
              <TableHead>{t.inventoryMod.prices}</TableHead>
              <TableHead className="text-right">{t.common.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center h-24">{t.common.loading}</TableCell></TableRow>
            ) : data?.data.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center h-24">{t.inventoryMod.noItems}</TableCell></TableRow>
            ) : (
              data?.data.map((item) => {
                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.itemName}
                    </TableCell>
                    <TableCell>{item.partNumber || '-'}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold">{item.quantity} {t.inventoryMod.total}</span>
                        {item.batches && item.batches.length > 0 && (
                          <div className="text-xs text-muted-foreground flex flex-col gap-0.5 mt-1 border-t pt-1 border-border/50 max-w-[120px]">
                            {item.batches.map((b: any) => (
                              <div key={b.id} className="flex justify-between w-full">
                                <span>{b.batchNumber}:</span>
                                <span>{b.quantity}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs">
                        <span className="text-muted-foreground">{t.inventoryMod.pur}: </span>{item.purchasePrice.toFixed(3)}<br/>
                        <span className="text-muted-foreground">{t.inventoryMod.sel}: </span>{item.sellingPrice.toFixed(3)}
                      </div>
                    </TableCell>

                    <TableCell className="text-right space-x-2">
                      
                      <Dialog open={editingItem?.id === item.id} onOpenChange={(open) => !open && setEditingItem(null)}>
                        <DialogTrigger render={
                          <Button variant="ghost" size="icon" onClick={() => setEditingItem(item)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        } />
                        {editingItem?.id === item.id && (
                          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>{t.inventoryMod.editItem}</DialogTitle>
                            </DialogHeader>
                            <InventoryForm 
                              initialData={editingItem} 
                              onSuccess={() => setEditingItem(null)} 
                            />
                          </DialogContent>
                        )}
                      </Dialog>

                      <AlertDialog>
                        <AlertDialogTrigger render={
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                            <Trash className="h-4 w-4" />
                          </Button>
                        } />
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t.inventoryMod.deleteItemTitle}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t.inventoryMod.deleteItemConfirm}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate(item.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              {t.common.delete}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>

                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {data?.meta && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-end space-x-2 py-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> {t.common.previous}
          </Button>
          <div className="text-sm text-muted-foreground">
            {t.common.page} {page} {t.common.of} {data.meta.totalPages}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(data.meta.totalPages, p + 1))}
            disabled={page === data.meta.totalPages}
          >
            {t.common.next} <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  )
}
