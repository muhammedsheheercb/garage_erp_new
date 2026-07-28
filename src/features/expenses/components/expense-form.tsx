"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExpenseFormValues, expenseSchema, expenseCategories } from "../schema";
import { createExpense, updateExpense } from "../actions";
import { getPaymetersDropdown } from "@/features/paymeters/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { useTranslation } from "@/i18n";

export function ExpenseForm({
  initialData,
  onSuccess,
}: {
  initialData?: any;
  onSuccess?: () => void;
}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const categoryKeyMap: Record<string, string> = {
    Rent: "categoryRent",
    Electricity: "categoryElectricity",
    Salary: "categorySalary",
    "Water Bill": "categoryWaterBill",
    "Other Expenses": "categoryOtherExpenses",
  };
  const translateCategory = (category: string) =>
    t.expensesMod[
      categoryKeyMap[category] as keyof typeof t.expensesMod
    ] || category;

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema) as any,
    defaultValues: initialData
      ? {
          ...initialData,
          date: format(new Date(initialData.date), "yyyy-MM-dd") as unknown as Date,
          paymentType: initialData.paymentMethod === "PAYMETER" ? "PAYMETER" : "DIRECT",
        }
      : {
          category: undefined,
          amount: 0,
          description: "",
          date: format(new Date(), "yyyy-MM-dd") as unknown as Date,
          paymentType: "DIRECT",
          paymentMethod: "CASH",
          paymeterId: null,
        },
  });

  const paymentType = watch("paymentType");

  const { data: paymeters = [] } = useQuery({
    queryKey: ["paymetersDropdown"],
    queryFn: () => getPaymetersDropdown()
  });

  const mutation = useMutation({
    mutationFn: (data: ExpenseFormValues) =>
      initialData ? updateExpense(initialData.id, data) : createExpense(data),
    onSuccess: () => {
      toast.success(
        initialData
          ? t.expensesMod.expenseUpdated
          : t.expensesMod.expenseCreated,
      );
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-expenses"] });
      onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error.message || t.common.somethingWrong);
    },
  });

  const onSubmit = (data: ExpenseFormValues) => {
    mutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="category">
            {t.expensesMod.expenseCategory}{" "}
            <span className="text-destructive">*</span>
          </Label>
          <Controller
            control={control}
            name="category"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value || ""}>
                <SelectTrigger>
                  <SelectValue placeholder={t.expensesMod.expenseCategory}>
                    {(value: string) => translateCategory(value)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {expenseCategories.map((cat) => {
                    return (
                      <SelectItem key={cat} value={cat}>
                        {translateCategory(cat)}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}
          />
          {errors.category && (
            <p className="text-sm text-destructive">
              {errors.category.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="amount">
            {t.expensesMod.amount} (OMR){" "}
            <span className="text-destructive">*</span>
          </Label>
          <Input
            id="amount"
            type="number"
            step="0.001"
            {...register("amount", { valueAsNumber: true })}
          />
          {errors.amount && (
            <p className="text-sm text-destructive">{errors.amount.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="date">
            {t.expensesMod.date} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="date"
            type="date"
            {...register("date")}
          />
          {errors.date && (
            <p className="text-sm text-destructive">{errors.date.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="paymentType">Payment Type</Label>
          <Controller
            control={control}
            name="paymentType"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value || "DIRECT"}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Payment Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DIRECT">Direct Payment</SelectItem>
                  <SelectItem value="PAYMETER">Paymeter</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>

        {paymentType === "DIRECT" ? (
          <div className="space-y-2">
            <Label htmlFor="paymentMethod">Payment Method</Label>
            <Controller
              control={control}
              name="paymentMethod"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value || "CASH"}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="CARD">Card</SelectItem>
                    <SelectItem value="TRANSFER">Bank Transfer</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="paymeterId">Select Paymeter</Label>
            <Controller
              control={control}
              name="paymeterId"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a paymeter">
                      {field.value 
                        ? paymeters.find((pm: any) => pm.id === field.value)?.name || "Select a paymeter"
                        : "Select a paymeter"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {paymeters.map((pm: any) => (
                      <SelectItem key={pm.id} value={pm.id}>
                        {pm.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">{t.expensesMod.expenseDescription}</Label>
        <Textarea
          id="description"
          placeholder="..."
          {...register("description")}
        />
        {errors.description && (
          <p className="text-sm text-destructive">
            {errors.description.message}
          </p>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={() => onSuccess?.()}>
          {t.common.cancel}
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? t.common.saving : t.expensesMod.saveExpense}
        </Button>
      </div>
    </form>
  );
}
