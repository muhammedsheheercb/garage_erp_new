"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getJobCards, deleteJobCard } from "../actions"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Plus, Edit, Trash, ChevronLeft, ChevronRight, Printer } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { JobCardForm } from "./jobcard-form"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Currency } from "@/components/currency"

export function JobCardList() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingJob, setEditingJob] = useState<any>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['jobcards', page, search],
    queryFn: () => getJobCards(page, search)
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteJobCard(id),
    onSuccess: () => {
      toast.success("Job Card deleted")
      queryClient.invalidateQueries({ queryKey: ['jobcards'] })
    }
  })

  const openPrint = (id: string) => {
    window.open(`/jobcards/${id}/print`, '_blank')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-center">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search complaint, plate, customer..." 
            className="pl-8" 
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger render={<Button className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" /> Create Job Card</Button>} />
          <DialogContent className="max-w-6xl sm:max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New Job Card</DialogTitle>
            </DialogHeader>
            <JobCardForm onSuccess={() => setIsAddOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-md overflow-hidden bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vehicle & Customer</TableHead>
              <TableHead>Complaint</TableHead>
              <TableHead>Status & Mechanic</TableHead>
              <TableHead>Est. Cost</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center h-24">Loading...</TableCell></TableRow>
            ) : data?.data.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center h-24">No job cards found.</TableCell></TableRow>
            ) : (
              data?.data.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="font-medium whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="font-bold font-mono tracking-widest">{job.vehicle.plateNumber}</span>
                      <span className="text-sm text-muted-foreground">{job.customer.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[200px] truncate" title={job.complaint}>
                      {job.complaint}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      <Badge variant={
                        job.status === 'COMPLETED' ? 'default' :
                        job.status === 'WORKING' || job.status === 'IN_PROGRESS' ? 'secondary' :
                        job.status === 'CANCELLED' ? 'destructive' :
                        'outline'
                      }>
                        {job.status === 'IN_PROGRESS' ? 'WORKING' : job.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {job.mechanic?.name || "Unassigned"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Currency amount={job.estimatedCost || 0} />
                  </TableCell>
                  <TableCell className="text-right space-x-1 whitespace-nowrap">
                    
                    <Button variant="ghost" size="icon" onClick={() => openPrint(job.id)} title="Print Job Card">
                      <Printer className="h-4 w-4" />
                    </Button>

                    <Dialog open={editingJob?.id === job.id} onOpenChange={(open) => !open && setEditingJob(null)}>
                      <DialogTrigger render={
                        <Button variant="ghost" size="icon" onClick={() => setEditingJob(job)} title="Edit Job">
                          <Edit className="h-4 w-4" />
                        </Button>
                      } />
                      {editingJob?.id === job.id && (
                        <DialogContent className="max-w-6xl sm:max-w-6xl w-full max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Edit Job Card</DialogTitle>
                          </DialogHeader>
                          <JobCardForm 
                            initialData={editingJob} 
                            onSuccess={() => setEditingJob(null)} 
                          />
                        </DialogContent>
                      )}
                    </Dialog>

                    <AlertDialog>
                      <AlertDialogTrigger render={
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" title="Delete Job">
                          <Trash className="h-4 w-4" />
                        </Button>
                      } />
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Job Card?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete this job card. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(job.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
