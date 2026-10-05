"use server"

import prisma from "@/lib/prisma"
import { requirePagePermission } from "@/lib/authorization"
import { parseSettlementDate } from "@/lib/settlement-date"
import { PaymeterFormValues, paymeterSchema } from "./schema"
import { revalidatePath } from "next/cache"
import { userPaymeterWhere } from "@/lib/paymeter"

export async function getPaymeters(page = 1, fromDateStr?: string, toDateStr?: string, search = "") {
  await requirePagePermission("paymeters", "view")
  const limit = 5
  const skip = (page - 1) * limit
  const purchaseWhere: any = {};
  const expenseWhere: any = {};
  const purchasePaymentWhere: any = {};
  if (fromDateStr || toDateStr) {
    purchaseWhere.purchaseDate = {};
    expenseWhere.date = {};
    purchasePaymentWhere.date = {};
    if (fromDateStr) {
      purchaseWhere.purchaseDate.gte = new Date(fromDateStr);
      expenseWhere.date.gte = new Date(fromDateStr);
      purchasePaymentWhere.date.gte = new Date(fromDateStr);
    }
    if (toDateStr) {
      purchaseWhere.purchaseDate.lte = new Date(toDateStr);
      expenseWhere.date.lte = new Date(toDateStr);
      purchasePaymentWhere.date.lte = new Date(toDateStr);
    }
  }

  const nameWhere = search.trim() ? { contains: search.trim(), mode: "insensitive" as const } : undefined
  const where: any = { ...userPaymeterWhere, ...(nameWhere ? { name: nameWhere } : {}) }

  // When a date range is selected, return only paymeters that had a
  // transaction during that range. The nested relation filters below keep
  // the displayed transaction details and totals in the same range.
  if (fromDateStr || toDateStr) {
    where.OR = [
      { purchases: { some: purchaseWhere } },
      { expenses: { some: expenseWhere } },
      { purchasePayments: { some: purchasePaymentWhere } },
    ]
  }
  const [paymeters, total] = await Promise.all([
    prisma.paymeter.findMany({
    skip,
    take: limit,
    where,
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
        where: purchasePaymentWhere,
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
    }),
    prisma.paymeter.count({ where })
  ])
  
  // Calculate dynamic spent amount for the selected date range
  const data = paymeters.map((pm: any) => {
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
  return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } }
}

export async function getPaymetersDropdown() {
  await requirePagePermission("paymeters", "view")
  return prisma.paymeter.findMany({
    where: userPaymeterWhere,
    select: { id: true, name: true },
    orderBy: { name: 'asc' }
  })
}

export async function createPaymeter(data: PaymeterFormValues) {
  await requirePagePermission("paymeters", "create")
  const parsed = paymeterSchema.parse(data)

  const existing = await prisma.paymeter.findFirst({
    where: { name: { equals: parsed.name, mode: "insensitive" } },
    select: { id: true },
  })
  if (existing) return { success: false as const, message: "Paymeter name already exists." }
  
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
  await requirePagePermission("paymeters", "edit")
  const parsed = paymeterSchema.parse(data)

  const existing = await prisma.paymeter.findFirst({
    where: {
      name: { equals: parsed.name, mode: "insensitive" },
      id: { not: id },
    },
    select: { id: true },
  })
  if (existing) return { success: false as const, message: "Paymeter name already exists." }
  
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
  await requirePagePermission("paymeters", "delete")
  const result = await prisma.$transaction(async tx => {
    const paymeter = await tx.paymeter.findUnique({ where: { id }, include: { _count: { select: { purchases: true, purchasePayments: true, expenses: true, settlements: true } } } })
    if (!paymeter) return { success: false, message: "Paymeter not found." }
    if (paymeter.spentAmount !== 0 || paymeter.initialSpentAmount !== 0 || Object.values(paymeter._count).some(count => count > 0)) {
      return { success: false, message: "Cannot delete a paymeter with a balance or transaction history." }
    }
    await tx.paymeter.delete({ where: { id } })
    return { success: true }
  }, { timeout: 30_000, isolationLevel: "Serializable" })

  revalidatePath('/paymeters')
  return result
}

export async function settlePaymeter(id: string, amount: number) {
  await requirePagePermission("paymeters", "edit")
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Amount must be greater than 0")
  const paymeter = await prisma.$transaction(async tx => {
    const updated = await tx.paymeter.updateMany({ where: { id, spentAmount: { gte: amount } },
      data: { spentAmount: { decrement: amount } },
    })
    if (updated.count !== 1) throw new Error("Reimbursement cannot exceed the current paymeter balance. Refresh and try again.")
    await tx.paymeterSettlement.create({ data: { paymeterId: id, amount, type: "MANUAL_REIMBURSEMENT" } })
    return tx.paymeter.findUniqueOrThrow({ where: { id } })
  }, { timeout: 30_000 })

  revalidatePath('/paymeters')
  return paymeter
}

export async function payPurchasePayment(paymentId: string, amount: number, paymentDate: string) {
  await requirePagePermission("paymeters", "edit")
  const date = parseSettlementDate(paymentDate)
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Amount must be greater than 0")
  
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
    const updated = await tx.purchasePayment.updateMany({
      where: { id: paymentId, pendingAmount: { gte: amount } },
      data: { paidAmount: { increment: amount }, pendingAmount: { decrement: amount } },
    })
    if (updated.count !== 1) throw new Error("The reimbursement balance changed. Refresh and try again.")

    const reimbursed = await tx.paymeter.updateMany({
      where: { id: payment.paymeterId, spentAmount: { gte: amount } },
      data: { spentAmount: { decrement: amount } }
    })
    if (reimbursed.count !== 1) throw new Error("Reimbursement cannot exceed the current paymeter balance. Refresh and try again.")
    await tx.paymeterSettlement.create({
      data: { paymeterId: payment.paymeterId, amount, date, type: "SUPPLIER_REIMBURSEMENT" }
    })
  })

  revalidatePath('/paymeters')
  revalidatePath('/')
  revalidatePath('/reports')
  return { success: true }
}
