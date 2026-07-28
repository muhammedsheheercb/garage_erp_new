"use server"

import prisma from "@/lib/prisma"
import { ExpenseFormValues, expenseSchema } from "./schema"
import { revalidatePath } from "next/cache"

export async function getExpenses(page = 1, search = "", fromDate?: string, toDate?: string) {
  const limit = 10;
  const skip = (page - 1) * limit;

  const where: any = search ? {
    OR: [
      { category: { contains: search } },
      { description: { contains: search } }
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
  
  const expense = await prisma.$transaction(async (tx) => {
    const newExpense = await tx.expense.create({
      data: dbData
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

    const newExpense = await tx.expense.update({
      where: { id },
      data: dbData
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
  return { success: true }
}
