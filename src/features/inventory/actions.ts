"use server"

import prisma from "@/lib/prisma"
import { InventoryFormValues, inventorySchema, openingStockSchema } from "./schema"
import { revalidatePath } from "next/cache"

export async function getInventory(page = 1, search = "", fromDate?: string, toDate?: string) {
  const limit = 5;
  const skip = (page - 1) * limit;

  const where: any = {
    OR: [
      { itemName: { contains: search, mode: "insensitive" } },
      { partNumber: { contains: search, mode: "insensitive" } },
    ]
  };

  if (fromDate || toDate) {
    where.createdAt = {};
    if (fromDate) where.createdAt.gte = new Date(fromDate);
    if (toDate) where.createdAt.lte = new Date(toDate);
  }

  const [data, total] = await Promise.all([
    prisma.inventory.findMany({
      where,
      skip,
      take: limit,
      include: {
        batches: { orderBy: { createdAt: 'desc' } }
      },
      orderBy: { itemName: 'asc' }
    }),
    prisma.inventory.count({ where })
  ]);

  const mappedData = data.map(item => {
    const totalQuantity = item.batches.reduce((sum, b) => sum + b.quantity, 0)
    const currentPurchasePrice = item.batches.length > 0 ? item.batches[0].purchasePrice : 0
    const currentSellingPrice = item.batches.length > 0 ? item.batches[0].sellingPrice : 0
    return {
      ...item,
      quantity: totalQuantity,
      purchasePrice: currentPurchasePrice,
      sellingPrice: currentSellingPrice
    }
  })

  return {
    data: mappedData,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  }
}


export async function getNextPartNumber() {
  const latestItem = await prisma.inventory.findFirst({
    orderBy: { partNumber: 'desc' }
  })
  
  let nextNum = 1
  if (latestItem && latestItem.partNumber) {
    const match = latestItem.partNumber.match(/PART-(\d+)/)
    if (match) {
      nextNum = parseInt(match[1], 10) + 1
    }
  }
  
  return `PART-${String(nextNum).padStart(6, '0')}`
}

export async function getInventoryItemOptions() {
  const items = await prisma.inventory.findMany({
    select: {
      id: true,
      itemName: true,
      partNumber: true,
      batches: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { purchasePrice: true, sellingPrice: true },
      },
    },
    orderBy: { itemName: "asc" },
  })

  return items.map((item) => ({
    id: item.id,
    itemName: item.itemName,
    partNumber: item.partNumber,
    purchasePrice: item.batches[0]?.purchasePrice ?? 0,
    sellingPrice: item.batches[0]?.sellingPrice ?? 0,
  }))
}

export async function addOpeningStockToItem(
  inventoryId: string,
  data: Pick<InventoryFormValues, "openingStock" | "purchasePrice" | "sellingPrice">
) {
  const parsed = openingStockSchema
    .pick({ openingStock: true, purchasePrice: true, sellingPrice: true })
    .parse(data)
  const item = await prisma.inventory.findUnique({
    where: { id: inventoryId },
    select: { id: true, partNumber: true },
  })

  if (!item) throw new Error("Inventory item not found.")

  const openingBatchCount = await prisma.inventoryBatch.count({
    where: {
      batchNumber: { startsWith: "OPENING-" },
    },
  })

  await prisma.inventoryBatch.create({
    data: {
      inventoryId: item.id,
      batchNumber: `OPENING-${openingBatchCount + 1}`,
      quantity: parsed.openingStock,
      purchasePrice: parsed.purchasePrice,
      sellingPrice: parsed.sellingPrice,
    },
  })

  revalidatePath('/inventory')
  revalidatePath('/purchases')
  revalidatePath('/jobcards')
  return { success: true as const }
}

export async function createInventoryItem(data: InventoryFormValues, withOpeningStock = false) {
  const partNumber = await getNextPartNumber()
  const parsed = (withOpeningStock ? openingStockSchema : inventorySchema).parse({ ...data, partNumber })

  const existing = await prisma.inventory.findFirst({
    where: { itemName: { equals: parsed.itemName, mode: "insensitive" } },
    select: { id: true },
  })
  if (existing) return { success: false as const, message: "Inventory item name already exists." }

  const openingBatchCount = withOpeningStock
    ? await prisma.inventoryBatch.count({
        where: { batchNumber: { startsWith: "OPENING-" } },
      })
    : 0
  
  const item = await prisma.inventory.create({
    data: {
      itemName: parsed.itemName,
      partNumber: parsed.partNumber,
      ...(withOpeningStock ? {
        batches: {
          create: {
            batchNumber: `OPENING-${openingBatchCount + 1}`,
            quantity: parsed.openingStock,
            purchasePrice: parsed.purchasePrice,
            sellingPrice: parsed.sellingPrice,
          }
        }
      } : {})
    }
  })
  
  revalidatePath('/inventory')
  revalidatePath('/purchases')
  revalidatePath('/jobcards')
  return item
}

export async function updateInventoryItem(id: string, data: InventoryFormValues) {
  const parsed = inventorySchema.parse(data)

  const existing = await prisma.inventory.findFirst({
    where: {
      itemName: { equals: parsed.itemName, mode: "insensitive" },
      id: { not: id },
    },
    select: { id: true },
  })
  if (existing) return { success: false as const, message: "Inventory item name already exists." }
  
  const existingItem = await prisma.inventory.findUnique({ where: { id }, select: { partNumber: true } })
  if (!existingItem) throw new Error("Inventory item not found.")

  const item = await prisma.inventory.update({
    where: { id },
    data: {
      itemName: parsed.itemName,
      // Part numbers are generated once and cannot be edited.
      partNumber: existingItem.partNumber,
    }
  })
  
  revalidatePath('/inventory')
  revalidatePath('/purchases')
  revalidatePath('/jobcards')
  return item
}

export async function deleteInventoryItem(id: string) {
  const jobCardPartCount = await prisma.jobCardPart.count({
    where: { batch: { inventoryId: id } },
  })
  if (jobCardPartCount > 0) {
    throw new Error("This inventory item is used in a job card and cannot be deleted.")
  }

  await prisma.$transaction([
    prisma.purchaseItem.deleteMany({ where: { inventoryId: id } }),
    prisma.inventoryBatch.deleteMany({ where: { inventoryId: id } }),
    prisma.inventory.delete({ where: { id } }),
  ])
  
  revalidatePath('/inventory')
  revalidatePath('/purchases')
  revalidatePath('/jobcards')
  return { success: true }
}
