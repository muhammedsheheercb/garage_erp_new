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
        supplier: { select: { id: true, name: true } }
      },
      orderBy: { itemName: 'asc' }
    }),
    prisma.inventory.count({ where })
  ]);

  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  }
}

export async function getSuppliersDropdown() {
  return prisma.supplier.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' }
  })
}

export async function createInventoryItem(data: InventoryFormValues) {
  const parsed = inventorySchema.parse(data)
  
  const item = await prisma.inventory.create({
    data: {
      itemName: parsed.itemName,
      partNumber: parsed.partNumber,
      quantity: parsed.quantity,
      minStockLevel: parsed.minStockLevel,
      purchasePrice: parsed.purchasePrice,
      sellingPrice: parsed.sellingPrice,
      supplierId: parsed.supplierId,
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
      quantity: parsed.quantity,
      minStockLevel: parsed.minStockLevel,
      purchasePrice: parsed.purchasePrice,
      sellingPrice: parsed.sellingPrice,
      supplierId: parsed.supplierId,
    }
  })
  
  revalidatePath('/inventory')
  return item
}

export async function deleteInventoryItem(id: string) {
  await prisma.inventory.delete({
    where: { id }
  })
  
  revalidatePath('/inventory')
  return { success: true }
}
