"use server"

import prisma from "@/lib/prisma"
import { parseSettlementDate } from "@/lib/settlement-date"
import type { Prisma } from "@prisma/client"
import { PurchaseFormValues, purchaseSchema } from "./schema"
import { revalidatePath } from "next/cache"
import { getCreatorName, requirePagePermission } from "@/lib/authorization"
import { userPaymeterWhere } from "@/lib/paymeter"
import { recalculateJobCardTotals } from "../jobcards/recalculate"
import { assertPurchasableJobCard, editPurchaseStock } from "./edit-stock"

// Purchases write multiple items, stock batches, ledger entries and job card parts.
// Allow these atomic operations more time than Prisma's five-second default.
const purchaseTransactionOptions = { timeout: 30_000 }

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
  await requirePagePermission("purchases", "view")
  const limit = 5;
  const skip = (page - 1) * limit;

  const where: any = search ? {
    OR: [
      { purchaseNumber: { contains: search, mode: "insensitive" } },
      { supplier: { name: { contains: search, mode: "insensitive" } } }
    ]
  } : {};

  if (fromDate || toDate) {
    where.purchaseDate = {};
    if (fromDate) where.purchaseDate.gte = new Date(fromDate);
    if (toDate) where.purchaseDate.lte = new Date(toDate);
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

export async function getPurchaseById(id: string) {
  await requirePagePermission("purchases", "view")
  return prisma.purchase.findUnique({
    where: { id },
    include: {
      supplier: true,
      jobCard: {
        include: {
          customer: true,
          vehicle: true,
        },
      },
      paymentMethod: true,
      items: {
        include: {
          inventory: true,
        },
      },
      purchasePayments: {
        include: {
          paymeter: true,
        },
        orderBy: { date: "asc" },
      },
    },
  })
}

export async function getPurchaseDropdownData() {
  await requirePagePermission("purchases", "view")
  const [suppliers, paymeters, inventoryRaw, jobCards] = await Promise.all([
    prisma.supplier.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.paymeter.findMany({ where: userPaymeterWhere, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.inventory.findMany({ 
      include: { batches: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { itemName: 'asc' } 
    }),
    prisma.jobCard.findMany({
      where: { status: { notIn: ["COMPLETED", "CANCELLED"] } },
      include: {
        vehicle: true,
        customer: true,
        parts: { where: { isPending: true }, include: { batch: { include: { inventory: true } }, inventory: true } }
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
  await requirePagePermission("purchases", "view")
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
  await requirePagePermission("purchases", "create")
  const parsed = purchaseSchema.parse(data)
  const paymentMethodId = parsed.paymentSource === "PAYMETER" ? parsed.paymentMethodId! : null
  
  // Product-wise calculations
  let subTotal = 0
  let totalTax = 0
  const itemsData = parsed.items.map(item => {
    const productAmount = item.quantity * item.purchasePrice
    const taxRate = Math.max(0, Number(item.taxRate) || 0)
    const taxAmount = (productAmount * taxRate) / 100
    const itemTotal = productAmount + taxAmount
    subTotal += productAmount
    totalTax += taxAmount
    return {
      inventoryId: item.inventoryId,
      quantity: item.quantity,
      purchasePrice: item.purchasePrice,
      sellingPrice: item.sellingPrice,
      taxRate,
      taxAmount,
      itemTotal
    }
  })

  const taxAmount = totalTax
  const overallTaxRate = subTotal > 0 ? (taxAmount / subTotal) * 100 : 0
  const grandTotal = Math.max(0, subTotal + taxAmount - parsed.discount)
  const pendingAmount = Math.max(0, grandTotal - parsed.paidAmount)

  if (parsed.discount > subTotal) {
    throw new Error("Discount cannot exceed the purchase subtotal.")
  }

  if (parsed.paidAmount > grandTotal) {
    throw new Error("Paid amount cannot exceed the purchase grand total.")
  }

  const purchaseNumber = await getNextPurchaseNumber()
  const creatorName = await getCreatorName()

  const result = await prisma.$transaction(async (tx) => {
    if (parsed.purchaseType !== "STOCK") await assertPurchasableJobCard(tx, parsed.jobCardId)
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
        taxRate: overallTaxRate,
        taxAmount,
        discount: parsed.discount,
        grandTotal,
        paidAmount: parsed.paidAmount,
        pendingAmount,
        createdBy: creatorName,
        items: {
          create: itemsData
        }
      }
    })

    // 2. Record the purchase initial payment against its selected ledger or direct-payment ledger.
    if (parsed.paidAmount > 0) {
      await tx.paymeter.update({
        where: { id: selectedPaymentMethodId },
        data: { spentAmount: { increment: parsed.paidAmount } }
      })
    }

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
      
      if (parsed.purchaseType === "VEHICLE" && parsed.jobCardId) {
        await tx.jobCardPart.create({
          data: { jobCardId: parsed.jobCardId, batchId: batch.id, isPending: false, quantity: item.quantity, price: item.sellingPrice }
        })
      }

      if (parsed.purchaseType === "PENDING_PARTS" && parsed.jobCardId) {
        const pendingPart = await tx.jobCardPart.findFirst({
          where: { jobCardId: parsed.jobCardId, isPending: true, OR: [{ inventoryId: item.inventoryId }, { batch: { inventoryId: item.inventoryId } }] },
          orderBy: { createdAt: "asc" },
        })
        if (!pendingPart) throw new Error("Select a pending part from the selected Job Card.")
        if (item.quantity !== pendingPart.quantity) {
          throw new Error("Pending part quantity must be exactly " + pendingPart.quantity + ".")
        }
        await tx.jobCardPart.update({
          where: { id: pendingPart.id },
          data: { batchId: batch.id, inventoryId: item.inventoryId, isPending: false, quantity: item.quantity, price: item.sellingPrice },
        })
      }
    }
    
    if (parsed.jobCardId && ["VEHICLE", "PENDING_PARTS"].includes(parsed.purchaseType)) {
      await recalculateJobCardTotals(tx, parsed.jobCardId)
    }

    return purchase
  }, purchaseTransactionOptions)

  revalidatePath('/purchases')
  revalidatePath('/inventory')
  revalidatePath('/paymeters')
  revalidatePath('/jobcards')
  revalidatePath('/vehicles')
  revalidatePath('/invoices')
  revalidatePath('/payments')
  revalidatePath('/suppliers')
  revalidatePath('/reports')
  revalidatePath('/')
  return result
}

export async function deletePurchase(id: string) {
  await requirePagePermission("purchases", "delete")
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

    // 2. Revert Paymeter spentAmount by paidAmount (since only paidAmount was added)
    if (purchase.paidAmount > 0) {
      await tx.paymeter.update({
        where: { id: purchase.paymentMethodId },
        data: { spentAmount: { decrement: purchase.paidAmount } }
      })
    }

    // 3. Delete the purchase (cascades items and payments, but batches are now safe)
    await tx.purchase.delete({
      where: { id }
    })

    return { success: true }
  })

  revalidatePath('/purchases')
  revalidatePath('/inventory')
  revalidatePath('/paymeters')
  revalidatePath('/jobcards')
  revalidatePath('/vehicles')
  revalidatePath('/invoices')
  revalidatePath('/payments')
  revalidatePath('/suppliers')
  revalidatePath('/reports')
  revalidatePath('/')
  return result
}

export async function payPurchase(purchaseId: string, amount: number, paymentDate: string) {
  await requirePagePermission("purchases", "edit")
  const date = parseSettlementDate(paymentDate)
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Amount must be greater than 0")

  const purchase = await prisma.purchase.findUnique({
    where: { id: purchaseId },
    include: { purchasePayments: true },
  })
  if (!purchase) throw new Error("Purchase not found")

  // Supplier-screen payments are separate liabilities. Only the amount
  // originally advanced from the purchase's paymeter can be reimbursed here.
  const supplierPayments = purchase.purchasePayments
    .filter((payment) => payment.pendingAmount > 0 || payment.paidAmount > 0)
    .reduce((total, payment) => total + payment.amount, 0)
  const originalPaymeterAdvance = Math.max(0, purchase.paidAmount - supplierPayments)
  const maxReimbursable = originalPaymeterAdvance - purchase.paymeterReimbursed;
  if (amount > maxReimbursable) {
    throw new Error("Payment cannot exceed pending reimbursement amount")
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1. Update Purchase paymeterReimbursed amount
    const settled = await tx.purchase.updateMany({
      where: { id: purchaseId, paidAmount: purchase.paidAmount, paymentMethodId: purchase.paymentMethodId,
        paymeterReimbursed: { lte: originalPaymeterAdvance - amount } },
      data: { paymeterReimbursed: { increment: amount } }
    })
    if (settled.count !== 1) throw new Error("The reimbursement balance changed. Refresh and try again.")
    const updatedPurchase = await tx.purchase.findUniqueOrThrow({ where: { id: purchaseId } })

    // 2. Decrement Paymeter spent amount (money is returned to the paymeter)
    const reimbursed = await tx.paymeter.updateMany({
      where: { id: purchase.paymentMethodId, spentAmount: { gte: amount } },
      data: { spentAmount: { decrement: amount } }
    })
    if (reimbursed.count !== 1) throw new Error("Reimbursement cannot exceed the current paymeter balance. Refresh and try again.")

    await tx.paymeterSettlement.create({
      data: { paymeterId: purchase.paymentMethodId, amount, date, type: "PURCHASE_REIMBURSEMENT" }
    })

    return updatedPurchase
  })

  revalidatePath('/purchases')
  revalidatePath('/paymeters')
  revalidatePath('/')
  revalidatePath('/reports')
  return result
}

export async function updatePurchase(id: string, data: PurchaseFormValues) {
  await requirePagePermission("purchases", "edit")
  const parsed = purchaseSchema.parse(data)
  const paymentMethodId = parsed.paymentSource === "PAYMETER" ? parsed.paymentMethodId! : null

  const existingPurchase = await prisma.purchase.findUnique({
    where: { id }
  })
  if (!existingPurchase) throw new Error("Purchase not found")

  // Product-wise calculations
  let subTotal = 0
  let totalTax = 0
  const itemsData = parsed.items.map(item => {
    const productAmount = item.quantity * item.purchasePrice
    const taxRate = Math.max(0, Number(item.taxRate) || 0)
    const taxAmount = (productAmount * taxRate) / 100
    const itemTotal = productAmount + taxAmount
    subTotal += productAmount
    totalTax += taxAmount
    return {
      inventoryId: item.inventoryId,
      quantity: item.quantity,
      purchasePrice: item.purchasePrice,
      sellingPrice: item.sellingPrice,
      taxRate,
      taxAmount,
      itemTotal
    }
  })

  const taxAmount = totalTax
  const overallTaxRate = subTotal > 0 ? (taxAmount / subTotal) * 100 : 0
  const grandTotal = Math.max(0, subTotal + taxAmount - parsed.discount)
  const pendingAmount = Math.max(0, grandTotal - parsed.paidAmount)

  if (parsed.discount > subTotal) {
    throw new Error("Discount cannot exceed the purchase subtotal.")
  }

  if (parsed.paidAmount > grandTotal) {
    throw new Error("Paid amount cannot exceed the purchase grand total.")
  }

  const result = await prisma.$transaction(async (tx) => {
    const existingPurchase = await tx.purchase.findUniqueOrThrow({ where: { id }, include: { purchasePayments: true } })
    await assertPurchasableJobCard(tx, existingPurchase.jobCardId)
    if (parsed.purchaseType !== "STOCK") await assertPurchasableJobCard(tx, parsed.jobCardId)
    await editPurchaseStock(tx, existingPurchase, parsed)
    const selectedPaymentMethodId = paymentMethodId || await getDirectPaymeterId(tx, parsed.directPaymentMethod!)
    
    const current = existingPurchase
    const supplierPayments = current.purchasePayments.filter(p => p.pendingAmount > 0 || p.paidAmount > 0)
    const initialPayments = current.purchasePayments.filter(p => p.pendingAmount === 0 && p.paidAmount === 0)
    if (initialPayments.length > 1) throw new Error("Multiple initial payments exist. Review payment history before editing.")
    const initialAmount = Math.max(0, current.paidAmount - supplierPayments.reduce((sum, p) => sum + p.amount, 0))
    const paymentChanged = current.paidAmount !== parsed.paidAmount || current.paymentMethodId !== selectedPaymentMethodId
    if ((supplierPayments.length > 0 || current.paymeterReimbursed > 0) && (paymentChanged || current.supplierId !== parsed.supplierId)) {
      throw new Error("This purchase has settlements. Keep its paid amount, payment method and supplier unchanged to preserve payment history.")
    }
    if (paymentChanged) {
      if (initialAmount > 0) await tx.paymeter.update({ where: { id: current.paymentMethodId }, data: { spentAmount: { decrement: initialAmount } } })
      if (parsed.paidAmount > 0) await tx.paymeter.update({ where: { id: selectedPaymentMethodId }, data: { spentAmount: { increment: parsed.paidAmount } } })
      const paymentData = { paymeterId: selectedPaymentMethodId, amount: parsed.paidAmount, date: new Date(parsed.purchaseDate) }
      if (initialPayments[0]) await tx.purchasePayment.update({ where: { id: initialPayments[0].id }, data: paymentData })
      else if (parsed.paidAmount > 0) await tx.purchasePayment.create({ data: { ...paymentData, purchaseId: id } })
    }
    await tx.purchaseItem.deleteMany({ where: { purchaseId: id } })

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
        taxRate: overallTaxRate,
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

    const affectedJobCards = new Set<string>()
    if (["VEHICLE", "PENDING_PARTS"].includes(existingPurchase.purchaseType) && existingPurchase.jobCardId) affectedJobCards.add(existingPurchase.jobCardId)
    if (["VEHICLE", "PENDING_PARTS"].includes(parsed.purchaseType) && parsed.jobCardId) affectedJobCards.add(parsed.jobCardId)
    for (const jobCardId of affectedJobCards) await recalculateJobCardTotals(tx, jobCardId)

    return purchase
  }, { ...purchaseTransactionOptions, isolationLevel: "Serializable" })

  revalidatePath('/purchases')
  revalidatePath('/inventory')
  revalidatePath('/paymeters')
  revalidatePath('/jobcards')
  revalidatePath('/vehicles')
  revalidatePath('/invoices')
  revalidatePath('/payments')
  revalidatePath('/suppliers')
  revalidatePath('/reports')
  revalidatePath('/')
  return result
}
