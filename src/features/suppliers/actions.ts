"use server"

import prisma from "@/lib/prisma"
import { SupplierFormValues, supplierSchema, SupplierPaymentFormValues, supplierPaymentSchema } from "./schema"
import { revalidatePath } from "next/cache"

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
  return prisma.supplier.findUnique({
    where: { id },
    include: {
      purchases: {
        include: { items: { include: { inventory: true } } }
      },
      payments: {
        orderBy: { date: 'desc' }
      }
    }
  })
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
  
  const payment = await prisma.supplierPayment.create({
    data: {
      supplierId,
      amount: parsed.amount,
      method: parsed.method,
      reference: parsed.reference || null,
    }
  })
  
  revalidatePath('/suppliers')
  return payment
}

export async function deleteSupplierPayment(paymentId: string) {
  await prisma.supplierPayment.delete({
    where: { id: paymentId }
  })
  revalidatePath('/suppliers')
  return { success: true }
}
