"use server"

import prisma from "@/lib/prisma"
import { CustomerFormValues, customerSchema } from "./schema"
import { revalidatePath } from "next/cache"

export async function getCustomers(page = 1, search = "") {
  const limit = 10;
  const skip = (page - 1) * limit;

  const where = {
    OR: [
      { name: { contains: search } },
      { email: { contains: search } },
      { phone: { contains: search } },
    ]
  };

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
