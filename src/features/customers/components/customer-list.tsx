"use client"

import { useState, useEffect, useCallback, memo, useMemo } from "react"
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query"
import { getCustomers, deleteCustomer } from "../actions"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Plus, Edit, Trash, ChevronLeft, ChevronRight } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import dynamic from "next/dynamic"

// Lazy Loading: The form is only loaded when a dialog is opened, reducing initial JS bundle size.
const CustomerForm = dynamic(() => import("./customer-form").then(mod => mod.CustomerForm), {
  loading: () => <div className="p-4 text-center text-sm text-muted-foreground animate-pulse">Loading form...</div>
})

// Custom hook for debouncing search input
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debouncedValue
}

// React.memo: Prevents re-rendering of table rows that haven't changed during search/pagination.
const CustomerRow = memo(({ 
  customer, 
  onEdit, 
  onDelete, 
  isEditing 
}: { 
  customer: any, 
  onEdit: (customer: any) => void, 
  onDelete: (id: string) => void,
  isEditing: boolean 
}) => (
  <TableRow>
    <TableCell className="font-medium">{customer.name}</TableCell>
    <TableCell>
      <div className="flex flex-col">
        <span className="text-sm">{customer.phone || 'N/A'}</span>
        <span className="text-xs text-muted-foreground">{customer.email}</span>
      </div>
    </TableCell>
    <TableCell className="max-w-[200px] truncate">{customer.address || 'N/A'}</TableCell>
    <TableCell className="text-right space-x-2">
      <Dialog open={isEditing} onOpenChange={(open) => !open && onEdit(null)}>
        <DialogTrigger render={
          <Button variant="ghost" size="icon" onClick={() => onEdit(customer)}>
            <Edit className="h-4 w-4" />
          </Button>
        } />
        {isEditing && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Customer</DialogTitle>
            </DialogHeader>
            <CustomerForm 
              initialData={customer} 
              onSuccess={() => onEdit(null)} 
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
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this customer and all their associated records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => onDelete(customer.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TableCell>
  </TableRow>
))
CustomerRow.displayName = "CustomerRow"

export function CustomerList() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<any>(null)

  // Debounce Search: Prevents hitting the API on every single keystroke.
  const debouncedSearch = useDebounce(search, 400)

  // TanStack Query caching: keepPreviousData prevents flickering UI while fetching the next page.
  const { data, isLoading } = useQuery({
    queryKey: ['customers', page, debouncedSearch],
    queryFn: () => getCustomers(page, debouncedSearch),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes to avoid redundant fetches
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCustomer(id),
    onSuccess: () => {
      toast.success("Customer deleted")
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    }
  })

  // useCallback: Memoizes event handlers to prevent child component re-renders.
  const handleDelete = useCallback((id: string) => {
    deleteMutation.mutate(id)
  }, [deleteMutation])

  const handleEdit = useCallback((customer: any) => {
    setEditingCustomer(customer)
  }, [])

  // useMemo: Memoizes the list rendering so it doesn't recalculate unless data or editing state changes.
  const renderedCustomers = useMemo(() => {
    if (!data?.data || data.data.length === 0) {
      return <TableRow><TableCell colSpan={4} className="text-center h-24">No customers found.</TableCell></TableRow>
    }
    return data.data.map((customer: any) => (
      <CustomerRow 
        key={customer.id} 
        customer={customer} 
        onEdit={handleEdit} 
        onDelete={handleDelete} 
        isEditing={editingCustomer?.id === customer.id}
      />
    ))
  }, [data?.data, handleEdit, handleDelete, editingCustomer?.id])

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-center">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search customers..." 
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
            <Button className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" /> Add Customer</Button>
          } />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Customer</DialogTitle>
            </DialogHeader>
            <CustomerForm onSuccess={() => setIsAddOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-md overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Address</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center h-24">Loading...</TableCell></TableRow>
            ) : renderedCustomers}
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
