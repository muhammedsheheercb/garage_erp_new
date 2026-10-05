"use server"

import prisma from "@/lib/prisma"
import { PaymentFormValues, paymentSchema } from "./schema"
import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"
import { getCreatorName, requirePagePermission } from "@/lib/authorization"

export async function getPayments(page = 1, search = "", fromDate?: string, toDate?: string) {
  await requirePagePermission("payments")
  const limit = 5;
  const skip = (page - 1) * limit;

  const where: any = search ? {
    OR: [
      { jobCard: { customer: { name: { contains: search, mode: "insensitive" } } } },
      { jobCard: { vehicle: { plateNumber: { contains: search, mode: "insensitive" } } } },
    ]
  } : {};

  if (fromDate || toDate) {
    where.paymentDate = {};
    if (fromDate) where.paymentDate.gte = new Date(fromDate);
    if (toDate) where.paymentDate.lte = new Date(toDate);
  }

  const saleWhere: Prisma.DirectSaleWhereInput = {
    ...(search ? { OR: [
      { customerName: { contains: search, mode: "insensitive" } },
      { vehicleNumber: { contains: search, mode: "insensitive" } },
      { customerMobile: { contains: search, mode: "insensitive" } },
    ] } : {}),
    ...((fromDate || toDate) ? { saleDate: {
      ...(fromDate ? { gte: new Date(fromDate) } : {}),
      ...(toDate ? { lte: new Date(toDate) } : {}),
    } } : {}),
  }

  // Each source supplies enough rows to build the requested combined page.
  const [data, paymentTotal, sales, saleTotal] = await Promise.all([
    prisma.payment.findMany({
      where,
      take: skip + limit,
      include: {
        jobCard: {
          include: {
            customer: { select: { id: true, name: true } },
            vehicle: { select: { plateNumber: true } },
            payments: { select: { id: true, amount: true, createdAt: true, totalPaidAtPayment: true, balanceAfterPayment: true, grandTotalAtPayment: true } },
            parts: { where: { isPending: true }, select: { id: true } },
          }
        }
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
    }),
    prisma.payment.count({ where }),
    prisma.directSale.findMany({
      where: saleWhere,
      take: skip + limit,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    }),
    prisma.directSale.count({ where: saleWhere }),
  ]);

  const paymentsWithBalances = data.map((payment) => {
    const transactionHistory = [...(payment.jobCard?.payments ?? [])].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    const transactionIndex = transactionHistory.findIndex((item) => item.id === payment.id)
    const fallbackTotalPaid = transactionHistory.slice(0, transactionIndex + 1).reduce((sum, item) => sum + item.amount, 0)
    const totalPaid = payment.totalPaidAtPayment ?? fallbackTotalPaid
    const grandTotal = payment.grandTotalAtPayment ?? payment.jobCard?.grandTotal ?? 0
    const balanceAmount = payment.balanceAfterPayment ?? Math.max(0, grandTotal - totalPaid)
    const latestTransaction = transactionHistory[transactionHistory.length - 1]

    return {
      ...payment,
      source: "jobCard" as const,
      customerName: payment.jobCard?.customer.name ?? "—",
      vehicleNumber: payment.jobCard?.vehicle.plateNumber ?? "—",
      paymentAmount: payment.amount,
      totalPaid,
      balanceAmount,
      isLatestTransaction: latestTransaction?.id === payment.id,
      hasPendingParts: Boolean(payment.jobCard?.parts.length),
    }
  })

  const salePayments = sales.map((sale) => ({
    id: sale.id,
    source: "directSale" as const,
    paymentDate: sale.saleDate,
    createdAt: sale.createdAt,
    createdBy: sale.createdBy,
    customerName: sale.customerName,
    vehicleNumber: sale.vehicleNumber,
    method: sale.paymentMethod ?? "Unspecified",
    receivedMethod: null,
    jobCard: null,
    paymentAmount: sale.grandTotal,
    totalPaid: sale.grandTotal,
    balanceAmount: 0,
    isLatestTransaction: true,
    hasPendingParts: false,
  }))
  const history = [...paymentsWithBalances, ...salePayments].sort((a, b) =>
    b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id) || b.source.localeCompare(a.source),
  )
  const total = paymentTotal + saleTotal

  return {
    data: history.slice(skip, skip + limit),
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
  const where: any = {}
  if (search.trim()) {
    where.OR = [
      { customer: { name: { contains: search.trim(), mode: "insensitive" } } },
      { vehicle: { plateNumber: { contains: search.trim(), mode: "insensitive" } } },
    ]
  }

  const invoices = await prisma.jobCard.findMany({
      where,
      include: {
        customer: true,
        payments: true,
        vehicle: true,
        parts: { where: { isPending: true }, select: { id: true } },
      },
      orderBy: { createdAt: 'desc' }
    })

  // Filter before pagination so settled cards do not occupy pages or inflate the count.
  const payableInvoices = invoices.filter(invoice =>
    invoice.grandTotal > invoice.payments.reduce((total, payment) => total + payment.amount, 0)
  )
  const total = payableInvoices.length
  const totalPages = Math.ceil(total / limit)
  const currentPage = Math.max(1, Math.min(page, totalPages || 1))
  const skip = (currentPage - 1) * limit
  const data = payableInvoices.slice(skip, skip + limit)

  return { data, meta: { total, page: currentPage, limit, totalPages } }
}

export async function getPendingInvoicesDropdown() {
  const invoices = await prisma.jobCard.findMany({
    include: {
      customer: true,
      payments: true,
      vehicle: { select: { plateNumber: true } },
      parts: { where: { isPending: true }, select: { id: true } },
    },
    orderBy: { createdAt: 'asc' }
  })

  return invoices.filter(inv => inv.grandTotal > inv.payments.reduce((acc, p) => acc + p.amount, 0)).map(inv => {
    const paidAmount = inv.payments.reduce((acc, p) => acc + p.amount, 0)
    const due = inv.grandTotal - paidAmount
    return {
      id: inv.id,
      label: `JOB-${inv.id.split('-')[0].toUpperCase()} - ${inv.customer.name} - ${inv.vehicle.plateNumber} - Due: ${(due)} OMR`,
      dueAmount: due,
      hasPendingParts: inv.parts.length > 0,
    }
  })
}

export async function createPayment(data: PaymentFormValues) {
  const parsed = paymentSchema.parse(data)
  const discountAmount = parsed.discountAmount || 0
  let affectedCustomerId: string | null = null
  
  const result = await prisma.$transaction(async (tx) => {
    const invoiceBeforePayment = await tx.jobCard.findUnique({
      where: { id: parsed.jobCardId },
      include: { payments: true, parts: { where: { isPending: true }, select: { id: true } } },
    })

    if (!invoiceBeforePayment) {
      throw new Error("The selected Job Card no longer exists.")
    }

    affectedCustomerId = invoiceBeforePayment.customerId

    if (invoiceBeforePayment.parts.length > 0) {
      throw new Error("Payment cannot be completed because this Job Card has pending parts. Please purchase all pending parts before making the payment.")
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
    const { discountAmount: _discountAmount, paymentDate: paymentDateValue, ...paymentData } = parsed
    const paymentDate = new Date(paymentDateValue + "T12:00:00")
    const grandTotalAtPayment = Math.max(0, invoiceBeforePayment.grandTotal - discountAmount)
    const totalPaidAtPayment = alreadyPaid + parsed.amount
    const balanceAfterPayment = Math.max(0, grandTotalAtPayment - totalPaidAtPayment)

    const payment = await tx.payment.create({
      data: {
        ...paymentData,
        jobCardId: parsed.jobCardId,
         createdBy: creatorName,
        paymentDate,
        grandTotalAtPayment,
        totalPaidAtPayment,
        balanceAfterPayment,
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
  revalidatePath('/')
  revalidatePath('/reports')
  if (affectedCustomerId) {
    revalidatePath(`/customers/${affectedCustomerId}`)
  }
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
