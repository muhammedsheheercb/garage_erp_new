"use server"

import prisma from "@/lib/prisma"
import { PurchaseFormValues, purchaseSchema } from "./schema"
import { revalidatePath } from "next/cache"

export async function getPurchases(page = 1, search = "") {
  const limit = 10;
  const skip = (page - 1) * limit;

  const where = search ? {
    OR: [
      { purchaseNumber: { contains: search } },
      { supplier: { name: { contains: search } } }
    ]
  } : {};

  const [data, total] = await Promise.all([
    prisma.purchase.findMany({
      where,
      skip,
      take: limit,
      include: {
        supplier: true,
        paymentMethod: true,
        items: {
          include: {
            inventory: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.purchase.count({ where })
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

export async function getPurchaseDropdownData() {
  const [suppliers, paymeters, inventoryRaw] = await Promise.all([
    prisma.supplier.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.paymeter.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.inventory.findMany({ 
      include: { batches: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { itemName: 'asc' } 
    })
  ])
  
  const inventory = inventoryRaw.map(i => ({
    id: i.id,
    itemName: i.itemName,
    partNumber: i.partNumber,
    purchasePrice: i.batches[0]?.purchasePrice || 0,
    sellingPrice: i.batches[0]?.sellingPrice || 0
  }))

  return { suppliers, paymeters, inventory }
}

export async function getNextPurchaseNumber() {
  const latestItem = await prisma.purchase.findFirst({
    orderBy: { purchaseNumber: 'desc' }
  })
  
  let nextNum = 1
  if (latestItem && latestItem.purchaseNumber) {
    const match = latestItem.purchaseNumber.match(/PUR-(\d+)/)
    if (match) {
      nextNum = parseInt(match[1], 10) + 1
    }
  }
  
  return `PUR-${String(nextNum).padStart(6, '0')}`
}

export async function createPurchase(data: PurchaseFormValues) {
  const parsed = purchaseSchema.parse(data)
  
  // Calculate calculations
  let subTotal = 0
  const itemsData = parsed.items.map(item => {
    const total = item.quantity * item.purchasePrice
    subTotal += total
    return {
      inventoryId: item.inventoryId,
      quantity: item.quantity,
      purchasePrice: item.purchasePrice,
      sellingPrice: item.sellingPrice,
      itemTotal: total
    }
  })

  // Read active tax setting
  const activeTax = await prisma.taxSetting.findFirst({
    where: { isActive: true }
  })
  const taxRate = activeTax ? activeTax.percentage : 0
  const taxAmount = (subTotal - parsed.discount) * (taxRate / 100)
  const grandTotal = subTotal + taxAmount - parsed.discount
  const pendingAmount = grandTotal - parsed.paidAmount

  const purchaseNumber = await getNextPurchaseNumber()

  const result = await prisma.$transaction(async (tx) => {
    // 1. Create the purchase
    const purchase = await tx.purchase.create({
      data: {
        purchaseNumber,
        purchaseDate: new Date(parsed.purchaseDate),
        supplierId: parsed.supplierId,
        paymentMethodId: parsed.paymentMethodId,
        subTotal,
        taxRate,
        taxAmount,
        discount: parsed.discount,
        grandTotal,
        paidAmount: parsed.paidAmount,
        pendingAmount,
        items: {
          create: itemsData
        }
      }
    })

    // 2. Always increment Paymeter spentAmount by grandTotal (full purchase liability)
    await tx.paymeter.update({
      where: { id: parsed.paymentMethodId },
      data: {
        spentAmount: { increment: grandTotal }
      }
    })

    // 3. If paidAmount > 0, create a PurchasePayment record
    if (parsed.paidAmount > 0) {
      await tx.purchasePayment.create({
        data: {
          purchaseId: purchase.id,
          paymeterId: parsed.paymentMethodId,
          amount: parsed.paidAmount,
          date: new Date(parsed.purchaseDate)
        }
      })
    }

    // 3. Create Inventory Batches
    for (const item of parsed.items) {
      await tx.inventoryBatch.create({
        data: {
          inventoryId: item.inventoryId,
          batchNumber: purchaseNumber,
          quantity: item.quantity,
          purchasePrice: item.purchasePrice,
          sellingPrice: item.sellingPrice,
          purchaseId: purchase.id
        }
      })
    }

    return purchase
  })

  revalidatePath('/purchases')
  revalidatePath('/inventory')
  revalidatePath('/paymeters')
  return result
}

export async function deletePurchase(id: string) {
  const purchase = await prisma.purchase.findUnique({
    where: { id },
    include: { items: true }
  })

  if (!purchase) {
    throw new Error("Purchase not found")
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1. (No explicit inventory rollback needed since InventoryBatch is cascade deleted with Purchase, 
    // but we would need to check if job card used these batches before deleting. For now, cascade takes care of the batch removal.)

    // 2. Revert Paymeter spentAmount by full grandTotal (purchase commitment is cancelled)
    await tx.paymeter.update({
      where: { id: purchase.paymentMethodId },
      data: {
        spentAmount: { decrement: purchase.grandTotal }
      }
    })

    // 3. Delete the purchase (cascades items and payments)
    await tx.purchase.delete({
      where: { id }
    })

    return { success: true }
  })

  revalidatePath('/purchases')
  revalidatePath('/inventory')
  revalidatePath('/purchases')
  revalidatePath('/inventory')
  revalidatePath('/paymeters')
  return result
}

export async function payPurchase(purchaseId: string, amount: number) {
  if (amount <= 0) throw new Error("Amount must be greater than 0")

  const purchase = await prisma.purchase.findUnique({ where: { id: purchaseId } })
  if (!purchase) throw new Error("Purchase not found")

  if (amount > purchase.pendingAmount) {
    throw new Error("Payment cannot exceed pending amount")
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1. Create PurchasePayment
    await tx.purchasePayment.create({
      data: {
        purchaseId,
        paymeterId: purchase.paymentMethodId,
        amount,
        date: new Date()
      }
    })

    // 2. Update Purchase amounts
    const updatedPurchase = await tx.purchase.update({
      where: { id: purchaseId },
      data: {
        paidAmount: { increment: amount },
        pendingAmount: { decrement: amount }
      }
    })

    // 3. Update Paymeter spent amount (settling the purchase reduces what's owed)
    await tx.paymeter.update({
      where: { id: purchase.paymentMethodId },
      data: {
        spentAmount: { decrement: amount }
      }
    })

    return updatedPurchase
  })

  revalidatePath('/purchases')
  revalidatePath('/paymeters')
  return result
}
