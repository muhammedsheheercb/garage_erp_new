"use server"

import prisma from "@/lib/prisma"
import { PaymeterFormValues, paymeterSchema } from "./schema"
import { revalidatePath } from "next/cache"

export async function getPaymeters(fromDateStr?: string, toDateStr?: string) {
  const purchaseWhere: any = {};
  if (fromDateStr || toDateStr) {
    purchaseWhere.purchaseDate = {};
    if (fromDateStr) purchaseWhere.purchaseDate.gte = new Date(fromDateStr);
    if (toDateStr) purchaseWhere.purchaseDate.lte = new Date(toDateStr);
  }

  const paymeters = await prisma.paymeter.findMany({
    include: {
      purchases: {
        where: purchaseWhere,
        include: {
          supplier: true,
        },
        orderBy: { purchaseDate: 'desc' }
      }
    },
    orderBy: { name: 'asc' }
  });
  
  // Calculate dynamic spent amount for the selected date range
  return paymeters.map((pm: any) => ({
    ...pm,
    filteredSpentAmount: pm.purchases.reduce((acc: number, p: any) => acc + (p.grandTotal || 0), 0)
  }));
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
  // Check if purchases or payments are associated
  const count = await prisma.purchase.count({
    where: { paymentMethodId: id }
  })
  
  if (count > 0) {
    throw new Error("Cannot delete paymeter with associated purchases.")
  }
  
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
