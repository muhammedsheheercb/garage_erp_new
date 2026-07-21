"use client";

import { useForm, Controller, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { JobCardFormValues, jobCardSchema } from "../schema";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import {
  createJobCard,
  updateJobCard,
  getDropdownData,
  getVehicleHistory,
} from "../actions";
import { toast } from "sonner";
import { Trash, Plus, Eye, CarFront } from "lucide-react";
import { useEffect, useState } from "react";
import { ServiceSelectionModal } from "./service-selection-modal";
import { PartSelectionModal } from "./part-selection-modal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CustomerForm } from "@/features/customers/components/customer-form";
import { VehicleForm } from "@/features/vehicles/components/vehicle-form";
import { useTranslation } from "@/i18n";
import { Badge } from "@/components/ui/badge";

interface JobCardFormProps {
  initialData?: any; // JobCard with relations
  onSuccess?: () => void;
}

export function JobCardForm({ initialData, onSuccess }: JobCardFormProps) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [isNewCustomerOpen, setIsNewCustomerOpen] = useState(false);
  const [isNewVehicleOpen, setIsNewVehicleOpen] = useState(false);
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [isVehicleHistoryOpen, setIsVehicleHistoryOpen] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<JobCardFormValues>({
    resolver: zodResolver(jobCardSchema),
    defaultValues: {
      id: initialData?.id || undefined,
      customerId: initialData?.customerId || "",
      vehicleId: initialData?.vehicleId || "",
      mechanicId: initialData?.mechanicId || "",
      status:
        initialData?.status === "WORKING"
          ? "IN_PROGRESS"
          : initialData?.status || "PENDING",
      complaint: initialData?.complaint || "",
      workDone: initialData?.workDone || "",
      notes: initialData?.notes || "",

      services:
        initialData?.services?.map((s: any) => ({
          serviceId: s.serviceId,
          name: s.service?.name || t.common.unknown,
          quantity: s.quantity,
          price: s.price,
        })) || [],

      parts:
        initialData?.parts?.map((p: any) => ({
          batchId: p.batchId,
          name: p.batch?.inventory?.itemName || t.common.unknown,
          quantity: p.quantity,
          price: p.price,
          maxStock: Math.max(p.batch?.quantity || 0, p.quantity),
        })) || [],

      serviceTotal: initialData?.serviceTotal || 0,
      partsTotal: initialData?.partsTotal || 0,
      discount: initialData?.discount || 0,
      tax: initialData?.tax || 0,
      grandTotal: initialData?.grandTotal || 0,
    },
  });

  const {
    fields: serviceFields,
    append: appendService,
    remove: removeService,
  } = useFieldArray({
    control,
    name: "services",
  });

  const {
    fields: partFields,
    append: appendPart,
    remove: removePart,
  } = useFieldArray({
    control,
    name: "parts",
  });

  // Watch for totals calculation
  const watchedServices = watch("services");
  const watchedParts = watch("parts");
  const watchedDiscount = watch("discount");
  const watchedTax = watch("tax");

  useEffect(() => {
    const sTotal = watchedServices.reduce(
      (acc, curr) => acc + (curr.quantity || 0) * (curr.price || 0),
      0,
    );
    const pTotal = watchedParts.reduce(
      (acc, curr) => acc + (curr.quantity || 0) * (curr.price || 0),
      0,
    );

    setValue("serviceTotal", sTotal);
    setValue("partsTotal", pTotal);

    const subTotal = sTotal + pTotal;
    const taxAmt = (subTotal * (watchedTax || 0)) / 100;
    const gTotal = subTotal + taxAmt - (watchedDiscount || 0);

    setValue("grandTotal", gTotal > 0 ? gTotal : 0);
  }, [watchedServices, watchedParts, watchedDiscount, watchedTax, setValue]);

  const {
    data: dropdowns = { customers: [], vehicles: [], mechanics: [] },
    isLoading,
  } = useQuery({
    queryKey: ["jobcards-dropdowns"],
    queryFn: getDropdownData,
  });

  const mutation = useMutation({
    mutationFn: async (data: JobCardFormValues) => {
      if (initialData?.id) {
        return updateJobCard(initialData.id, data);
      }
      return createJobCard(data);
    },
    onSuccess: () => {
      toast.success(
        initialData?.id ? t.jobcards.jobCardUpdated : t.jobcards.jobCardCreated,
      );
      queryClient.invalidateQueries({ queryKey: ["jobcards"] });
      queryClient.invalidateQueries({ queryKey: ["mechanics"] });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      onSuccess?.();
    },
    onError: () => {
      toast.error(t.common.somethingWrong);
    },
  });

  const onSubmit = (data: JobCardFormValues) => {
    mutation.mutate(data);
  };

  const selectedCustomerId = watch("customerId");
  const selectedVehicleId = watch("vehicleId");
  const selectedVehicle = dropdowns.vehicles.find(
    (vehicle: any) => vehicle.id === selectedVehicleId,
  );
  const matchingVehicles = vehicleSearch.trim()
    ? dropdowns.vehicles.filter((vehicle: any) =>
        vehicle.plateNumber
          .toLowerCase()
          .includes(vehicleSearch.trim().toLowerCase()),
      )
    : [];

  useEffect(() => {
    if (selectedVehicle) {
      setVehicleSearch(selectedVehicle.plateNumber);
    }
  }, [selectedVehicle]);

  const { data: vehicleHistory = [], isLoading: isVehicleHistoryLoading } =
    useQuery({
      queryKey: ["vehicle-history", selectedVehicleId, initialData?.id],
      queryFn: () => getVehicleHistory(selectedVehicleId, initialData?.id),
      enabled: isVehicleHistoryOpen && Boolean(selectedVehicleId),
    });

  const getTranslatedStatus = (status: string) => {
    const statusKeyMap: Record<string, keyof typeof t.jobcards> = {
      PENDING: "statusPending",
      IN_PROGRESS: "statusInProgress",
      WORKING: "statusInProgress",
      COMPLETED: "statusCompleted",
      CANCELLED: "statusCancelled",
    };
    return statusKeyMap[status] ? t.jobcards[statusKeyMap[status]] : status;
  };

  const serviceTotal = watch("serviceTotal");
  const partsTotal = watch("partsTotal");
  const grandTotal = watch("grandTotal");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN: Main Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="customerId">
                  {t.jobcards.customer}{" "}
                  <span className="text-destructive">*</span>
                </Label>
                {!initialData && (
                  <Dialog
                    open={isNewCustomerOpen}
                    onOpenChange={setIsNewCustomerOpen}
                  >
                    <DialogTrigger
                      render={
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1"
                        >
                          <Plus className="h-3.5 w-3.5" />{" "}
                          {t.jobcards.newCustomer}
                        </Button>
                      }
                    />
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>{t.customers.addNewCustomer}</DialogTitle>
                      </DialogHeader>
                      <CustomerForm
                        onSuccess={(newCust) => {
                          setIsNewCustomerOpen(false);
                          queryClient
                            .invalidateQueries({
                              queryKey: ["jobcards-dropdowns"],
                            })
                            .then(() => {
                              if (newCust && newCust.id) {
                                setValue("customerId", newCust.id);
                                setValue("vehicleId", "");
                              }
                            });
                        }}
                      />
                    </DialogContent>
                  </Dialog>
                )}
              </div>
              <Controller
                control={control}
                name="customerId"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(val) => {
                      field.onChange(val);
                      setValue("vehicleId", "");
                      setVehicleSearch("");
                    }}
                    disabled={isLoading}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t.jobcards.selectCustomer}>
                        {(val: string) =>
                          dropdowns.customers.find((c: any) => c.id === val)
                            ?.name || null
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {dropdowns.customers.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.customerId && (
                <p className="text-sm text-destructive">
                  {errors.customerId.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="vehicleId">
                  {t.jobcards.vehicle}{" "}
                  <span className="text-destructive">*</span>
                </Label>
                {!initialData && (
                  <Dialog
                    open={isNewVehicleOpen}
                    onOpenChange={setIsNewVehicleOpen}
                  >
                    <DialogTrigger
                      render={
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          disabled={!selectedCustomerId}
                        >
                          <Plus className="h-3.5 w-3.5" />{" "}
                          {t.jobcards.newVehicle}
                        </Button>
                      }
                    />
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>{t.vehicles.addNewVehicle}</DialogTitle>
                      </DialogHeader>
                      <VehicleForm
                        initialData={{
                          customerId: selectedCustomerId,
                          plateNumber: "",
                          brand: "",
                          model: "",
                          fuelType: "Petrol",
                          year: new Date().getFullYear(),
                        }}
                        onSuccess={(newVeh) => {
                          setIsNewVehicleOpen(false);
                          queryClient
                            .invalidateQueries({
                              queryKey: ["jobcards-dropdowns"],
                            })
                            .then(() => {
                              if (newVeh && newVeh.id) {
                                setValue("vehicleId", newVeh.id);
                              }
                            });
                        }}
                      />
                    </DialogContent>
                  </Dialog>
                )}
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="vehicleId"
                    value={vehicleSearch}
                    onChange={(event) => {
                      setVehicleSearch(event.target.value);
                      setValue("vehicleId", "");
                    }}
                    placeholder={t.jobcards.searchVehiclesByPlate}
                    disabled={isLoading}
                    autoComplete="off"
                  />
                  {matchingVehicles.length > 0 && !selectedVehicleId && (
                    <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
                      {matchingVehicles.map((vehicle: any) => (
                        <button
                          key={vehicle.id}
                          type="button"
                          className="flex w-full flex-col rounded-sm px-3 py-2 text-left text-sm outline-none hover:bg-accent focus:bg-accent"
                          onClick={() => {
                            setValue("vehicleId", vehicle.id, {
                              shouldValidate: true,
                            });
                            setValue("customerId", vehicle.customerId, {
                              shouldValidate: true,
                            });
                            setVehicleSearch(vehicle.plateNumber);
                          }}
                        >
                          <span className="font-mono font-medium">
                            {vehicle.plateNumber}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {vehicle.brand} {vehicle.model} · {vehicle.customer.name}
                            {vehicle.customer.phone ? ` · ${vehicle.customer.phone}` : ""}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={!selectedVehicle}
                  onClick={() => setIsVehicleHistoryOpen(true)}
                  title={t.jobcards.viewServiceHistory}
                  aria-label={t.jobcards.viewServiceHistory}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
              {errors.vehicleId && (
                <p className="text-sm text-destructive">
                  {errors.vehicleId.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="mechanicId">
                {t.jobcards.assignMechanic}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={control}
                name="mechanicId"
                render={({ field }) => (
                  <Select
                    value={field.value || ""}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t.jobcards.selectMechanic}>
                        {(val: string) =>
                          dropdowns.mechanics.find((m: any) => m.id === val)
                            ?.name || null
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {dropdowns.mechanics.map((m: any) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.mechanicId && (
                <p className="text-sm text-destructive">
                  {errors.mechanicId.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">
                {t.common.status} <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={!initialData}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t.jobcards.selectStatus}>
                        {(value: string) => getTranslatedStatus(value)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PENDING">
                        {t.jobcards.statusPending}
                      </SelectItem>
                      {initialData ? (
                        <>
                          <SelectItem value="IN_PROGRESS">
                            {t.jobcards.statusInProgress}
                          </SelectItem>
                          <SelectItem value="COMPLETED">
                            {t.jobcards.statusCompleted}
                          </SelectItem>
                          <SelectItem value="CANCELLED">
                            {t.jobcards.statusCancelled}
                          </SelectItem>
                        </>
                      ) : null}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="complaint">
              {t.jobcards.complaintIssue}{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="complaint"
              rows={3}
              placeholder={t.jobcards.complaintPlaceholder}
              {...register("complaint")}
            />
            {errors.complaint && (
              <p className="text-sm text-destructive">
                {errors.complaint.message}
              </p>
            )}
          </div>

          {/* SERVICES SECTION */}
          <div className="space-y-4 border rounded-md p-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-lg">{t.jobcards.services}</h3>
              <ServiceSelectionModal
                onSelect={(service) => {
                  if (
                    !watchedServices.find((s) => s.serviceId === service.id)
                  ) {
                    appendService({
                      serviceId: service.id,
                      name: service.name,
                      quantity: 1,
                      price: service.price,
                    });
                  } else {
                    toast.error(t.jobcards.serviceAlreadyAdded);
                  }
                }}
              />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.services.serviceName}</TableHead>
                  <TableHead className="w-24">{t.invoicesMod.qty}</TableHead>
                  <TableHead className="w-32">{t.invoicesMod.price}</TableHead>
                  <TableHead className="w-32 text-right">
                    {t.invoicesMod.amount}
                  </TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {serviceFields.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-muted-foreground"
                    >
                      {t.jobcards.noServicesAdded}
                    </TableCell>
                  </TableRow>
                ) : (
                  serviceFields.map((field, index) => {
                    const qty = watchedServices[index]?.quantity || 0;
                    const price = watchedServices[index]?.price || 0;
                    return (
                      <TableRow key={field.id}>
                        <TableCell>{field.name}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="1"
                            {...register(`services.${index}.quantity`, {
                              valueAsNumber: true,
                            })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.001"
                            min="0"
                            {...register(`services.${index}.price`, {
                              valueAsNumber: true,
                            })}
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {(qty * price).toFixed(3)}
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => removeService(index)}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* PARTS SECTION */}
          <div className="space-y-4 border rounded-md p-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-lg">{t.jobcards.parts}</h3>
              <PartSelectionModal
                onSelect={(batch) => {
                  if (!watchedParts.find((p) => p.batchId === batch.id)) {
                    appendPart({
                      batchId: batch.id,
                      name: `${batch.inventory.itemName} (${batch.inventory.partNumber})`,
                      quantity: 1,
                      price: batch.sellingPrice,
                      maxStock: batch.quantity,
                    });
                  } else {
                    toast.error(t.jobcards.partAlreadyAdded);
                  }
                }}
              />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.inventoryMod.item}</TableHead>
                  <TableHead className="w-24">{t.invoicesMod.qty}</TableHead>
                  <TableHead className="w-32">{t.invoicesMod.price}</TableHead>
                  <TableHead className="w-32 text-right">
                    {t.invoicesMod.amount}
                  </TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partFields.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-muted-foreground"
                    >
                      {t.jobcards.noPartsAdded}
                    </TableCell>
                  </TableRow>
                ) : (
                  partFields.map((field, index) => {
                    const qty = watchedParts[index]?.quantity || 0;
                    const price = watchedParts[index]?.price || 0;
                    const maxStock = field.maxStock;
                    return (
                      <TableRow key={field.id}>
                        <TableCell>
                          {field.name}{" "}
                          <span className="text-xs text-muted-foreground block">
                            {t.inventoryMod.stock}: {maxStock}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="1"
                            max={maxStock}
                            {...register(`parts.${index}.quantity`, {
                              valueAsNumber: true,
                              max: {
                                value: maxStock,
                                message: `${t.jobcards.maxStockIs} ${maxStock}`,
                              },
                            })}
                          />
                          {errors.parts?.[index]?.quantity && (
                            <span className="text-xs text-destructive">
                              {errors.parts[index]?.quantity?.message}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.001"
                            min="0"
                            {...register(`parts.${index}.price`, {
                              valueAsNumber: true,
                            })}
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {(qty * price).toFixed(3)}
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => removePart(index)}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">{t.jobcards.notesRemarks}</Label>
            <Textarea
              id="notes"
              rows={2}
              placeholder={t.jobcards.notesPlaceholder}
              {...register("notes")}
            />
          </div>
        </div>

        {/* RIGHT COLUMN: Summary */}
        <div className="space-y-6">
          <div className="bg-muted p-6 rounded-lg space-y-4 sticky top-6">
            <h3 className="font-bold text-xl mb-4">{t.invoicesMod.summary}</h3>

            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">
                {t.jobcards.serviceTotal}:
              </span>
              <span>{serviceTotal.toFixed(3)} OMR</span>
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">
                {t.jobcards.partsTotal}:
              </span>
              <span>{partsTotal.toFixed(3)} OMR</span>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <div className="flex justify-between items-center">
                <Label htmlFor="discount">{t.jobcards.discountAmount}</Label>
                <Input
                  id="discount"
                  type="number"
                  step="0.001"
                  className="w-24 h-8 text-right"
                  {...register("discount", { valueAsNumber: true })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="tax">{t.jobcards.taxPercent}</Label>
                <Input
                  id="tax"
                  type="number"
                  step="0.1"
                  className="w-24 h-8 text-right"
                  {...register("tax", { valueAsNumber: true })}
                />
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t font-bold text-lg">
              <span>{t.invoicesMod.grandTotal}:</span>
              <span>{grandTotal.toFixed(3)} OMR</span>
            </div>

            <Button
              type="submit"
              className="w-full mt-4 font-bold text-base"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? t.common.saving : t.jobcards.saveJobCard}
            </Button>
          </div>
        </div>
      </div>

      <Dialog
        open={isVehicleHistoryOpen}
        onOpenChange={setIsVehicleHistoryOpen}
      >
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t.jobcards.serviceHistory}
              {selectedVehicle ? `: ${selectedVehicle.plateNumber}` : ""}
            </DialogTitle>
          </DialogHeader>
          {isVehicleHistoryLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t.common.loading}
            </p>
          ) : vehicleHistory.length > 0 ? (
            <div className="space-y-3">
              {vehicleHistory.map((job: any) => (
                <div key={job.id} className="rounded-md border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">
                        {new Date(job.createdAt).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {job.mechanic?.name || t.jobcards.unassigned}
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {getTranslatedStatus(job.status)}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm">{job.complaint}</p>
                  {job.workDone && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {job.workDone}
                    </p>
                  )}
                  {job.services.length > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t.jobcards.services}:{" "}
                      {job.services
                        .map((service: any) => service.service.name)
                        .join(", ")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center py-8 text-center text-muted-foreground">
              <CarFront className="mb-2 h-8 w-8 opacity-30" />
              <p>{t.jobcards.noServiceHistory}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </form>
  );
}
