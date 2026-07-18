"use server"

import prisma from "@/lib/prisma"
import { InvoiceFormValues, invoiceSchema } from "./schema"
import { revalidatePath } from "next/cache"

export async function getInvoices(page = 1, search = "") {
  const limit = 10;
  const skip = (page - 1) * limit;

  const where = {
    OR: [
      { customer: { name: { contains: search } } },
      { jobCard: { vehicle: { plateNumber: { contains: search } } } },
    ]
  };

  const [data, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      skip,
      take: limit,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        jobCard: { select: { id: true, vehicle: { select: { plateNumber: true, brand: true, model: true } } } },
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.invoice.count({ where })
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

export async function getInvoiceById(id: string) {
  return prisma.invoice.findUnique({
    where: { id },
    include: {
      customer: true,
      jobCard: {
        include: {
          vehicle: true,
          mechanic: true
        }
      }
    }
  })
}

// Fetch lists for dropdowns
export async function getDropdownData() {
  const [jobCards, customers] = await Promise.all([
    prisma.jobCard.findMany({ 
      where: { invoice: null }, // only job cards without invoice
      include: { 
        customer: true, 
        vehicle: true,
        services: { include: { service: true } },
        parts: { include: { inventory: true } }
      },
      orderBy: { createdAt: 'desc' } 
    }),
    prisma.customer.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ])
  return { jobCards, customers }
}

export async function createInvoice(data: InvoiceFormValues) {
  const parsed = invoiceSchema.parse(data)
  
  const subTotal = parsed.serviceCharge + parsed.labourCharge + parsed.partsCost;
  const totalBeforeTax = subTotal - parsed.discount;
  const grandTotal = totalBeforeTax + parsed.tax;

  const invoice = await prisma.invoice.create({
    data: {
      jobCardId: parsed.jobCardId,
      customerId: parsed.customerId,
      serviceCharge: parsed.serviceCharge,
      labourCharge: parsed.labourCharge,
      partsCost: parsed.partsCost,
      discount: parsed.discount,
      tax: parsed.tax,
      subTotal,
      amount: grandTotal, // for backwards compatibility
      grandTotal,
      servicesDetails: parsed.servicesDetails,
      partsDetails: parsed.partsDetails,
      status: "UNPAID",
    }
  })
  
  revalidatePath('/invoices')
  return invoice
}

export async function updateInvoice(id: string, data: InvoiceFormValues) {
  const parsed = invoiceSchema.parse(data)
  
  const subTotal = parsed.serviceCharge + parsed.labourCharge + parsed.partsCost;
  const totalBeforeTax = subTotal - parsed.discount;
  const grandTotal = totalBeforeTax + parsed.tax;

  const existingInvoice = await prisma.invoice.findUnique({
    where: { id },
    include: { payments: true }
  });

  let newStatus = existingInvoice?.status || "UNPAID";
  if (existingInvoice) {
    const totalPaid = existingInvoice.payments.reduce((acc, p) => acc + p.amount, 0);
    if (totalPaid >= grandTotal) {
      newStatus = "PAID";
    } else if (totalPaid > 0) {
      newStatus = "PARTIAL";
    } else {
      newStatus = "UNPAID";
    }
  }

  const invoice = await prisma.invoice.update({
    where: { id },
    data: {
      jobCardId: parsed.jobCardId,
      customerId: parsed.customerId,
      serviceCharge: parsed.serviceCharge,
      labourCharge: parsed.labourCharge,
      partsCost: parsed.partsCost,
      discount: parsed.discount,
      tax: parsed.tax,
      subTotal,
      amount: grandTotal,
      grandTotal,
      servicesDetails: parsed.servicesDetails,
      partsDetails: parsed.partsDetails,
      status: newStatus,
    }
  })
  
  revalidatePath('/invoices')
  return invoice
}

export async function deleteInvoice(id: string) {
  await prisma.$transaction([
    prisma.payment.deleteMany({ where: { invoiceId: id } }),
    prisma.invoice.delete({ where: { id } })
  ])
  
  revalidatePath('/invoices')
  return { success: true }
}
