"use server"

import prisma from "@/lib/prisma"
import type { Prisma } from "@prisma/client"
import { PurchaseFormValues, purchaseSchema } from "./schema"
import { revalidatePath } from "next/cache"

const directPaymentNames = {
  CASH: "Direct Cash",
  BANK_TRANSFER: "Direct Bank Transfer",
  CARD: "Card",
} as const

async function getDirectPaymeterId(
  tx: Prisma.TransactionClient,
  method: keyof typeof directPaymentNames,
) {
  const name = directPaymentNames[method]
  const existing = await tx.paymeter.findUnique({ where: { name } })
  if (existing) return existing.id

  return (await tx.paymeter.create({ data: { name } })).id
}

export async function getPurchases(page = 1, search = "", fromDate?: string, toDate?: string) {
  const limit = 10;
  const skip = (page - 1) * limit;

  const where: any = search ? {
    OR: [
      { purchaseNumber: { contains: search } },
      { supplier: { name: { contains: search } } }
    ]
  } : {};

  if (fromDate || toDate) {
    where.createdAt = {};
    if (fromDate) where.createdAt.gte = new Date(fromDate);
    if (toDate) where.createdAt.lte = new Date(toDate);
  }

  const [data, total] = await Promise.all([
    prisma.purchase.findMany({
      where,
      skip,
      take: limit,
      include: {
        supplier: true,
        jobCard: {
          include: {
            customer: true,
            vehicle: true
          }
        },
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
  const [suppliers, paymeters, inventoryRaw, jobCards] = await Promise.all([
    prisma.supplier.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.paymeter.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.inventory.findMany({ 
      include: { batches: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { itemName: 'asc' } 
    }),
    prisma.jobCard.findMany({
      where: { status: { notIn: ["COMPLETED", "CANCELLED"] } },
      include: {
        vehicle: true,
        customer: true
      },
      orderBy: { createdAt: 'desc' }
    })
  ])
  
  const inventory = inventoryRaw.map(i => ({
    id: i.id,
    itemName: i.itemName,
    partNumber: i.partNumber,
    purchasePrice: i.batches[0]?.purchasePrice || 0,
    sellingPrice: i.batches[0]?.sellingPrice || 0
  }))

  return { suppliers, paymeters, inventory, jobCards }
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
  const paymentMethodId = parsed.paymentSource === "PAYMETER" ? parsed.paymentMethodId! : null
  
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

  if (parsed.discount > subTotal) {
    throw new Error("Discount cannot exceed the purchase subtotal.")
  }

  if (parsed.paidAmount > grandTotal) {
    throw new Error("Paid amount cannot exceed the purchase grand total.")
  }

  const purchaseNumber = await getNextPurchaseNumber()

  const result = await prisma.$transaction(async (tx) => {
    const selectedPaymentMethodId = paymentMethodId || await getDirectPaymeterId(tx, parsed.directPaymentMethod!)
    // 1. Create the purchase
    const purchase = await tx.purchase.create({
      data: {
        purchaseNumber,
        purchaseDate: new Date(parsed.purchaseDate),
        purchaseType: parsed.purchaseType,
        jobCardId: parsed.jobCardId || null,
        supplierId: parsed.supplierId,
        paymentMethodId: selectedPaymentMethodId,
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

    // 2. Record the purchase against its selected ledger or direct-payment ledger.
    await tx.paymeter.update({
      where: { id: selectedPaymentMethodId },
      data: { spentAmount: { increment: grandTotal } }
    })

    // 3. If paidAmount > 0, create a PurchasePayment record
    if (parsed.paidAmount > 0) {
      await tx.purchasePayment.create({
        data: {
          purchaseId: purchase.id,
          paymeterId: selectedPaymentMethodId,
          amount: parsed.paidAmount,
          date: new Date(parsed.purchaseDate)
        }
      })
    }

    // 4. Create Inventory Batches and optional JobCardParts
    let addedPartsTotal = 0
    for (const item of parsed.items) {
      const batch = await tx.inventoryBatch.create({
        data: {
          inventoryId: item.inventoryId,
          batchNumber: purchaseNumber,
          quantity: item.quantity,
          purchasePrice: item.purchasePrice,
          sellingPrice: item.sellingPrice,
          purchaseId: purchase.id
        }
      })
      
      if (parsed.purchaseType === 'VEHICLE' && parsed.jobCardId) {
        await tx.jobCardPart.create({
          data: {
            jobCardId: parsed.jobCardId,
            batchId: batch.id,
            quantity: item.quantity,
            price: item.sellingPrice
          }
        })
        addedPartsTotal += (item.quantity * item.sellingPrice)
      }
    }
    
    if (parsed.purchaseType === 'VEHICLE' && parsed.jobCardId && addedPartsTotal > 0) {
      // Update JobCard totals
      const jobCard = await tx.jobCard.findUnique({ where: { id: parsed.jobCardId } })
      if (jobCard) {
        const taxRate = jobCard.tax > 0 ? (jobCard.tax / (jobCard.serviceTotal + jobCard.partsTotal)) : 0
        const newPartsTotal = jobCard.partsTotal + addedPartsTotal
        const subTotal = jobCard.serviceTotal + newPartsTotal
        const newTax = subTotal * taxRate
        const newGrandTotal = subTotal + newTax - jobCard.discount
        
        await tx.jobCard.update({
          where: { id: parsed.jobCardId },
          data: {
            partsTotal: newPartsTotal,
            tax: newTax,
            grandTotal: newGrandTotal
          }
        })
      }
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

  if (purchase.pendingAmount > 0) {
    throw new Error("Cannot delete this purchase because it has a pending balance.")
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1. Detach InventoryBatches so the items remain in inventory even if the purchase is deleted.
    // This also naturally bypasses the JobCardPart RESTRICT constraint since the batches aren't deleted.
    await tx.inventoryBatch.updateMany({
      where: { purchaseId: id },
      data: { purchaseId: null }
    })

    // 2. Revert Paymeter spentAmount by full grandTotal (purchase commitment is cancelled)
    await tx.paymeter.update({
      where: { id: purchase.paymentMethodId },
      data: { spentAmount: { decrement: purchase.grandTotal } }
    })

    // 3. Delete the purchase (cascades items and payments, but batches are now safe)
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
      data: { spentAmount: { decrement: amount } }
    })

    return updatedPurchase
  })

  revalidatePath('/purchases')
  revalidatePath('/paymeters')
  return result
}

export async function updatePurchase(id: string, data: PurchaseFormValues) {
  const parsed = purchaseSchema.parse(data)
  const paymentMethodId = parsed.paymentSource === "PAYMETER" ? parsed.paymentMethodId! : null

  const existingPurchase = await prisma.purchase.findUnique({
    where: { id }
  })
  if (!existingPurchase) throw new Error("Purchase not found")

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

  if (parsed.discount > subTotal) {
    throw new Error("Discount cannot exceed the purchase subtotal.")
  }

  if (parsed.paidAmount > grandTotal) {
    throw new Error("Paid amount cannot exceed the purchase grand total.")
  }

  const result = await prisma.$transaction(async (tx) => {
    const selectedPaymentMethodId = paymentMethodId || await getDirectPaymeterId(tx, parsed.directPaymentMethod!)
    
    // 1. Revert old paymeter spentAmount
    await tx.paymeter.update({
      where: { id: existingPurchase.paymentMethodId },
      data: { spentAmount: { decrement: existingPurchase.grandTotal } }
    })

    // 2. Handle old JobCard parts and totals
    if (existingPurchase.purchaseType === 'VEHICLE' && existingPurchase.jobCardId) {
      const oldBatches = await tx.inventoryBatch.findMany({ where: { purchaseId: id } })
      const oldBatchIds = oldBatches.map(b => b.id)
      
      if (oldBatchIds.length > 0) {
        // Find how much was contributed
        const oldParts = await tx.jobCardPart.findMany({ where: { batchId: { in: oldBatchIds } } })
        const oldPartsTotal = oldParts.reduce((sum, p) => sum + (p.quantity * p.price), 0)
        
        await tx.jobCardPart.deleteMany({ where: { batchId: { in: oldBatchIds } } })
        
        if (oldPartsTotal > 0) {
          const oldJobCard = await tx.jobCard.findUnique({ where: { id: existingPurchase.jobCardId } })
          if (oldJobCard) {
            const taxRate = oldJobCard.tax > 0 ? (oldJobCard.tax / (oldJobCard.serviceTotal + oldJobCard.partsTotal)) : 0
            const newPartsTotal = Math.max(0, oldJobCard.partsTotal - oldPartsTotal)
            const subTotal = oldJobCard.serviceTotal + newPartsTotal
            const newTax = subTotal * taxRate
            const newGrandTotal = subTotal + newTax - oldJobCard.discount
            
            await tx.jobCard.update({
              where: { id: existingPurchase.jobCardId },
              data: { partsTotal: newPartsTotal, tax: newTax, grandTotal: newGrandTotal }
            })
          }
        }
      }
    }

    // 3. Delete old items, batches, payments
    await tx.purchaseItem.deleteMany({ where: { purchaseId: id } })
    await tx.inventoryBatch.deleteMany({ where: { purchaseId: id } })
    await tx.purchasePayment.deleteMany({ where: { purchaseId: id } })

    // 4. Update the purchase
    const purchase = await tx.purchase.update({
      where: { id },
      data: {
        purchaseDate: new Date(parsed.purchaseDate),
        purchaseType: parsed.purchaseType,
        jobCardId: parsed.jobCardId || null,
        supplierId: parsed.supplierId,
        paymentMethodId: selectedPaymentMethodId,
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

    // 4. Record the new purchase against its selected ledger
    await tx.paymeter.update({
      where: { id: selectedPaymentMethodId },
      data: { spentAmount: { increment: grandTotal } }
    })

    // 5. If paidAmount > 0, create a PurchasePayment record
    if (parsed.paidAmount > 0) {
      await tx.purchasePayment.create({
        data: {
          purchaseId: purchase.id,
          paymeterId: selectedPaymentMethodId,
          amount: parsed.paidAmount,
          date: new Date(parsed.purchaseDate)
        }
      })
    }

    // 7. Create Inventory Batches and JobCardParts
    let addedPartsTotal = 0
    for (const item of parsed.items) {
      const batch = await tx.inventoryBatch.create({
        data: {
          inventoryId: item.inventoryId,
          batchNumber: purchase.purchaseNumber,
          quantity: item.quantity,
          purchasePrice: item.purchasePrice,
          sellingPrice: item.sellingPrice,
          purchaseId: purchase.id
        }
      })
      
      if (parsed.purchaseType === 'VEHICLE' && parsed.jobCardId) {
        await tx.jobCardPart.create({
          data: {
            jobCardId: parsed.jobCardId,
            batchId: batch.id,
            quantity: item.quantity,
            price: item.sellingPrice
          }
        })
        addedPartsTotal += (item.quantity * item.sellingPrice)
      }
    }
    
    if (parsed.purchaseType === 'VEHICLE' && parsed.jobCardId && addedPartsTotal > 0) {
      const jobCard = await tx.jobCard.findUnique({ where: { id: parsed.jobCardId } })
      if (jobCard) {
        const taxRate = jobCard.tax > 0 ? (jobCard.tax / (jobCard.serviceTotal + jobCard.partsTotal)) : 0
        const newPartsTotal = jobCard.partsTotal + addedPartsTotal
        const subTotal = jobCard.serviceTotal + newPartsTotal
        const newTax = subTotal * taxRate
        const newGrandTotal = subTotal + newTax - jobCard.discount
        
        await tx.jobCard.update({
          where: { id: parsed.jobCardId },
          data: { partsTotal: newPartsTotal, tax: newTax, grandTotal: newGrandTotal }
        })
      }
    }

    return purchase
  })

  revalidatePath('/purchases')
  revalidatePath('/inventory')
  revalidatePath('/paymeters')
  return result
}
