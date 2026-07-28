"use server"

import prisma from "@/lib/prisma"
import { PaymeterFormValues, paymeterSchema } from "./schema"
import { revalidatePath } from "next/cache"

export async function getPaymeters(fromDateStr?: string, toDateStr?: string) {
  const purchaseWhere: any = {};
  const expenseWhere: any = {};
  if (fromDateStr || toDateStr) {
    purchaseWhere.purchaseDate = {};
    expenseWhere.date = {};
    if (fromDateStr) {
      purchaseWhere.purchaseDate.gte = new Date(fromDateStr);
      expenseWhere.date.gte = new Date(fromDateStr);
    }
    if (toDateStr) {
      purchaseWhere.purchaseDate.lte = new Date(toDateStr);
      expenseWhere.date.lte = new Date(toDateStr);
    }
  }

  const paymeters = await prisma.paymeter.findMany({
    include: {
      purchases: {
        where: purchaseWhere,
        include: {
          supplier: true,
          jobCard: {
            include: {
              vehicle: true
            }
          },
          // A purchase can also have later supplier payments. Those payments
          // must not be added to the amount originally advanced by this ledger.
          purchasePayments: true
        },
        orderBy: { purchaseDate: 'desc' }
      },
      expenses: {
        where: expenseWhere,
        orderBy: { date: 'desc' }
      },
      purchasePayments: {
        where: expenseWhere, // Reusing expenseWhere as it filters on 'date', same as purchasePayments
        include: {
          purchase: {
            include: {
              supplier: true,
            }
          }
        },
        orderBy: { date: 'desc' }
      }
    },
    orderBy: { name: 'asc' }
  });
  
  // Calculate dynamic spent amount for the selected date range
  return paymeters.map((pm: any) => {
    // We no longer sum purchase.grandTotal because all actual payments
    // (including initial ones) are recorded as PurchasePayments (supplierPaymentTotal).
    const expenseTotal = pm.expenses.reduce((acc: number, e: any) => acc + (e.amount || 0), 0);
    const allPurchasePaymentTotal = (pm.purchasePayments || []).reduce(
      (acc: number, payment: any) => acc + (payment.amount || 0),
      0,
    )
    const supplierPayments = (pm.purchasePayments || []).filter(
      (payment: any) => payment.pendingAmount > 0 || payment.paidAmount > 0,
    )

    return {
      ...pm,
      // `Purchase.paidAmount` includes supplier payments made later from the
      // supplier screen. Subtract those here so the purchase row represents
      // only its original paymeter advance.
      purchases: (pm.purchases || []).map((purchase: any) => {
        const purchaseSupplierPayments = (purchase.purchasePayments || []).filter(
          (payment: any) => payment.pendingAmount > 0 || payment.paidAmount > 0,
        )
        const laterSupplierPayments = purchaseSupplierPayments.reduce(
          (acc: number, payment: any) => acc + (payment.amount || 0),
          0,
        )

        return {
          ...purchase,
          paymeterAdvanceAmount: Math.max(0, purchase.paidAmount - laterSupplierPayments),
        }
      }),
      // Do not show the initial purchase-payment bookkeeping row as a
      // supplier payment. It has paidAmount=0 and pendingAmount=0.
      purchasePayments: supplierPayments,
      filteredSpentAmount: expenseTotal + allPurchasePaymentTotal
    }
  });
}

export async function getPaymetersDropdown() {
  return prisma.paymeter.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' }
  })
}

export async function createPaymeter(data: PaymeterFormValues) {
  const parsed = paymeterSchema.parse(data)

  const existing = await prisma.paymeter.findFirst({
    where: { name: { equals: parsed.name, mode: "insensitive" } },
    select: { id: true },
  })
  if (existing) throw new Error("Paymeter name already exists.")
  
  // Enforce spentAmount and initialSpentAmount are 0 on backend
  const paymeter = await prisma.paymeter.create({
    data: {
      name: parsed.name,
      spentAmount: 0,
      initialSpentAmount: 0,
    }
  })
  
  revalidatePath('/paymeters')
  return paymeter
}

export async function updatePaymeter(id: string, data: PaymeterFormValues) {
  const parsed = paymeterSchema.parse(data)

  const existing = await prisma.paymeter.findFirst({
    where: {
      name: { equals: parsed.name, mode: "insensitive" },
      id: { not: id },
    },
    select: { id: true },
  })
  if (existing) throw new Error("Paymeter name already exists.")
  
  const paymeter = await prisma.paymeter.update({
    where: { id },
    data: {
      name: parsed.name,
    }
  })
  
  revalidatePath('/paymeters')
  return paymeter
}

export async function deletePaymeter(id: string) {
  const purchases = await prisma.purchase.findMany({
    where: { paymentMethodId: id },
    include: {
      batches: {
        include: {
          jobCardParts: true
        }
      }
    }
  })
  
  const hasPending = purchases.some(p => p.pendingAmount > 0)
  if (hasPending) {
    throw new Error("Cannot delete this Paymeter because there are purchases with pending amounts.")
  }

  if (purchases.length > 0) {
    const purchaseIds = purchases.map(p => p.id)
    
    // Detach batches so inventory isn't lost
    await prisma.inventoryBatch.updateMany({
      where: { purchaseId: { in: purchaseIds } },
      data: { purchaseId: null }
    })

    await prisma.purchase.deleteMany({
      where: { paymentMethodId: id }
    })
  }

  await prisma.purchasePayment.deleteMany({
    where: { paymeterId: id }
  })
  
  await prisma.paymeter.delete({
    where: { id }
  })
  
  revalidatePath('/paymeters')
  return { success: true }
}

export async function settlePaymeter(id: string, amount: number) {
  if (amount <= 0) throw new Error("Amount must be greater than 0")
  
  const paymeter = await prisma.paymeter.update({
    where: { id },
    data: {
      spentAmount: { decrement: amount }
    }
  })
  
  revalidatePath('/paymeters')
  return paymeter
}

export async function payPurchasePayment(paymentId: string, amount: number) {
  if (amount <= 0) throw new Error("Amount must be greater than 0")
  
  const payment = await prisma.purchasePayment.findUnique({
    where: { id: paymentId }
  })

  if (!payment) {
    throw new Error("Payment not found")
  }

  if (amount > payment.pendingAmount) {
    throw new Error("Amount exceeds pending amount")
  }

  await prisma.$transaction(async (tx) => {
    await tx.purchasePayment.update({
      where: { id: paymentId },
      data: {
        paidAmount: { increment: amount },
        pendingAmount: { decrement: amount }
      }
    })

    await tx.paymeter.update({
      where: { id: payment.paymeterId },
      data: { spentAmount: { decrement: amount } }
    })
  })

  revalidatePath('/paymeters')
  return { success: true }
}
