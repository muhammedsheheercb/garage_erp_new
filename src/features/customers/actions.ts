"use server"

import prisma from "@/lib/prisma"
import { CustomerFormValues, customerSchema } from "./schema"
import { revalidatePath } from "next/cache"

export async function getCustomers(page = 1, search = "", fromDate?: string, toDate?: string) {
  const limit = 10;
  const skip = (page - 1) * limit;

  const where: any = {
    OR: [
      { name: { contains: search } },
      { email: { contains: search } },
      { phone: { contains: search } },
    ]
  };

  if (fromDate || toDate) {
    where.createdAt = {};
    if (fromDate) where.createdAt.gte = new Date(fromDate);
    if (toDate) where.createdAt.lte = new Date(toDate);
  }

  const [data, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.customer.count({ where })
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

export async function getCustomer(id: string) {
  return prisma.customer.findUnique({
    where: { id },
    include: { vehicles: true }
  })
}

export async function createCustomer(data: CustomerFormValues) {
  const parsed = customerSchema.parse(data)
  
  const existingName = await prisma.customer.findFirst({
    where: { name: { equals: parsed.name, mode: 'insensitive' } }
  })
  if (existingName) {
    throw new Error("This customer name is already used.")
  }

  if (parsed.phone) {
    const existingPhone = await prisma.customer.findFirst({
      where: { phone: parsed.phone }
    })
    if (existingPhone) {
      throw new Error("This mobile number is already used by another customer.")
    }
  }

  const customer = await prisma.customer.create({
    data: {
      name: parsed.name,
      email: parsed.email || null,
      phone: parsed.phone,
      address: parsed.address,
    }
  })
  
  revalidatePath('/customers')
  return customer
}

export async function updateCustomer(id: string, data: CustomerFormValues) {
  const parsed = customerSchema.parse(data)
  
  const existingName = await prisma.customer.findFirst({
    where: { 
      name: { equals: parsed.name, mode: 'insensitive' },
      id: { not: id }
    }
  })
  if (existingName) {
    throw new Error("This customer name is already used.")
  }

  if (parsed.phone) {
    const existingPhone = await prisma.customer.findFirst({
      where: { 
        phone: parsed.phone,
        id: { not: id }
      }
    })
    if (existingPhone) {
      throw new Error("This mobile number is already used by another customer.")
    }
  }

  const customer = await prisma.customer.update({
    where: { id },
    data: {
      name: parsed.name,
      email: parsed.email || null,
      phone: parsed.phone,
      address: parsed.address,
    }
  })
  
  revalidatePath('/customers')
  return customer
}

export async function deleteCustomer(id: string) {
  const [vehicleCount, jobCardCount, invoiceCount] = await Promise.all([
    prisma.vehicle.count({ where: { customerId: id } }),
    prisma.jobCard.count({ where: { customerId: id } }),
    prisma.invoice.count({ where: { customerId: id } }),
  ])

  if (vehicleCount || jobCardCount || invoiceCount) {
    throw new Error("This customer cannot be deleted because it has saved vehicles, job cards, or invoices.")
  }

  await prisma.customer.delete({
    where: { id }
  })
  
  revalidatePath('/customers')
  return { success: true }
}

export async function getCustomerFullDetails(id: string, fromDate?: string, toDate?: string) {
  const jobCardWhere: any = {};
  if (fromDate || toDate) {
    jobCardWhere.createdAt = {};
    if (fromDate) jobCardWhere.createdAt.gte = new Date(fromDate);
    if (toDate) jobCardWhere.createdAt.lte = new Date(toDate);
  }

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      vehicles: {
        include: {
          jobCards: {
            where: jobCardWhere,
            orderBy: { createdAt: 'desc' },
            include: {
              services: {
                include: { service: true }
              },
              parts: {
                include: { batch: { include: { inventory: true } } }
              },
              invoice: {
                include: { payments: true }
              }
            }
          }
        }
      }
    }
  });

  if (!customer) return null;

  let totalPaid = 0;
  let totalPending = 0;

  const vehiclesWithStats = customer.vehicles.map(vehicle => {
    let vPaid = 0;
    let vPending = 0;

    const jobCardsWithStats = vehicle.jobCards.map(jc => {
      const invoice = jc.invoice;
      if (invoice) {
        const paid = invoice.payments.reduce((sum: number, p: any) => sum + p.amount, 0);
        const pending = invoice.grandTotal - paid;
        vPaid += paid;
        vPending += pending;
        return { ...jc, paidAmount: paid, pendingAmount: pending };
      }
      return { ...jc, paidAmount: 0, pendingAmount: 0 };
    });

    totalPaid += vPaid;
    totalPending += vPending;

    return {
      ...vehicle,
      jobCards: jobCardsWithStats,
      totalPaid: vPaid,
      totalPending: vPending,
    };
  });

  return {
    ...customer,
    vehicles: vehiclesWithStats,
    overallTotalPaid: totalPaid,
    overallTotalPending: totalPending,
  };
}
