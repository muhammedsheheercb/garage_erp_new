"use client"

import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ExpenseFormValues, expenseSchema, expenseCategories } from "../schema"
import { createExpense, updateExpense } from "../actions"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { format } from "date-fns"

export function ExpenseForm({ initialData, onSuccess }: { initialData?: any, onSuccess?: () => void }) {
  const queryClient = useQueryClient()

  const { register, handleSubmit, control, formState: { errors } } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: initialData ? {
      ...initialData,
      date: new Date(initialData.date),
    } : {
      category: undefined,
      amount: 0,
      description: "",
      date: new Date()
    }
  })

  const mutation = useMutation({
    mutationFn: (data: ExpenseFormValues) => 
      initialData ? updateExpense(initialData.id, data) : createExpense(data),
    onSuccess: () => {
      toast.success(initialData ? "Expense updated successfully" : "Expense added successfully")
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['monthly-expenses'] })
      onSuccess?.()
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save expense")
    }
  })

  const onSubmit = (data: ExpenseFormValues) => {
    mutation.mutate(data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        <div className="space-y-2">
          <Label htmlFor="category">Category <span className="text-destructive">*</span></Label>
          <Controller
            control={control}
            name="category"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value || ""}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  {expenseCategories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.category && <p className="text-sm text-destructive">{errors.category.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="amount">Amount (OMR) <span className="text-destructive">*</span></Label>
          <Input 
            id="amount" 
            type="number" 
            step="0.001" 
            {...register("amount", { valueAsNumber: true })} 
          />
          {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="date">Date <span className="text-destructive">*</span></Label>
          <Input 
            id="date" 
            type="date"
            {...register("date", { valueAsDate: true })} 
            defaultValue={initialData ? format(new Date(initialData.date), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd")}
          />
          {errors.date && <p className="text-sm text-destructive">{errors.date.message}</p>}
        </div>

      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea 
          id="description" 
          placeholder="Expense details..." 
          {...register("description")} 
        />
        {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={() => onSuccess?.()}>Cancel</Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : "Save Expense"}
        </Button>
      </div>
    </form>
  )
}
