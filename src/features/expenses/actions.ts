"use server"

import prisma from "@/lib/prisma"
import { ExpenseFormValues, expenseSchema } from "./schema"
import { revalidatePath } from "next/cache"
import { getCreatorName } from "@/lib/authorization"

export async function getExpenses(page = 1, search = "", fromDate?: string, toDate?: string) {
  const limit = 5;
  const skip = (page - 1) * limit;

  const where: any = search ? {
    OR: [
      { category: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } }
    ]
  } : {};

  if (fromDate || toDate) {
    where.date = {};
    if (fromDate) where.date.gte = new Date(fromDate);
    if (toDate) where.date.lte = new Date(toDate);
  }

  const [data, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      skip,
      take: limit,
      orderBy: { date: 'desc' }
    }),
    prisma.expense.count({ where })
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

export async function getMonthlyExpenseReport(year: number, month: number) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  const expenses = await prisma.expense.findMany({
    where: {
      date: {
        gte: startDate,
        lte: endDate,
      }
    }
  });

  const categoryTotals = expenses.reduce((acc, expense) => {
    acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
    return acc;
  }, {} as Record<string, number>);

  const total = Object.values(categoryTotals).reduce((sum, val) => sum + val, 0);

  return {
    expenses,
    categoryTotals,
    total
  }
}

export async function createExpense(data: ExpenseFormValues) {
  const parsed = expenseSchema.parse(data)
  const { paymentType, ...dbData } = parsed
  if (paymentType === "PAYMETER") {
    dbData.paymentMethod = "PAYMETER"
  } else {
    dbData.paymeterId = null
  }
  
  const creatorName = await getCreatorName()

  const expense = await prisma.$transaction(async (tx) => {
    const dataToSave = {
      ...dbData,
      pendingAmount: paymentType === "PAYMETER" ? dbData.amount : 0,
      createdBy: creatorName,
    }
    
    const newExpense = await tx.expense.create({
      data: dataToSave
    })
    
    if (dbData.paymeterId) {
      await tx.paymeter.update({
        where: { id: dbData.paymeterId },
        data: { spentAmount: { increment: dbData.amount } }
      })
    }
    return newExpense
  })
  
  revalidatePath('/expenses')
  revalidatePath('/paymeters')
  return expense
}

export async function updateExpense(id: string, data: ExpenseFormValues) {
  const parsed = expenseSchema.parse(data)
  const { paymentType, ...dbData } = parsed
  if (paymentType === "PAYMETER") {
    dbData.paymentMethod = "PAYMETER"
  } else {
    dbData.paymeterId = null
  }
  
  const expense = await prisma.$transaction(async (tx) => {
    const oldExpense = await tx.expense.findUnique({ where: { id } })
    if (!oldExpense) throw new Error("Expense not found")

    if (oldExpense.paymeterId) {
      await tx.paymeter.update({
        where: { id: oldExpense.paymeterId },
        data: { spentAmount: { decrement: oldExpense.amount } }
      })
    }

    const newPendingAmount = paymentType === "PAYMETER"
      ? Math.max(0, oldExpense.pendingAmount + (dbData.amount - oldExpense.amount))
      : 0;

    const newExpense = await tx.expense.update({
      where: { id },
      data: {
        ...dbData,
        pendingAmount: newPendingAmount
      }
    })

    if (dbData.paymeterId) {
      await tx.paymeter.update({
        where: { id: dbData.paymeterId },
        data: { spentAmount: { increment: dbData.amount } }
      })
    }
    
    return newExpense
  })
  
  revalidatePath('/expenses')
  revalidatePath('/paymeters')
  return expense
}

export async function deleteExpense(id: string) {
  await prisma.$transaction(async (tx) => {
    const oldExpense = await tx.expense.findUnique({ where: { id } })
    if (!oldExpense) return

    if (oldExpense.paymeterId) {
      await tx.paymeter.update({
        where: { id: oldExpense.paymeterId },
        data: { spentAmount: { decrement: oldExpense.amount } }
      })
    }

    await tx.expense.delete({ where: { id } })
  })
  
  revalidatePath('/expenses')
  revalidatePath('/paymeters')
  return { success: true }
}

export async function payExpense(expenseId: string, amount: number) {
  if (amount <= 0) throw new Error("Amount must be greater than 0")

  const expense = await prisma.expense.findUnique({ where: { id: expenseId } })
  if (!expense) throw new Error("Expense not found")

  if (amount > expense.pendingAmount) {
    throw new Error("Payment cannot exceed pending amount")
  }

  if (!expense.paymeterId) {
    throw new Error("Expense is not associated with a paymeter")
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1. Update Expense amounts
    const updatedExpense = await tx.expense.update({
      where: { id: expenseId },
      data: {
        paidAmount: { increment: amount },
        pendingAmount: { decrement: amount }
      }
    })

    // 2. Update Paymeter spent amount (settling the expense reduces what's owed)
    await tx.paymeter.update({
      where: { id: expense.paymeterId! },
      data: { spentAmount: { decrement: amount } }
    })

    return updatedExpense
  })

  revalidatePath('/expenses')
  revalidatePath('/paymeters')
  return result
}
