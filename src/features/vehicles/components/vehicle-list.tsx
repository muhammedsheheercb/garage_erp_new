"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getVehicles, deleteVehicle } from "../actions"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Plus, Edit, Trash, ChevronLeft, ChevronRight, CarFront, History, Eye } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { VehicleForm } from "./vehicle-form"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { useTranslation } from "@/i18n"

export function VehicleList() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<any>(null)
  const [viewingVehicle, setViewingVehicle] = useState<any>(null)
  const [viewingHistory, setViewingHistory] = useState<any>(null)
  const { t } = useTranslation()
  const fuelTypeLabels: Record<string, string> = {
    Petrol: t.vehicles.fuelPetrol,
    Diesel: t.vehicles.fuelDiesel,
    Electric: t.vehicles.fuelElectric,
    Hybrid: t.vehicles.fuelHybrid,
  }
  const jobStatusLabels: Record<string, string> = {
    PENDING: t.jobcards.statusPending,
    IN_PROGRESS: t.jobcards.statusInProgress,
    WORKING: t.jobcards.statusInProgress,
    COMPLETED: t.jobcards.statusCompleted,
    CANCELLED: t.jobcards.statusCancelled,
  }

  const { data, isLoading } = useQuery({
    queryKey: ['vehicles', page, search],
    queryFn: () => getVehicles(page, search)
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteVehicle(id),
    onSuccess: () => {
      toast.success(t.vehicles.vehicleDeleted)
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
    }
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-center">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder={t.vehicles.searchVehicles}
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
            <Button className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" /> {t.vehicles.addVehicle}</Button>
          } />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t.vehicles.addNewVehicle}</DialogTitle>
            </DialogHeader>
            <VehicleForm onSuccess={() => setIsAddOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-md overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.vehicles.plateNumber}</TableHead>
              <TableHead>{t.vehicles.make}</TableHead>
              <TableHead>{t.dashboard.customer}</TableHead>
              <TableHead className="text-right">{t.common.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center h-24">{t.common.loading}</TableCell></TableRow>
            ) : data?.data.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center h-24">{t.vehicles.noVehicles}</TableCell></TableRow>
            ) : (
              data?.data.map((vehicle) => (
                <TableRow key={vehicle.id}>
                  <TableCell className="font-medium whitespace-nowrap">
                    <Badge variant="outline" className="font-mono text-sm tracking-widest">{vehicle.plateNumber}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{vehicle.brand} {vehicle.model}</span>
                      <span className="text-xs text-muted-foreground">{vehicle.year} • {fuelTypeLabels[vehicle.fuelType ?? ""] || vehicle.fuelType}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm">{vehicle.customer.name}</span>
                      <span className="text-xs text-muted-foreground">{vehicle.customer.phone}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right space-x-1 whitespace-nowrap">
                    <Dialog open={viewingVehicle?.id === vehicle.id} onOpenChange={(open) => !open && setViewingVehicle(null)}>
                      <DialogTrigger render={
                        <Button variant="ghost" size="icon" onClick={() => setViewingVehicle(vehicle)} title={t.payments.view}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      } />
                      {viewingVehicle?.id === vehicle.id && (
                        <DialogContent>
                          <DialogHeader><DialogTitle>{t.vehicles.vehicleDetails}</DialogTitle></DialogHeader>
                          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                            <div><dt className="text-muted-foreground">{t.vehicles.plateNumber}</dt><dd className="font-medium mt-1">{viewingVehicle.plateNumber}</dd></div>
                            <div><dt className="text-muted-foreground">{t.vehicles.companyName}</dt><dd className="font-medium mt-1">{viewingVehicle.brand}</dd></div>
                            <div><dt className="text-muted-foreground">{t.vehicles.model}</dt><dd className="font-medium mt-1">{viewingVehicle.model}</dd></div>
                            <div><dt className="text-muted-foreground">{t.vehicles.year}</dt><dd className="font-medium mt-1">{viewingVehicle.year}</dd></div>
                            <div><dt className="text-muted-foreground">{t.vehicles.fuelType}</dt><dd className="font-medium mt-1">{fuelTypeLabels[viewingVehicle.fuelType] || viewingVehicle.fuelType}</dd></div>
                            <div><dt className="text-muted-foreground">{t.vehicles.owner}</dt><dd className="font-medium mt-1">{viewingVehicle.customer.name}</dd></div>
                          </dl>
                        </DialogContent>
                      )}
                    </Dialog>
                    
                    <Dialog open={viewingHistory?.id === vehicle.id} onOpenChange={(open) => !open && setViewingHistory(null)}>
                      <DialogTrigger render={
                        <Button variant="ghost" size="icon" onClick={() => setViewingHistory(vehicle)} title="Service History">
                          <History className="h-4 w-4" />
                        </Button>
                      } />
                      {viewingHistory?.id === vehicle.id && (
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Service History: {vehicle.plateNumber}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            {vehicle.jobCards.length > 0 ? (
                              <div className="space-y-3">
                                {vehicle.jobCards.map((job: any) => (
                                  <div key={job.id} className="flex justify-between items-center p-3 border rounded-md">
                                    <div>
                                      <p className="text-sm font-medium">Job Card</p>
                                      <p className="text-xs text-muted-foreground">
                                        {new Date(job.createdAt).toLocaleDateString()}
                                      </p>
                                    </div>
                                    <Badge variant={job.status === 'COMPLETED' ? 'default' : 'secondary'}>
                                      {jobStatusLabels[job.status] || job.status}
                                    </Badge>
                                  </div>
                                ))}
                                <p className="text-xs text-muted-foreground text-center mt-4">Showing up to 3 recent jobs.</p>
                              </div>
                            ) : (
                              <div className="text-center py-6 text-muted-foreground flex flex-col items-center">
                                <CarFront className="h-8 w-8 mb-2 opacity-20" />
                                <p>No service history found.</p>
                              </div>
                            )}
                          </div>
                        </DialogContent>
                      )}
                    </Dialog>

                    <Dialog open={editingVehicle?.id === vehicle.id} onOpenChange={(open) => !open && setEditingVehicle(null)}>
                      <DialogTrigger render={
                        <Button variant="ghost" size="icon" onClick={() => setEditingVehicle(vehicle)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      } />
                      {editingVehicle?.id === vehicle.id && (
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>{t.vehicles.editVehicle}</DialogTitle>
                          </DialogHeader>
                          <VehicleForm 
                            initialData={editingVehicle} 
                            onSuccess={() => setEditingVehicle(null)} 
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
                          <AlertDialogTitle>{t.vehicles.deleteVehicle}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t.vehicles.deleteConfirm}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(vehicle.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            {t.common.delete}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {data?.meta && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-end space-x-2 py-4">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft className="h-4 w-4 mr-1" /> {t.common.previous}
          </Button>
          <div className="text-sm text-muted-foreground">
            {t.common.page} {page} {t.common.of} {data.meta.totalPages}
          </div>
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(data.meta.totalPages, p + 1))} disabled={page === data.meta.totalPages}>
            {t.common.next} <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  )
}
