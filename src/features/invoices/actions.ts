"use server"

import { currentInvoiceTotals } from "./current-totals"
import prisma from "@/lib/prisma"
import { InvoiceFormValues, invoiceSchema } from "./schema"
import { revalidatePath } from "next/cache"
import { getCreatorName, requirePagePermission } from "@/lib/authorization"

export async function getInvoices(page = 1, search = "", fromDate?: string, toDate?: string) {
  await requirePagePermission("invoices", "view")
  const limit = 5;
  const skip = (page - 1) * limit;

  const where: any = search ? {
    OR: [
      { customer: { name: { contains: search, mode: "insensitive" } } },
      { jobCard: { vehicle: { plateNumber: { contains: search, mode: "insensitive" } } } },
    ]
  } : {};

  if (fromDate || toDate) {
    where.createdAt = {};
    if (fromDate) where.createdAt.gte = new Date(fromDate);
    if (toDate) where.createdAt.lte = new Date(toDate);
  }

  const [data, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      skip,
      take: limit,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        payments: true,
        jobCard: {
          include: {
            vehicle: true,
            payments: true,
            customer: true,
            services: { include: { service: true } },
            parts: { include: { batch: { include: { inventory: true } } } }
          }
        },
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.invoice.count({ where })
  ]);

  return {
    data: data.map(invoice => ({ ...invoice, ...currentInvoiceTotals(invoice) })),
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  }
}

export async function getInvoiceById(id: string) {
  await requirePagePermission("invoices", "view")
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      customer: true,
      jobCard: {
        include: {
          vehicle: true,
          mechanic: true,
          payments: true
        }
      },
      payments: {
        orderBy: { createdAt: "asc" }
      }
    }
  })
  if (!invoice) return null
  const payments = [...new Map([...invoice.payments, ...invoice.jobCard.payments].map(payment => [payment.id, payment])).values()]
  return { ...invoice, ...currentInvoiceTotals(invoice), payments }
}

// Fetch lists for dropdowns
export async function getDropdownData() {
  await requirePagePermission("invoices", "view")
  const [jobCards, customers] = await Promise.all([
    prisma.jobCard.findMany({
      where: { invoice: null }, // only job cards without invoice
      include: {
        customer: true,
        vehicle: true,
        services: { include: { service: true } },
        parts: { include: { batch: { include: { inventory: true } } } }
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.customer.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ])
  return { jobCards, customers }
}

export async function createInvoice(data: InvoiceFormValues) {
  await requirePagePermission("invoices", "create")
  const parsed = invoiceSchema.parse(data)
  const jobCard = await prisma.jobCard.findUnique({
    where: { id: parsed.jobCardId },
    select: {
      customerId: true,
      serviceTotal: true,
      partsTotal: true,
      advancePaid: true,
      payments: {
        select: { id: true },
      },
    },
  })

  if (!jobCard) {
    throw new Error("The selected job card no longer exists.")
  }

  const serviceCharge = jobCard.serviceTotal ?? 0
  const partsCost = jobCard.partsTotal ?? 0
  const advancePaid = jobCard.advancePaid ?? 0

  let otherAmountSum = 0
  if (parsed.otherCharges) {
    try {
      const parsedCharges = JSON.parse(parsed.otherCharges)
      if (Array.isArray(parsedCharges)) {
        otherAmountSum = parsedCharges.reduce((acc, c: any) => acc + Math.max(0, Number(c.amount) || 0), 0)
      }
    } catch (e) {
      console.error("Failed to parse otherCharges", e)
    }
  }

  const subTotal = serviceCharge + parsed.labourCharge + partsCost + otherAmountSum;
  const grandTotal = Math.max(0, subTotal + parsed.tax - parsed.discount);

  const initialStatus = advancePaid >= grandTotal ? "PAID" : advancePaid > 0 ? "PARTIAL" : "UNPAID";
  const creatorName = await getCreatorName()

  const invoice = await prisma.invoice.create({
    data: {
      jobCardId: parsed.jobCardId,
      customerId: jobCard.customerId,
      serviceCharge,
      labourCharge: parsed.labourCharge,
      partsCost,
      discount: parsed.discount,
      tax: parsed.tax,
      subTotal,
      amount: grandTotal, // for backwards compatibility
      grandTotal,
      servicesDetails: parsed.servicesDetails,
      partsDetails: parsed.partsDetails,
      otherCharges: parsed.otherCharges,
      status: initialStatus,
      createdBy: creatorName,
    }
  })

  // Auto-record initial payment if advancePaid is present
  if (advancePaid > 0 && jobCard.payments.length === 0) {
    await prisma.payment.create({
      data: {
        invoiceId: invoice.id,
        jobCardId: parsed.jobCardId,
        // Retain the full customer credit even when the current invoice total is
        // zero or lower than the advance. It will offset charges added later.
        amount: advancePaid,
        method: "ADVANCE",
         createdBy: creatorName,
        grandTotalAtPayment: grandTotal,
        totalPaidAtPayment: advancePaid,
        balanceAfterPayment: Math.max(0, grandTotal - advancePaid),
      },
    })
  }

  revalidatePath('/invoices')
  revalidatePath(`/customers/${jobCard.customerId}`)
  return invoice
}

export async function updateInvoice(id: string, data: InvoiceFormValues) {
  await requirePagePermission("invoices", "edit")
  const parsed = invoiceSchema.parse(data)

  const invoice = await prisma.$transaction(async tx => {
    const existingInvoice = await tx.invoice.findUnique({
      where: { id },
      include: {
        payments: true,
        jobCard: { select: { serviceTotal: true, partsTotal: true, payments: { select: { id: true, amount: true } } } },
      }
    });

    // A zero-value invoice with an advance is marked PAID, but it must remain
    // editable so later service charges can use that saved customer credit.
    if (existingInvoice && currentInvoiceTotals(existingInvoice).status === "PAID" && currentInvoiceTotals(existingInvoice).grandTotal > 0) {
      throw new Error("This invoice is fully paid and cannot be edited.")
    }

    if (!existingInvoice) {
      throw new Error("Invoice not found.")
    }

    let otherAmountSum = 0
    if (parsed.otherCharges) {
      try {
        const parsedCharges = JSON.parse(parsed.otherCharges)
        if (Array.isArray(parsedCharges)) {
          otherAmountSum = parsedCharges.reduce((acc, c: any) => acc + Math.max(0, Number(c.amount) || 0), 0)
        }
      } catch (e) {
        console.error("Failed to parse otherCharges", e)
      }
    }

    const subTotal = existingInvoice.jobCard.serviceTotal + parsed.labourCharge + existingInvoice.jobCard.partsTotal + otherAmountSum;
    const grandTotal = Math.max(0, subTotal + parsed.tax - parsed.discount);

    let newStatus = existingInvoice.status;
    const totalPaid = Array.from(
      new Map(
        [...existingInvoice.payments, ...(existingInvoice.jobCard?.payments ?? [])]
          .map((payment) => [payment.id, payment.amount]),
      ).values(),
    ).reduce((total, amount) => total + amount, 0);
    if (totalPaid >= grandTotal) {
      newStatus = "PAID";
    } else if (totalPaid > 0) {
      newStatus = "PARTIAL";
    } else {
      newStatus = "UNPAID";
    }

    const updatedInvoice = await tx.invoice.update({
      where: { id },
      data: {
        jobCardId: existingInvoice.jobCardId,
        customerId: existingInvoice.customerId,
        serviceCharge: existingInvoice.jobCard.serviceTotal,
        labourCharge: parsed.labourCharge,
        partsCost: existingInvoice.jobCard.partsTotal,
        discount: parsed.discount,
        tax: parsed.tax,
        subTotal,
        amount: grandTotal,
        grandTotal,
        servicesDetails: parsed.servicesDetails,
        partsDetails: parsed.partsDetails,
        otherCharges: parsed.otherCharges,
        status: newStatus,
      }
    })

    return updatedInvoice
  }, { timeout: 30_000, isolationLevel: "Serializable" })

  revalidatePath('/invoices')
  revalidatePath(`/customers/${invoice.customerId}`)
  return invoice
}


export async function deleteInvoice(id: string) {
  await requirePagePermission("invoices", "delete")
  await prisma.$transaction([
    prisma.payment.deleteMany({ where: { invoiceId: id } }),
    prisma.invoice.delete({ where: { id } })
  ])

  revalidatePath('/invoices')
  return { success: true }
}
