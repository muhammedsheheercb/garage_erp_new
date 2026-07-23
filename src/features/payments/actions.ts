"use server"

import prisma from "@/lib/prisma"
import { PaymentFormValues, paymentSchema } from "./schema"
import { revalidatePath } from "next/cache"

export async function getPayments(page = 1, search = "") {
  const limit = 10;
  const skip = (page - 1) * limit;

  const where = search ? {
    OR: [
      { invoice: { id: { contains: search } } },
      { invoice: { customer: { name: { contains: search } } } }
    ]
  } : {};

  const [data, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      skip,
      take: limit,
      include: {
        invoice: {
          include: {
            customer: { select: { id: true, name: true } },
            jobCard: { include: { vehicle: { select: { plateNumber: true } } } }
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

export async function getPendingInvoices() {
  return prisma.invoice.findMany({
    where: {
      status: { in: ['UNPAID', 'PARTIAL'] }
    },
    include: {
      customer: true,
      payments: true,
      jobCard: { include: { vehicle: true } }
    },
    orderBy: { createdAt: 'asc' }
  })
}

export async function getPendingInvoicesDropdown() {
  const invoices = await prisma.invoice.findMany({
    where: {
      status: { in: ['UNPAID', 'PARTIAL'] }
    },
    include: {
      customer: true,
      payments: true,
      jobCard: { include: { vehicle: { select: { plateNumber: true } } } },
    },
    orderBy: { createdAt: 'asc' }
  })

  return invoices.map(inv => {
    const paidAmount = inv.payments.reduce((acc, p) => acc + p.amount, 0)
    const due = inv.grandTotal - paidAmount
    return {
      id: inv.id,
      label: `INV-${inv.id.split('-')[0].toUpperCase()} - ${inv.customer.name} - ${inv.jobCard.vehicle.plateNumber} - Due: ${due.toFixed(3)} OMR`,
      dueAmount: due
    }
  })
}

export async function createPayment(data: PaymentFormValues) {
  const parsed = paymentSchema.parse(data)
  
  const result = await prisma.$transaction(async (tx) => {
    const invoiceBeforePayment = await tx.invoice.findUnique({
      where: { id: parsed.invoiceId },
      include: { payments: true },
    })

    if (!invoiceBeforePayment) {
      throw new Error("The selected invoice no longer exists.")
    }

    const alreadyPaid = invoiceBeforePayment.payments.reduce(
      (total, payment) => total + payment.amount,
      0,
    )
    const dueAmount = Math.max(0, invoiceBeforePayment.grandTotal - alreadyPaid)
    if (parsed.amount > dueAmount) {
      throw new Error(`Payment amount cannot exceed the outstanding balance of ${dueAmount.toFixed(3)} OMR.`)
    }

    const payment = await tx.payment.create({
      data: parsed
    })

    const invoice = await tx.invoice.findUnique({
      where: { id: parsed.invoiceId },
      include: { payments: true }
    })

    if (invoice) {
      // Calculate total paid across all payments
      const totalPaid = invoice.payments.reduce((acc, p) => acc + p.amount, 0)
      
      let newStatus = invoice.status
      if (totalPaid >= invoice.grandTotal) {
        newStatus = "PAID"
      } else if (totalPaid > 0) {
        newStatus = "PARTIAL"
      }
      
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: newStatus }
      })
    }
    return payment
  })
  
  revalidatePath('/payments')
  revalidatePath('/invoices')
  return result
}
