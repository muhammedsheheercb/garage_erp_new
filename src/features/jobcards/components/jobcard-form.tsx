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
import { Trash, Plus, Eye, CarFront, Check, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
import { formatDisplayDate } from "@/lib/date-format";
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
  const [isVehiclePickerOpen, setIsVehiclePickerOpen] = useState(false);
  const [vehiclePickerPosition, setVehiclePickerPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [isCustomerPickerOpen, setIsCustomerPickerOpen] = useState(false);
  const [customerPickerPosition, setCustomerPickerPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const [mechanicSearch, setMechanicSearch] = useState("");
  const [isMechanicPickerOpen, setIsMechanicPickerOpen] = useState(false);
  const [mechanicPickerPosition, setMechanicPickerPosition] = useState<{ top: number; left: number; width: number } | null>(null);
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
      expectedFinishDate: initialData?.expectedFinishDate ? new Date(initialData.expectedFinishDate).toISOString().slice(0, 10) : "",

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
  const watchedServices = watch("services") || [];
  const watchedParts = watch("parts") || [];
  const watchedDiscount = watch("discount") || 0;
  const watchedTax = watch("tax") || 0;

  const servicesJson = JSON.stringify(watchedServices);
  const partsJson = JSON.stringify(watchedParts);

  useEffect(() => {
    const sTotal = (watchedServices || []).reduce(
      (acc, curr) => acc + (Number(curr?.quantity) || 0) * (Number(curr?.price) || 0),
      0,
    );
    const pTotal = (watchedParts || []).reduce(
      (acc, curr) => acc + (Number(curr?.quantity) || 0) * (Number(curr?.price) || 0),
      0,
    );

    setValue("serviceTotal", sTotal);
    setValue("partsTotal", pTotal);

    const subTotal = sTotal + pTotal;
    const taxAmt = (subTotal * watchedTax) / 100;
    const gTotal = subTotal + taxAmt - watchedDiscount;

    setValue("grandTotal", gTotal > 0 ? gTotal : 0);
  }, [servicesJson, partsJson, watchedDiscount, watchedTax, setValue]);

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
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-dropdowns"] });
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
  const selectedCustomer = dropdowns.customers.find(
    (customer: any) => customer.id === selectedCustomerId,
  );
  const selectedVehicleId = watch("vehicleId");
  const selectedVehicle = dropdowns.vehicles.find(
    (vehicle: any) => vehicle.id === selectedVehicleId,
  );
  const matchingVehicles = dropdowns.vehicles.filter((vehicle: any) => {
    if (selectedCustomerId && vehicle.customerId !== selectedCustomerId) return false;
    const query = vehicleSearch.trim().toLowerCase();
    return !query || vehicle.plateNumber.toLowerCase().includes(query) ||
      vehicle.brand.toLowerCase().includes(query) ||
      vehicle.model.toLowerCase().includes(query);
  });
  const matchingCustomers = dropdowns.customers.filter((customer: any) => {
    const query = customerSearch.trim().toLowerCase();
    return !query || customer.name.toLowerCase().includes(query) || customer.phone?.toLowerCase().includes(query);
  });

  const updateVehiclePickerPosition = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    setVehiclePickerPosition({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 280) });
  };

  const updateCustomerPickerPosition = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    setCustomerPickerPosition({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 280) });
  };

  const updateMechanicPickerPosition = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    setMechanicPickerPosition({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 280) });
  };

  useEffect(() => {
    if (selectedVehicle) {
      setVehicleSearch(selectedVehicle.plateNumber);
    }
  }, [selectedVehicle]);

  useEffect(() => {
    if (selectedCustomer) {
      setCustomerSearch(selectedCustomer.name);
    }
  }, [selectedCustomer]);

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
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 z-10 h-4 w-4 text-muted-foreground" />
                <Input
                  id="customerId"
                  value={isCustomerPickerOpen ? customerSearch : (selectedCustomer?.name || "")}
                  placeholder={t.jobcards.selectCustomer}
                  className="pl-9 pr-9"
                  autoComplete="off"
                  disabled={isLoading}
                  onFocus={(event) => {
                    setCustomerSearch("");
                    setIsCustomerPickerOpen(true);
                    updateCustomerPickerPosition(event.currentTarget);
                  }}
                  onBlur={() => window.setTimeout(() => {
                    setIsCustomerPickerOpen(false);
                    setCustomerPickerPosition(null);
                  }, 150)}
                  onChange={(event) => {
                    setCustomerSearch(event.target.value);
                    setValue("customerId", "");
                    setValue("vehicleId", "");
                    setVehicleSearch("");
                    setIsCustomerPickerOpen(true);
                    updateCustomerPickerPosition(event.currentTarget);
                  }}
                />
                {(selectedCustomer || customerSearch) && (
                  <button
                    type="button"
                    aria-label="Clear customer selection"
                    className="absolute right-2 top-1.5 z-10 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={(event) => {
                      const input = event.currentTarget.parentElement?.querySelector("input") as HTMLInputElement | null;
                      setCustomerSearch("");
                      setValue("customerId", "");
                      setValue("vehicleId", "");
                      setVehicleSearch("");
                      setIsCustomerPickerOpen(true);
                      if (input) updateCustomerPickerPosition(input);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                {isCustomerPickerOpen && customerPickerPosition && typeof document !== "undefined" && createPortal(
                  <div
                    className="fixed z-[100] max-h-60 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-lg"
                    style={{ top: customerPickerPosition.top, left: customerPickerPosition.left, width: customerPickerPosition.width }}
                  >
                    {matchingCustomers.length > 0 ? matchingCustomers.map((customer: any) => (
                      <button
                        key={customer.id}
                        type="button"
                        className="flex w-full items-center justify-between rounded-sm px-3 py-2 text-left text-sm hover:bg-accent focus:bg-accent"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setValue("customerId", customer.id, { shouldValidate: true });
                          setValue("vehicleId", "");
                          setVehicleSearch("");
                          setCustomerSearch(customer.name);
                          setIsCustomerPickerOpen(false);
                          setCustomerPickerPosition(null);
                        }}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{customer.name}</span>
                          {customer.phone && <span className="block text-xs text-muted-foreground">{customer.phone}</span>}
                        </span>
                        {selectedCustomerId === customer.id && <Check className="ml-3 h-4 w-4 shrink-0 text-primary" />}
                      </button>
                    )) : (
                      <p className="px-3 py-4 text-center text-sm text-muted-foreground">No matching customers found.</p>
                    )}
                  </div>,
                  document.body
                )}
              </div>
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
                                setValue("vehicleId", newVeh.id, {
                                  shouldValidate: true,
                                  shouldDirty: true,
                                });
                                setVehicleSearch(newVeh.plateNumber);
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
                  <Search className="pointer-events-none absolute left-3 top-2.5 z-10 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="vehicleId"
                    value={vehicleSearch}
                    onFocus={(event) => {
                      setVehicleSearch("");
                      setIsVehiclePickerOpen(true);
                      updateVehiclePickerPosition(event.currentTarget);
                    }}
                    onBlur={() => window.setTimeout(() => {
                      setIsVehiclePickerOpen(false);
                      setVehiclePickerPosition(null);
                    }, 150)}
                    onChange={(event) => {
                      const value = event.target.value;
                      setVehicleSearch(value);
                      setValue("vehicleId", "");
                      setIsVehiclePickerOpen(true);
                      updateVehiclePickerPosition(event.currentTarget);
                    }}
                    placeholder={t.jobcards.searchVehiclesByPlate}
                    disabled={isLoading}
                    autoComplete="off"
                    className="pl-9 pr-9"
                  />
                  {vehicleSearch && (
                    <button
                      type="button"
                      aria-label="Clear vehicle search"
                      className="absolute right-2 top-1.5 z-10 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={(event) => {
                        const input = event.currentTarget.parentElement?.querySelector("input") as HTMLInputElement | null;
                        setVehicleSearch("");
                        setValue("vehicleId", "");
                        setIsVehiclePickerOpen(true);
                        if (input) updateVehiclePickerPosition(input);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  {isVehiclePickerOpen && vehiclePickerPosition && typeof document !== "undefined" && createPortal(
                    <div
                      className="fixed z-[100] max-h-60 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-lg"
                      style={{ top: vehiclePickerPosition.top, left: vehiclePickerPosition.left, width: vehiclePickerPosition.width }}
                    >
                      {matchingVehicles.length > 0 ? matchingVehicles.map((vehicle: any) => (
                        <button
                          key={vehicle.id}
                          type="button"
                          className="flex w-full items-center justify-between rounded-sm px-3 py-2 text-left text-sm outline-none hover:bg-accent focus:bg-accent"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            setValue("vehicleId", vehicle.id, { shouldValidate: true });
                            setValue("customerId", vehicle.customerId, { shouldValidate: true });
                            setVehicleSearch(vehicle.plateNumber);
                            setIsVehiclePickerOpen(false);
                            setVehiclePickerPosition(null);
                          }}
                        >
                          <span className="min-w-0">
                            <span className="block font-mono font-medium">{vehicle.plateNumber}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {vehicle.brand} {vehicle.model} · {vehicle.customer.name}
                              {vehicle.customer.phone ? ` · ${vehicle.customer.phone}` : ""}
                            </span>
                          </span>
                          {selectedVehicleId === vehicle.id && <Check className="ml-3 h-4 w-4 shrink-0 text-primary" />}
                        </button>
                      )) : (
                        <p className="px-3 py-4 text-center text-sm text-muted-foreground">No matching vehicles found.</p>
                      )}
                    </div>,
                    document.body
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
                render={({ field }) => {
                  const selectedMechanic = dropdowns.mechanics.find((m: any) => m.id === field.value)
                  const filteredMechanics = dropdowns.mechanics.filter((m: any) => m.name.toLowerCase().includes(mechanicSearch.trim().toLowerCase()))
                  return (
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-2.5 z-10 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="mechanicId"
                        value={isMechanicPickerOpen ? mechanicSearch : (selectedMechanic?.name || "")}
                        placeholder={t.jobcards.selectMechanic}
                        className="pl-9 pr-9"
                        autoComplete="off"
                        onFocus={(event) => {
                          setMechanicSearch("");
                          setIsMechanicPickerOpen(true);
                          updateMechanicPickerPosition(event.currentTarget);
                        }}
                        onBlur={() => window.setTimeout(() => {
                          setIsMechanicPickerOpen(false);
                          setMechanicPickerPosition(null);
                        }, 150)}
                        onChange={(event) => {
                          setMechanicSearch(event.target.value);
                          field.onChange("");
                          setIsMechanicPickerOpen(true);
                          updateMechanicPickerPosition(event.currentTarget);
                        }}
                      />
                      {(selectedMechanic || mechanicSearch) && <button type="button" aria-label="Clear mechanic" className="absolute right-2 top-1.5 z-10 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" onMouseDown={(event) => event.preventDefault()} onClick={(event) => {
                        const input = event.currentTarget.parentElement?.querySelector("input") as HTMLInputElement | null;
                        field.onChange("");
                        setMechanicSearch("");
                        setIsMechanicPickerOpen(true);
                        if (input) updateMechanicPickerPosition(input);
                      }}><X className="h-4 w-4" /></button>}
                      {isMechanicPickerOpen && mechanicPickerPosition && typeof document !== "undefined" && createPortal(
                        <div className="fixed z-[100] max-h-60 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-lg" style={mechanicPickerPosition}>
                          {filteredMechanics.length > 0 ? filteredMechanics.map((mechanic: any) => (
                            <button key={mechanic.id} type="button" className="flex w-full items-center justify-between rounded-sm px-3 py-2 text-left text-sm hover:bg-accent" onMouseDown={(event) => event.preventDefault()} onClick={() => {
                              field.onChange(mechanic.id);
                              setMechanicSearch(mechanic.name);
                              setIsMechanicPickerOpen(false);
                              setMechanicPickerPosition(null);
                            }}>
                              <span>{mechanic.name}</span>
                              {field.value === mechanic.id && <Check className="h-4 w-4 text-primary" />}
                            </button>
                          )) : <p className="px-3 py-4 text-center text-sm text-muted-foreground">No matching mechanics found.</p>}
                        </div>, document.body
                      )}
                    </div>
                  );
                }}
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
            <Label htmlFor="expectedFinishDate">
              Expected finish date <span className="text-destructive">*</span>
            </Label>
            <Input id="expectedFinishDate" type="date" {...register("expectedFinishDate")} />
            <p className="text-xs text-muted-foreground">When the vehicle is expected to be ready.</p>
            {errors.expectedFinishDate && (
              <p className="text-sm text-destructive">
                {errors.expectedFinishDate.message}
              </p>
            )}
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
                            readOnly
                            className="bg-muted cursor-not-allowed"
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
                jobCardId={initialData?.id}
                onSelect={(batch) => {
                  if (!watchedParts.find((p) => p.batchId === batch.id)) {
                    appendPart({
                      batchId: batch.id,
                      name: `${batch.inventory.itemName} (${batch.inventory.partNumber})`,
                      quantity: 1,
                      price: batch.sellingPrice,
                      maxStock: batch.availableQuantity,
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
                            readOnly
                            className="bg-muted cursor-not-allowed"
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
                        {formatDisplayDate(job.createdAt)}
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
