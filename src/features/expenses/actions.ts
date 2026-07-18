"use server"

import prisma from "@/lib/prisma"
import { ExpenseFormValues, expenseSchema } from "./schema"
import { revalidatePath } from "next/cache"

export async function getExpenses(page = 1, search = "") {
  const limit = 10;
  const skip = (page - 1) * limit;

  const where = search ? {
    OR: [
      { category: { contains: search } },
      { description: { contains: search } }
    ]
  } : {};

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
  
  const expense = await prisma.expense.create({
    data: parsed
  })
  
  revalidatePath('/expenses')
  return expense
}

export async function updateExpense(id: string, data: ExpenseFormValues) {
  const parsed = expenseSchema.parse(data)
  
  const expense = await prisma.expense.update({
    where: { id },
    data: parsed
  })
  
  revalidatePath('/expenses')
  return expense
}

export async function deleteExpense(id: string) {
  await prisma.expense.delete({
    where: { id }
  })
  
  revalidatePath('/expenses')
  return { success: true }
}
