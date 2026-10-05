"use server"

import prisma from "@/lib/prisma"
import { requirePagePermission } from "@/lib/authorization"
import type { Prisma } from "@prisma/client"
import { SupplierFormValues, supplierSchema, SupplierPaymentFormValues, supplierPaymentSchema } from "./schema"
import { revalidatePath } from "next/cache"
import { userPaymeterWhere } from "@/lib/paymeter"

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

export async function getSuppliers(page = 1, search = "", fromDateStr?: string, toDateStr?: string) {
  await requirePagePermission("suppliers", "view")
  const limit = 5;
  const skip = (page - 1) * limit;

  const where: any = {
    OR: [
      { name: { contains: search, mode: "insensitive" } },
      { contact: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ]
  };

  if (fromDateStr || toDateStr) {
    where.createdAt = {};
    if (fromDateStr) where.createdAt.gte = new Date(fromDateStr);
    if (toDateStr) where.createdAt.lte = new Date(toDateStr);
  }

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
  await requirePagePermission("suppliers", "view")
  const [supplier, paymentMethods] = await Promise.all([
    prisma.supplier.findUnique({
    where: { id },
    include: {
      purchases: {
        orderBy: [{ purchaseDate: 'desc' }, { createdAt: 'desc' }],
        include: {
          items: { include: { inventory: true } },
          paymentMethod: { select: { id: true, name: true } },
          purchasePayments: {
            include: { paymeter: { select: { id: true, name: true } } },
            orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
          },
        },
      },
      payments: {
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }]
      }
    }
    }),
    prisma.paymeter.findMany({
      where: userPaymeterWhere,
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return supplier ? { ...supplier, paymentMethods } : null
}

export async function createSupplier(data: SupplierFormValues) {
  await requirePagePermission("suppliers", "create")
  const parsed = supplierSchema.parse(data)
  
  const existingName = await prisma.supplier.findFirst({
    where: { name: { equals: parsed.name, mode: 'insensitive' } }
  })
  if (existingName) {
    return { success: false as const, message: "This supplier name is already used." }
  }

  if (parsed.contact) {
    const existingContact = await prisma.supplier.findFirst({
      where: { contact: parsed.contact }
    })
    if (existingContact) {
      return { success: false as const, message: "This contact number is already used by another supplier." }
    }
  }

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
  await requirePagePermission("suppliers", "edit")
  const parsed = supplierSchema.parse(data)
  
  const existingName = await prisma.supplier.findFirst({
    where: { 
      name: { equals: parsed.name, mode: 'insensitive' },
      id: { not: id }
    }
  })
  if (existingName) {
    return { success: false as const, message: "This supplier name is already used." }
  }

  if (parsed.contact) {
    const existingContact = await prisma.supplier.findFirst({
      where: { 
        contact: parsed.contact,
        id: { not: id }
      }
    })
    if (existingContact) {
      return { success: false as const, message: "This contact number is already used by another supplier." }
    }
  }

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
  await requirePagePermission("suppliers", "delete")
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
  await requirePagePermission("suppliers", "create")
  const parsed = supplierPaymentSchema.parse(data)

  const purchase = await prisma.purchase.findFirst({
    where: { id: parsed.purchaseId, supplierId },
    select: { id: true, pendingAmount: true, paymentMethodId: true },
  })

  if (!purchase) {
    throw new Error("The selected purchase bill does not belong to this supplier.")
  }

  if (parsed.amount > purchase.pendingAmount) {
    throw new Error(`Payment amount cannot exceed the outstanding balance of ${(purchase.pendingAmount)} OMR.`)
  }

  const payment = await prisma.$transaction(async (tx) => {
    const settled = await tx.purchase.updateMany({
      where: { id: purchase.id, supplierId, pendingAmount: { gte: parsed.amount } },
      data: { paidAmount: { increment: parsed.amount }, pendingAmount: { decrement: parsed.amount } },
    })
    if (settled.count !== 1) throw new Error("The purchase balance changed. Refresh it before making another payment.")
    const selectedPaymeterId = parsed.paymentSource === "PAYMETER"
      ? parsed.paymeterId!
      : await getDirectPaymeterId(tx, parsed.directPaymentMethod!)

    const createdPayment = await tx.purchasePayment.create({
      data: {
        purchaseId: purchase.id,
        paymeterId: selectedPaymeterId,
        amount: parsed.amount,
        pendingAmount: parsed.amount,
        date: new Date(parsed.paymentDate),
      },
    })


    await tx.paymeter.update({
      where: { id: selectedPaymeterId },
      data: { spentAmount: { increment: parsed.amount } },
    })

    return createdPayment
  })
  
  revalidatePath('/suppliers')
  revalidatePath('/purchases')
  revalidatePath('/paymeters')
  revalidatePath('/')
  revalidatePath('/reports')
  return payment
}

export async function deletePurchasePayment(paymentId: string) {
  await requirePagePermission("suppliers", "delete")
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
      where: { id: payment.paymeterId },
      data: { spentAmount: { decrement: payment.amount } },
    })
  })

  revalidatePath('/suppliers')
  revalidatePath('/purchases')
  revalidatePath('/paymeters')
  return { success: true }
}

export async function deleteSupplierPayment(paymentId: string) {
  await requirePagePermission("suppliers", "delete")
  await prisma.supplierPayment.delete({
    where: { id: paymentId }
  })
  revalidatePath('/suppliers')
  return { success: true }
}
