"use server"

import prisma from "@/lib/prisma"
import { parseSettlementDate } from "@/lib/settlement-date"
import { ExpenseFormValues, expenseSchema } from "./schema"
import { revalidatePath } from "next/cache"
import { getCreatorName, requirePagePermission } from "@/lib/authorization"

export async function getExpenses(page = 1, search = "", fromDate?: string, toDate?: string) {
  await requirePagePermission("expenses", "view")
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
  await requirePagePermission("expenses", "view")
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
  await requirePagePermission("expenses", "create")
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
  revalidatePath('/reports')
  revalidatePath('/')
  revalidatePath('/paymeters')
  return expense
}

export async function updateExpense(id: string, data: ExpenseFormValues) {
  await requirePagePermission("expenses", "edit")
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
    if (oldExpense.paidAmount > 0 && (oldExpense.amount !== dbData.amount || oldExpense.paymeterId !== dbData.paymeterId || oldExpense.paymentMethod !== dbData.paymentMethod)) {
      throw new Error("This expense has reimbursements. Keep its amount and payment method unchanged to preserve settlement history.")
    }

    const adjustments = new Map<string, number>()
    if (oldExpense.paymeterId) adjustments.set(oldExpense.paymeterId, -oldExpense.amount)
    if (dbData.paymeterId) adjustments.set(dbData.paymeterId, (adjustments.get(dbData.paymeterId) || 0) + dbData.amount)
    for (const [paymeterId, delta] of [...adjustments].sort(([a], [b]) => a.localeCompare(b))) {
      if (delta < 0) {
        const adjusted = await tx.paymeter.updateMany({ where: { id: paymeterId, spentAmount: { gte: -delta } }, data: { spentAmount: { decrement: -delta } } })
        if (adjusted.count !== 1) throw new Error("Cannot change this expense because its paymeter balance has already been settled.")
      } else if (delta > 0) {
        await tx.paymeter.update({ where: { id: paymeterId }, data: { spentAmount: { increment: delta } } })
      }
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

    return newExpense
  }, { timeout: 30_000, isolationLevel: "Serializable" })
  
  revalidatePath('/expenses')
  revalidatePath('/reports')
  revalidatePath('/')
  revalidatePath('/paymeters')
  return expense
}

export async function deleteExpense(id: string) {
  await requirePagePermission("expenses", "delete")
  await prisma.$transaction(async (tx) => {
    const oldExpense = await tx.expense.findUnique({ where: { id } })
    if (!oldExpense) return
    if (oldExpense.paidAmount > 0) throw new Error("Cannot delete an expense with reimbursements. Its settlement history must be retained.")

    if (oldExpense.paymeterId) {
      const reversed = await tx.paymeter.updateMany({ where: { id: oldExpense.paymeterId, spentAmount: { gte: oldExpense.amount } }, data: { spentAmount: { decrement: oldExpense.amount } } })
      if (reversed.count !== 1) throw new Error("Cannot delete this expense because its paymeter balance has already been settled.")
    }

    await tx.expense.delete({ where: { id } })
  }, { timeout: 30_000, isolationLevel: "Serializable" })
  
  revalidatePath('/expenses')
  revalidatePath('/reports')
  revalidatePath('/')
  revalidatePath('/paymeters')
  return { success: true }
}

export async function payExpense(expenseId: string, amount: number, paymentDate: string) {
  await requirePagePermission("expenses", "edit")
  const date = parseSettlementDate(paymentDate)
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Amount must be greater than 0")

  const result = await prisma.$transaction(async (tx) => {
    const expense = await tx.expense.findUnique({ where: { id: expenseId } })
    if (!expense?.paymeterId) throw new Error("Expense not found or is not associated with a paymeter")
    const settled = await tx.expense.updateMany({
      where: { id: expenseId, paymeterId: expense.paymeterId, pendingAmount: { gte: amount } },
      data: { paidAmount: { increment: amount }, pendingAmount: { decrement: amount } },
    })
    if (settled.count !== 1) throw new Error("Payment exceeds the remaining expense balance. Refresh and try again.")
    const reimbursed = await tx.paymeter.updateMany({
      where: { id: expense.paymeterId, spentAmount: { gte: amount } },
      data: { spentAmount: { decrement: amount } },
    })
    if (reimbursed.count !== 1) throw new Error("Reimbursement exceeds the current paymeter balance.")
    await tx.paymeterSettlement.create({
      data: { paymeterId: expense.paymeterId!, amount, date, type: "EXPENSE_REIMBURSEMENT" }
    })

    return tx.expense.findUniqueOrThrow({ where: { id: expenseId } })
  }, { timeout: 30_000, isolationLevel: "Serializable" })

  revalidatePath('/expenses')
  revalidatePath('/reports')
  revalidatePath('/')
  revalidatePath('/paymeters')
  revalidatePath('/')
  revalidatePath('/reports')
  return result
}
