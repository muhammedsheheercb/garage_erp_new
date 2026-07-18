"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getMechanics, deleteMechanic } from "../actions"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Plus, Edit, Trash, ChevronLeft, ChevronRight, Briefcase } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { MechanicForm } from "./mechanic-form"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

export function MechanicList() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingMechanic, setEditingMechanic] = useState<any>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['mechanics', page, search],
    queryFn: () => getMechanics(page, search)
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteMechanic(id),
    onSuccess: () => {
      toast.success("Mechanic deleted")
      queryClient.invalidateQueries({ queryKey: ['mechanics'] })
    },
    onError: () => {
      toast.error("Cannot delete mechanic with assigned job cards.")
    }
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-center">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search mechanics..." 
            className="pl-8" 
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger render={<Button className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" /> Add Mechanic</Button>} />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Mechanic</DialogTitle>
            </DialogHeader>
            <MechanicForm onSuccess={() => setIsAddOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-md overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mechanic Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Active Jobs</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center h-24">Loading...</TableCell></TableRow>
            ) : data?.data.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center h-24">No mechanics found.</TableCell></TableRow>
            ) : (
              data?.data.map((mechanic) => (
                <TableRow key={mechanic.id}>
                  <TableCell className="font-medium whitespace-nowrap">
                    {mechanic.name}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm">{mechanic.phone || 'N/A'}</span>
                      <span className="text-xs text-muted-foreground">{mechanic.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant={mechanic.jobCards.length > 0 ? "default" : "secondary"}>
                        {mechanic.jobCards.length} Assigned
                      </Badge>
                      {mechanic.jobCards.length > 0 && (
                        <span className="text-xs text-muted-foreground truncate max-w-[150px] hidden md:inline-block">
                          (e.g., {mechanic.jobCards[0].vehicle.plateNumber})
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right space-x-1 whitespace-nowrap">
                    
                    <Dialog open={editingMechanic?.id === mechanic.id} onOpenChange={(open) => !open && setEditingMechanic(null)}>
                      <DialogTrigger render={
                        <Button variant="ghost" size="icon" onClick={() => setEditingMechanic(mechanic)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      } />
                      {editingMechanic?.id === mechanic.id && (
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Edit Mechanic</DialogTitle>
                          </DialogHeader>
                          <MechanicForm 
                            initialData={editingMechanic} 
                            onSuccess={() => setEditingMechanic(null)} 
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
                          <AlertDialogTitle>Delete Mechanic?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently remove {mechanic.name} from the system. If this mechanic is assigned to active jobs, you must unassign them first.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(mechanic.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Previous
          </Button>
          <div className="text-sm text-muted-foreground">
            Page {page} of {data.meta.totalPages}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(data.meta.totalPages, p + 1))}
            disabled={page === data.meta.totalPages}
          >
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  )
}
