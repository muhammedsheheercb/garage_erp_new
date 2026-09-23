"use server"

import prisma from "@/lib/prisma"
import { PaymentFormValues, paymentSchema } from "./schema"
import { revalidatePath } from "next/cache"
import { getCreatorName } from "@/lib/authorization"

export async function getPayments(page = 1, search = "", fromDate?: string, toDate?: string) {
  const limit = 5;
  const skip = (page - 1) * limit;

  const where: any = search ? {
    OR: [
      { jobCard: { customer: { name: { contains: search, mode: "insensitive" } } } },
      { jobCard: { vehicle: { plateNumber: { contains: search, mode: "insensitive" } } } },
    ]
  } : {};

  if (fromDate || toDate) {
    where.createdAt = {};
    if (fromDate) where.createdAt.gte = new Date(fromDate);
    if (toDate) where.createdAt.lte = new Date(toDate);
  }

  const [data, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      skip,
      take: limit,
      include: {
        jobCard: {
          include: {
            customer: { select: { id: true, name: true } },
            vehicle: { select: { plateNumber: true } },
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.payment.count({ where })
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

export async function getPendingInvoices(page = 1, search = "") {
  const limit = 5
  const skip = (page - 1) * limit
  const where: any = {}
  if (search.trim()) {
    where.OR = [
      { customer: { name: { contains: search.trim(), mode: "insensitive" } } },
      { vehicle: { plateNumber: { contains: search.trim(), mode: "insensitive" } } },
    ]
  }

  const [data, total] = await Promise.all([
    prisma.jobCard.findMany({
      where,
      skip,
      take: limit,
      include: {
        customer: true,
        payments: true,
        vehicle: true,
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.jobCard.count({ where })
  ])

  return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } }
}

export async function getPendingInvoicesDropdown() {
  const invoices = await prisma.jobCard.findMany({
    include: {
      customer: true,
      payments: true,
      vehicle: { select: { plateNumber: true } },
    },
    orderBy: { createdAt: 'asc' }
  })

  return invoices.filter(inv => inv.grandTotal > inv.payments.reduce((acc, p) => acc + p.amount, 0)).map(inv => {
    const paidAmount = inv.payments.reduce((acc, p) => acc + p.amount, 0)
    const due = inv.grandTotal - paidAmount
    return {
      id: inv.id,
      label: `JOB-${inv.id.split('-')[0].toUpperCase()} - ${inv.customer.name} - ${inv.vehicle.plateNumber} - Due: ${(due)} OMR`,
      dueAmount: due
    }
  })
}

export async function createPayment(data: PaymentFormValues) {
  const parsed = paymentSchema.parse(data)
  const discountAmount = parsed.discountAmount || 0
  
  const result = await prisma.$transaction(async (tx) => {
    const invoiceBeforePayment = await tx.jobCard.findUnique({
      where: { id: parsed.jobCardId },
      include: { payments: true },
    })

    if (!invoiceBeforePayment) {
      throw new Error("The selected Job Card no longer exists.")
    }

    const alreadyPaid = invoiceBeforePayment.payments.reduce(
      (total, payment) => total + payment.amount,
      0,
    )
    const dueAmount = Math.max(0, invoiceBeforePayment.grandTotal - alreadyPaid)
    if (parsed.amount + discountAmount > dueAmount) {
      throw new Error(`Payment amount and discount cannot exceed the outstanding balance of ${(dueAmount)} OMR.`)
    }

    const creatorName = await getCreatorName()
    const { discountAmount: _discountAmount, ...paymentData } = parsed

    const payment = await tx.payment.create({
      data: {
        ...paymentData,
        jobCardId: parsed.jobCardId,
        createdBy: creatorName,
      }
    })

    if (discountAmount > 0) {
      await tx.jobCard.update({
        where: { id: parsed.jobCardId },
        data: {
          discount: { increment: discountAmount },
          grandTotal: { decrement: discountAmount },
        },
      })
    }

    return payment
  })
  
  revalidatePath('/payments')
  revalidatePath('/jobcards')
  return result
}

export async function getPaymentBill(id: string) {
  return prisma.payment.findUnique({
    where: { id },
    include: {
      jobCard: { include: { customer: true, vehicle: true, services: { include: { service: true } }, parts: { include: { batch: { include: { inventory: true } } } }, payments: { orderBy: { createdAt: "asc" } } } },
    },
  })
}

export async function getJobCardBill(id: string) {
  return prisma.jobCard.findUnique({
    where: { id },
    include: {
      customer: true,
      vehicle: true,
      services: { include: { service: true } },
      parts: { include: { batch: { include: { inventory: true } } } },
      payments: { orderBy: { createdAt: "asc" } },
    },
  })
}
