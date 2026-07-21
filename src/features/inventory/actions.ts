"use server"

import prisma from "@/lib/prisma"
import { InventoryFormValues, inventorySchema } from "./schema"
import { revalidatePath } from "next/cache"

export async function getInventory(page = 1, search = "") {
  const limit = 10;
  const skip = (page - 1) * limit;

  const where = {
    OR: [
      { itemName: { contains: search } },
      { partNumber: { contains: search } },
    ]
  };

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

export async function createInventoryItem(data: InventoryFormValues) {
  const partNumber = await getNextPartNumber()
  const parsed = inventorySchema.parse({ ...data, partNumber })
  
  const item = await prisma.inventory.create({
    data: {
      itemName: parsed.itemName,
      partNumber: parsed.partNumber,
    }
  })
  
  revalidatePath('/inventory')
  return item
}

export async function updateInventoryItem(id: string, data: InventoryFormValues) {
  const parsed = inventorySchema.parse(data)
  
  const item = await prisma.inventory.update({
    where: { id },
    data: {
      itemName: parsed.itemName,
      partNumber: parsed.partNumber,
    }
  })
  
  revalidatePath('/inventory')
  return item
}

export async function deleteInventoryItem(id: string) {
  const [batchCount, purchaseItemCount] = await Promise.all([
    prisma.inventoryBatch.count({ where: { inventoryId: id } }),
    prisma.purchaseItem.count({ where: { inventoryId: id } }),
  ])
  if (batchCount > 0 || purchaseItemCount > 0) {
    throw new Error("This inventory item cannot be deleted because it has purchase or stock history.")
  }

  await prisma.inventory.delete({
    where: { id }
  })
  
  revalidatePath('/inventory')
  return { success: true }
}
