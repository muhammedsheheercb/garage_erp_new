"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CustomerFormValues, customerSchema } from "../schema";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createCustomer, updateCustomer } from "../actions";
import { toast } from "sonner";
import { useTranslation } from "@/i18n";

import type { z } from "zod";

interface CustomerFormProps {
  initialData?: CustomerFormValues & { id?: string };
  onSuccess?: (customer?: any) => void;
}

export function CustomerForm({ initialData, onSuccess }: CustomerFormProps) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<z.input<typeof customerSchema>, unknown, CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: initialData?.name || "",
      email: initialData?.email || "",
      phone: initialData?.phone || "",
      address: initialData?.address || "",
      type: initialData?.type || "Individual",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: CustomerFormValues) => {
      if (initialData?.id) {
        return updateCustomer(initialData.id, data);
      }
      return createCustomer(data);
    },
    onSuccess: (data) => {
      toast.success(
        initialData?.id
          ? t.customers.customerUpdated
          : t.customers.customerCreated,
      );
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      onSuccess?.(data);
    },
    onError: (error: any) => {
      toast.error(error.message || t.common.somethingWrong);
    },
  });

  const onSubmit = (data: CustomerFormValues) => {
    mutation.mutate(data);
  };



  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">
          {t.common.name} <span className="text-destructive">*</span>
        </Label>
        <Input
          id="name"
          placeholder={t.customers.namePlaceholder}
          {...register("name")}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>



      <div className="space-y-2">
        <Label htmlFor="phone">
          {t.common.phone} <span className="text-destructive">*</span>
        </Label>
        <Input
          id="phone"
          placeholder={t.customers.phonePlaceholder}
          {...register("phone")}
        />
        {errors.phone && (
          <p className="text-sm text-destructive">{errors.phone.message}</p>
        )}
      </div>

      <div className="pt-4 flex justify-end">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? t.common.saving : t.customers.saveCustomer}
        </Button>
      </div>
    </form>
  );
}
