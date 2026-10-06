import type { getCustomers } from "@/features/customers/actions"
import type { getVehicles } from "@/features/vehicles/actions"
import type { getInventory } from "@/features/inventory/actions"
import type { getInvoices } from "@/features/invoices/actions"
import type { getPaymeters } from "@/features/paymeters/actions"
import type { getPurchases } from "@/features/purchases/actions"
import type { getExpenses } from "@/features/expenses/actions"
import type { getSuppliers } from "@/features/suppliers/actions"
import type { getDirectSales } from "@/features/direct-sales/actions"
import type { getJobCardById, getInventoryList, getServicesList } from "@/features/jobcards/actions"
import type { getQuotationById, getQuotationJobCardPrefill } from "@/features/quotations/actions"
import type { getCustomerFullDetails } from "@/features/customers/actions"
import type { getDirectSaleStock } from "@/features/direct-sales/actions"
import type { TranslationKeys } from "@/i18n/translations/en"

export type CustomerView = Awaited<ReturnType<typeof getCustomers>>["data"][number]
export type VehicleView = Awaited<ReturnType<typeof getVehicles>>["data"][number]
export type InventoryItemView = Awaited<ReturnType<typeof getInventory>>["data"][number]
export type InvoiceView = Awaited<ReturnType<typeof getInvoices>>["data"][number]
export type PaymeterView = Awaited<ReturnType<typeof getPaymeters>>["data"][number]
export type PurchaseView = Awaited<ReturnType<typeof getPurchases>>["data"][number]
export type ExpenseView = Awaited<ReturnType<typeof getExpenses>>["data"][number]
export type SupplierView = Awaited<ReturnType<typeof getSuppliers>>["data"][number]
export type DirectSaleView = Awaited<ReturnType<typeof getDirectSales>>["data"][number]
export type JobCardView = NonNullable<Awaited<ReturnType<typeof getJobCardById>>>
export type JobCardPrefill = NonNullable<Awaited<ReturnType<typeof getQuotationJobCardPrefill>>>
export type QuotationView = NonNullable<Awaited<ReturnType<typeof getQuotationById>>>
export type CustomerDetailsView = NonNullable<Awaited<ReturnType<typeof getCustomerFullDetails>>>
export type CustomerJobView = CustomerDetailsView["vehicles"][number]["jobCards"][number]
export type PartOption = Awaited<ReturnType<typeof getInventoryList>>[number] & { isPending?: boolean; isNoBatchItem?: boolean; purchasePrice?: number }
export type ServiceOption = Awaited<ReturnType<typeof getServicesList>>[number]
export type DirectSalePartOption = Awaited<ReturnType<typeof getDirectSaleStock>>[number]
export type { TranslationKeys }

export type JobCardFormData = Partial<Omit<JobCardView, "services" | "parts" | "date">> & {
  date?: Date | string;
  services?: JobCardPrefill["services"];
  parts?: Array<{ batchId?: string | null; inventoryId?: string | null; quantity: number; price: number; isPending: boolean;
    batch?: { quantity: number; inventory: { id?: string; itemName: string; partNumber: string } } | null;
    inventory?: { id?: string; itemName: string; partNumber: string } | null }>;
}
