"use server"

import prisma from "@/lib/prisma"
import { requirePagePermission, getCreatorName } from "@/lib/authorization"
import { revalidatePath } from "next/cache"
import { quotationSchema, type QuotationFormValues } from "./schema"
import { batchAvailability } from "@/lib/batch-stock"

const quotationInclude = {
  customer: { select: { id: true, name: true, phone: true } },
  vehicle: { select: { id: true, brand: true, model: true, plateNumber: true } },
  services: { include: { service: true } },
  parts: { include: { inventory: true } },
} as const

export async function getQuotations(
  search = "",
  status = "",
  fromDate?: string,
  toDate?: string,
  validUntilFrom?: string,
  validUntilTo?: string,
) {
  await requirePagePermission("quotations")
  const where: any = {
    ...(search ? { OR: [{ customer: { name: { contains: search, mode: "insensitive" } } }, { vehicle: { plateNumber: { contains: search, mode: "insensitive" } } }] } : {}),
    ...(status ? { status } : {}),
  }

  if (fromDate || toDate) {
    where.date = {}
    if (fromDate) where.date.gte = new Date(fromDate)
    if (toDate) where.date.lte = new Date(toDate)
  }

  if (validUntilFrom || validUntilTo) {
    where.validUntil = {}
    if (validUntilFrom) where.validUntil.gte = new Date(validUntilFrom)
    if (validUntilTo) where.validUntil.lte = new Date(validUntilTo)
  }

  return prisma.quotation.findMany({
    where,
    include: quotationInclude,
    orderBy: { createdAt: "desc" },
  })
}

export async function getQuotationById(id: string) {
  await requirePagePermission("quotations")
  return prisma.quotation.findUnique({ where: { id }, include: quotationInclude })
}

export async function getQuotationInventory(search = "") {
  await requirePagePermission("quotations")
  const inventory = await prisma.inventory.findMany({
    where: { OR: [{ itemName: { contains: search, mode: "insensitive" } }, { partNumber: { contains: search, mode: "insensitive" } }] },
    include: {
      batches: {
        include: { jobCardParts: { where: { jobCard: { status: { notIn: ["COMPLETED", "CANCELLED"] } } } } },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { itemName: "asc" },
  })
  return inventory.map((item) => {
    const batches = item.batches.map((batch) => ({ ...batch, ...batchAvailability(batch) }))
    const availableQuantity = batches.reduce((sum, batch) => sum + batch.availableQuantity, 0)
    const firstAvailable = batches.find((batch) => batch.availableQuantity > 0) || batches[0]
    return { id: item.id, itemName: item.itemName, partNumber: item.partNumber, availableQuantity, sellingPrice: firstAvailable?.sellingPrice ?? 0 }
  })
}

export async function getQuotationDropdowns() {
  await requirePagePermission("quotations")
  const [customers, vehicles] = await Promise.all([
    prisma.customer.findMany({ select: { id: true, name: true, phone: true }, orderBy: { name: "asc" } }),
    prisma.vehicle.findMany({ select: { id: true, customerId: true, brand: true, model: true, plateNumber: true }, orderBy: { plateNumber: "asc" } }),
  ])
  return { customers, vehicles }
}

export async function getQuotationServices(search = "") {
  await requirePagePermission("quotations")
  return prisma.service.findMany({ where: { name: { contains: search, mode: "insensitive" } }, orderBy: { name: "asc" }, take: 30 })
}

export async function createQuotation(data: QuotationFormValues) {
  await requirePagePermission("quotations", "create")
  const parsed = quotationSchema.parse(data)
  const quotation = await prisma.quotation.create({ data: {
    customerId: parsed.customerId, vehicleId: parsed.vehicleId, complaint: parsed.complaint, notes: parsed.notes || null,
    date: new Date(parsed.date), validUntil: new Date(parsed.validUntil), vehicleKm: parsed.vehicleKm, otherCharge: parsed.otherCharge,
    serviceTotal: parsed.serviceTotal, partsTotal: parsed.partsTotal, grandTotal: parsed.grandTotal, createdBy: await getCreatorName(), status: "PENDING",
    services: { create: parsed.services.map((service) => ({ serviceId: service.serviceId, quantity: service.quantity, price: service.price })) },
    parts: { create: parsed.parts.map((part) => ({ inventoryId: part.inventoryId, quantity: part.quantity, price: part.price })) },
  } })
  revalidatePath("/quotations")
  return quotation
}

export async function updateQuotation(id: string, data: QuotationFormValues) {
  await requirePagePermission("quotations", "edit")
  const parsed = quotationSchema.parse(data)
  await prisma.quotation.update({ where: { id }, data: {
    customerId: parsed.customerId, vehicleId: parsed.vehicleId, complaint: parsed.complaint, notes: parsed.notes || null,
    date: new Date(parsed.date), validUntil: new Date(parsed.validUntil), vehicleKm: parsed.vehicleKm, otherCharge: parsed.otherCharge,
    serviceTotal: parsed.serviceTotal, partsTotal: parsed.partsTotal, grandTotal: parsed.grandTotal,
    services: { deleteMany: {}, create: parsed.services.map((service) => ({ serviceId: service.serviceId, quantity: service.quantity, price: service.price })) },
    parts: { deleteMany: {}, create: parsed.parts.map((part) => ({ inventoryId: part.inventoryId, quantity: part.quantity, price: part.price })) },
  } })
  revalidatePath("/quotations")
  return { success: true }
}

export async function deleteQuotation(id: string) {
  await requirePagePermission("quotations", "delete")
  await prisma.quotation.delete({ where: { id } })
  revalidatePath("/quotations")
  return { success: true }
}

export async function acceptQuotation(id: string) {
  await requirePagePermission("quotations", "edit")
  const quote = await prisma.quotation.findFirst({ where: { id, status: "PENDING", jobCardId: null }, select: { id: true } })
  if (!quote) throw new Error("This quotation has already been converted")
  return { success: true }
}

export async function markQuotationConverted(id: string, jobCardId: string) {
  await requirePagePermission("quotations", "edit")
  const updated = await prisma.quotation.updateMany({ where: { id, status: "PENDING", jobCardId: null }, data: { status: "CONVERTED", jobCardId } })
  if (!updated.count) throw new Error("This quotation has already been converted")
  revalidatePath("/quotations")
  return { success: true }
}

export async function getQuotationJobCardPrefill(id: string) {
  await requirePagePermission("jobcards", "create")
  const quote = await prisma.quotation.findFirst({ where: { id, status: "PENDING", jobCardId: null }, include: quotationInclude })
  if (!quote) return null
  const partRows: Array<{ batchId: string; name: string; quantity: number; price: number; maxStock: number }> = []
  const unavailable: string[] = []
  for (const part of quote.parts) {
    const batches = await prisma.inventoryBatch.findMany({ where: { inventoryId: part.inventoryId, quantity: { gt: 0 } }, include: { inventory: true, jobCardParts: { where: { jobCard: { status: { notIn: ["COMPLETED", "CANCELLED"] } } } } }, orderBy: { createdAt: "asc" } })
    let remaining = part.quantity
    for (const batch of batches) {
      const { availableQuantity } = batchAvailability(batch)
      const quantity = Math.min(remaining, availableQuantity)
      if (quantity > 0) {
        partRows.push({ batchId: batch.id, name: `${batch.inventory.itemName} (${batch.inventory.partNumber})`, quantity, price: part.price, maxStock: availableQuantity, batch: { quantity: batch.quantity, inventory: { itemName: batch.inventory.itemName, partNumber: batch.inventory.partNumber } } } as any)
        remaining -= quantity
      }
      if (remaining === 0) break
    }
    if (remaining > 0) unavailable.push(part.inventory.itemName)
  }
  return {
    customerId: quote.customerId, vehicleId: quote.vehicleId, complaint: quote.complaint, notes: quote.notes || "", vehicleKm: quote.vehicleKm,
    date: new Date().toISOString(), services: quote.services.map((service) => ({ serviceId: service.serviceId, service: { name: service.service.name }, quantity: service.quantity, price: service.price })),
    parts: partRows, serviceTotal: quote.serviceTotal, partsTotal: partRows.reduce((sum, part) => sum + part.quantity * part.price, 0), grandTotal: quote.serviceTotal + partRows.reduce((sum, part) => sum + part.quantity * part.price, 0),
    quotationStockWarning: unavailable.length ? `Insufficient current stock for: ${unavailable.join(", ")}. Please update the parts before saving.` : undefined,
  }
}
