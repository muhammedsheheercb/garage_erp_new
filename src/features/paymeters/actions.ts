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
        },
        orderBy: { purchaseDate: 'desc' }
      },
      expenses: {
        where: expenseWhere,
        orderBy: { date: 'desc' }
      }
    },
    orderBy: { name: 'asc' }
  });
  
  // Calculate dynamic spent amount for the selected date range
  return paymeters.map((pm: any) => {
    const purchaseTotal = pm.purchases.reduce((acc: number, p: any) => acc + (p.grandTotal || 0), 0);
    const expenseTotal = pm.expenses.reduce((acc: number, e: any) => acc + (e.amount || 0), 0);
    return {
      ...pm,
      filteredSpentAmount: purchaseTotal + expenseTotal
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
