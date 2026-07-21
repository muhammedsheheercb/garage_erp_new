"use server"

import prisma from "@/lib/prisma"
import type { Prisma } from "@prisma/client"
import { SupplierFormValues, supplierSchema, SupplierPaymentFormValues, supplierPaymentSchema } from "./schema"
import { revalidatePath } from "next/cache"

const directPaymentNames = {
  CASH: "Direct Cash",
  BANK_TRANSFER: "Direct Bank Transfer",
  CARD: "Direct Card",
  UPI: "Direct UPI",
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

export async function getSuppliers(page = 1, search = "") {
  const limit = 10;
  const skip = (page - 1) * limit;

  const where = {
    OR: [
      { name: { contains: search } },
      { contact: { contains: search } },
      { email: { contains: search } },
    ]
  };

  const [data, total] = await Promise.all([
    prisma.supplier.findMany({
      where,
      skip,
      take: limit,

      include: {
        _count: {
          select: { purchases: true }
        }
      },
      orderBy: { name: 'asc' }
    }),
    prisma.supplier.count({ where })
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

export async function getSupplierDetails(id: string) {
  const [supplier, paymentMethods] = await Promise.all([
    prisma.supplier.findUnique({
    where: { id },
    include: {
      purchases: {
        include: {
          items: { include: { inventory: true } },
          paymentMethod: { select: { id: true, name: true } },
          purchasePayments: {
            include: { paymeter: { select: { id: true, name: true } } },
            orderBy: { date: 'desc' },
          },
        },
      },
      payments: {
        orderBy: { date: 'desc' }
      }
    }
    }),
    prisma.paymeter.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return supplier ? { ...supplier, paymentMethods } : null
}

export async function createSupplier(data: SupplierFormValues) {
  const parsed = supplierSchema.parse(data)
  
  const supplier = await prisma.supplier.create({
    data: {
      name: parsed.name,
      contact: parsed.contact || "",
      email: parsed.email || "",
      address: parsed.address || "",
    }
  })
  
  revalidatePath('/suppliers')
  return supplier
}

export async function updateSupplier(id: string, data: SupplierFormValues) {
  const parsed = supplierSchema.parse(data)
  
  const supplier = await prisma.supplier.update({
    where: { id },
    data: {
      name: parsed.name,
      contact: parsed.contact || "",
      email: parsed.email || "",
      address: parsed.address || "",
    }
  })
  
  revalidatePath('/suppliers')
  return supplier
}

export async function deleteSupplier(id: string) {
  const count = await prisma.purchase.count({
    where: { supplierId: id }
  })
  
  if (count > 0) {
    throw new Error("Cannot delete supplier because they have associated purchases.")
  }

  await prisma.$transaction([
    prisma.supplierPayment.deleteMany({
      where: { supplierId: id }
    }),
    prisma.supplier.delete({
      where: { id }
    })
  ])
  
  revalidatePath('/suppliers')
  return { success: true }
}

export async function createSupplierPayment(supplierId: string, data: SupplierPaymentFormValues) {
  const parsed = supplierPaymentSchema.parse(data)

  const purchase = await prisma.purchase.findFirst({
    where: { id: parsed.purchaseId, supplierId },
    select: { id: true, pendingAmount: true, paymentMethodId: true },
  })

  if (!purchase) {
    throw new Error("The selected purchase bill does not belong to this supplier.")
  }

  if (parsed.amount > purchase.pendingAmount) {
    throw new Error(`Payment amount cannot exceed the outstanding balance of ${purchase.pendingAmount.toFixed(3)} OMR.`)
  }

  const payment = await prisma.$transaction(async (tx) => {
    const selectedPaymeterId = parsed.paymentSource === "PAYMETER"
      ? parsed.paymeterId!
      : await getDirectPaymeterId(tx, parsed.directPaymentMethod!)

    const createdPayment = await tx.purchasePayment.create({
      data: {
        purchaseId: purchase.id,
        paymeterId: selectedPaymeterId,
        amount: parsed.amount,
      },
    })

    await tx.purchase.update({
      where: { id: purchase.id },
      data: {
        paidAmount: { increment: parsed.amount },
        pendingAmount: { decrement: parsed.amount },
      },
    })

    await tx.paymeter.update({
      where: { id: purchase.paymentMethodId },
      data: { spentAmount: { decrement: parsed.amount } },
    })

    return createdPayment
  })
  
  revalidatePath('/suppliers')
  revalidatePath('/purchases')
  revalidatePath('/paymeters')
  return payment
}

export async function deletePurchasePayment(paymentId: string) {
  const payment = await prisma.purchasePayment.findUnique({
    where: { id: paymentId },
    include: { purchase: { select: { paymentMethodId: true } } },
  })

  if (!payment) throw new Error("Payment not found.")

  await prisma.$transaction(async (tx) => {
    await tx.purchasePayment.delete({ where: { id: paymentId } })
    await tx.purchase.update({
      where: { id: payment.purchaseId },
      data: {
        paidAmount: { decrement: payment.amount },
        pendingAmount: { increment: payment.amount },
      },
    })
    await tx.paymeter.update({
      where: { id: payment.purchase.paymentMethodId },
      data: { spentAmount: { increment: payment.amount } },
    })
  })

  revalidatePath('/suppliers')
  revalidatePath('/purchases')
  revalidatePath('/paymeters')
  return { success: true }
}

export async function deleteSupplierPayment(paymentId: string) {
  await prisma.supplierPayment.delete({
    where: { id: paymentId }
  })
  revalidatePath('/suppliers')
  return { success: true }
}
