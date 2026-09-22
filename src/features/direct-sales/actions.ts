"use server"

import prisma from "@/lib/prisma"
import { getCreatorName, requirePagePermission } from "@/lib/authorization"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { batchAvailability } from "@/lib/batch-stock"

const saleSchema = z.object({
  vehicleNumber: z.string().trim().optional().default(""),
  customerName: z.string().trim().optional().default(""),
  customerMobile: z.string().trim().optional().default(""),
  saleDate: z.union([z.literal(""), z.string().date("Sale date is invalid.")]).optional().default(""),
  discount: z.coerce.number().min(0, "Discount cannot be negative.").default(0),
  items: z.array(z.object({
    batchId: z.string().min(1), quantity: z.coerce.number().int().positive(),
    purchasePrice: z.coerce.number().min(0), salesPrice: z.coerce.number().min(0),
    vat: z.coerce.number().min(0, "VAT cannot be negative."),
  })).optional().default([]),
})

type SaleInput = z.input<typeof saleSchema>
const dateBoundary = (value: string, end = false) => {
  const date = new Date(value)
  date.setHours(end ? 23 : 0, end ? 59 : 0, end ? 59 : 0, end ? 999 : 0)
  return date
}

function calculate(items: z.infer<typeof saleSchema>["items"], saleDiscount: number) {
  const rows = items.map(item => {
    const base = item.quantity * item.salesPrice
    const tax = base * item.vat / 100
    return { ...item, discount: 0, tax, totalAmount: base + tax }
  })
  const subTotal = rows.reduce((sum, item) => sum + item.quantity * item.salesPrice, 0)
  if (saleDiscount > subTotal) throw new Error("Discount cannot be greater than the subtotal.")
  const tax = rows.reduce((sum, item) => sum + item.tax, 0)
  return {
    rows,
    subTotal, discount: saleDiscount, tax,
    grandTotal: subTotal + tax - saleDiscount,
  }
}

function parseSaleDate(value: string) {
  const saleDate = value ? new Date(`${value}T00:00:00`) : new Date()
  if (saleDate > new Date(new Date().setHours(23, 59, 59, 999))) {
    throw new Error("Sale date cannot be in the future.")
  }
  return saleDate
}

async function assertAndDeduct(tx: any, rows: Array<{ batchId: string; quantity: number }>) {
  const grouped = new Map<string, number>()
  for (const row of rows) grouped.set(row.batchId, (grouped.get(row.batchId) || 0) + row.quantity)
  for (const [batchId, quantity] of grouped) {
    const batch = await tx.inventoryBatch.findUnique({
      where: { id: batchId },
      include: { jobCardParts: { where: { jobCard: { status: { notIn: ["COMPLETED", "CANCELLED"] } } } } },
    })
    if (!batch) throw new Error("One of the selected products no longer exists.")
    const { availableQuantity } = batchAvailability(batch)
    if (quantity > availableQuantity) throw new Error(`Insufficient available quantity for ${batch.inventoryId}.`)
    const updated = await tx.inventoryBatch.updateMany({ where: { id: batchId, quantity: { gte: quantity } }, data: { quantity: { decrement: quantity } } })
    if (updated.count !== 1) throw new Error("Inventory changed while completing this sale. Please try again.")
  }
}

export async function getDirectSaleStock(search = "") {
  await requirePagePermission("inventory")
  const batches = await prisma.inventoryBatch.findMany({
    where: { quantity: { gt: 0 }, inventory: { OR: [{ itemName: { contains: search, mode: "insensitive" } }, { partNumber: { contains: search, mode: "insensitive" } }] } },
    include: { inventory: true, jobCardParts: { where: { jobCard: { status: { notIn: ["COMPLETED", "CANCELLED"] } } } } },
    orderBy: { createdAt: "desc" }, take: 100,
  })
  return batches.map(batch => {
    const { reservedQuantity, availableQuantity } = batchAvailability(batch)
    return {
    id: batch.id, itemName: batch.inventory.itemName, partNumber: batch.inventory.partNumber,
    batchNumber: batch.batchNumber, quantity: batch.quantity, reservedQuantity, sellingPrice: batch.sellingPrice,
    purchasePrice: batch.purchasePrice, availableQuantity,
  }}).filter(batch => batch.availableQuantity > 0)
}

export async function getDirectSales(page = 1, search = "", fromDate?: string, toDate?: string) {
  await requirePagePermission("inventory")
  const where = search ? { OR: [{ customerName: { contains: search, mode: "insensitive" as const } }, { vehicleNumber: { contains: search, mode: "insensitive" as const } }, { customerMobile: { contains: search, mode: "insensitive" as const } }] } : {}
  if (fromDate || toDate) {
    Object.assign(where, { saleDate: { ...(fromDate ? { gte: dateBoundary(fromDate) } : {}), ...(toDate ? { lte: dateBoundary(toDate, true) } : {}) } })
  }
  const [data, total] = await Promise.all([prisma.directSale.findMany({ where, include: { items: { include: { batch: { include: { inventory: true } } } } }, orderBy: { createdAt: "desc" } }), prisma.directSale.count({ where })])
  return { data, meta: { total, page: 1, limit: total, totalPages: 1 } }
}

export async function getDirectSaleById(id: string) {
  await requirePagePermission("inventory")
  return prisma.directSale.findUnique({ where: { id }, include: { items: { include: { batch: { include: { inventory: true } } } } } })
}

export async function createDirectSale(data: SaleInput) {
  await requirePagePermission("inventory", "create")
  const parsed = saleSchema.parse(data), saleDate = parseSaleDate(parsed.saleDate), totals = calculate(parsed.items, parsed.discount), createdBy = await getCreatorName()
  const { rows, ...summary } = totals
  const sale = await prisma.$transaction(async tx => {
    await assertAndDeduct(tx, rows)
    return tx.directSale.create({ data: { vehicleNumber: parsed.vehicleNumber, customerName: parsed.customerName, customerMobile: parsed.customerMobile, saleDate, ...summary, createdBy, items: { create: rows.map(item => ({ batchId: item.batchId, quantity: item.quantity, purchasePrice: item.purchasePrice, salesPrice: item.salesPrice, vat: item.vat, discount: item.discount, totalAmount: item.totalAmount })) } } })
  })
  revalidateDirectSalePaths(); return sale
}

export async function updateDirectSale(id: string, data: SaleInput) {
  await requirePagePermission("inventory", "edit")
  const parsed = saleSchema.parse(data), saleDate = parseSaleDate(parsed.saleDate), totals = calculate(parsed.items, parsed.discount)
  const { rows, ...summary } = totals
  await prisma.$transaction(async tx => {
    const existing = await tx.directSale.findUnique({ where: { id }, include: { items: true } })
    if (!existing) throw new Error("Direct sale not found.")
    for (const item of existing.items) await tx.inventoryBatch.update({ where: { id: item.batchId }, data: { quantity: { increment: item.quantity } } })
    await assertAndDeduct(tx, rows)
    await tx.directSale.update({ where: { id }, data: { vehicleNumber: parsed.vehicleNumber, customerName: parsed.customerName, customerMobile: parsed.customerMobile, saleDate, ...summary, items: { deleteMany: {}, create: rows.map(item => ({ batchId: item.batchId, quantity: item.quantity, purchasePrice: item.purchasePrice, salesPrice: item.salesPrice, vat: item.vat, discount: item.discount, totalAmount: item.totalAmount })) } } })
  })
  revalidateDirectSalePaths(); return { success: true }
}

export async function deleteDirectSale(id: string) {
  await requirePagePermission("inventory", "delete")
  await prisma.$transaction(async tx => {
    const sale = await tx.directSale.findUnique({ where: { id }, include: { items: true } })
    if (!sale) throw new Error("Direct sale not found.")
    for (const item of sale.items) await tx.inventoryBatch.update({ where: { id: item.batchId }, data: { quantity: { increment: item.quantity } } })
    await tx.directSale.delete({ where: { id } })
  })
  revalidateDirectSalePaths(); return { success: true }
}

function revalidateDirectSalePaths() { ["/direct-sales", "/inventory", "/", "/reports"].forEach(path => revalidatePath(path)) }
