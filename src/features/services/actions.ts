"use server"

import prisma from "@/lib/prisma"
import { ServiceFormValues, serviceSchema } from "./schema"
import { revalidatePath } from "next/cache"

export async function getServices(page = 1, search = "", fromDate?: string, toDate?: string) {
  const limit = 10;
  const skip = (page - 1) * limit;

  const where: any = {
    OR: [
      { name: { contains: search } },
      { category: { contains: search } },
    ]
  };

  if (fromDate || toDate) {
    where.createdAt = {};
    if (fromDate) where.createdAt.gte = new Date(fromDate);
    if (toDate) where.createdAt.lte = new Date(toDate);
  }

  const [data, total] = await Promise.all([
    prisma.service.findMany({
      where,
      skip,
      take: limit,
      orderBy: { name: 'asc' }
    }),
    prisma.service.count({ where })
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

export async function createService(data: ServiceFormValues) {
  const parsed = serviceSchema.parse(data)

  const existing = await prisma.service.findFirst({
    where: { name: { equals: parsed.name, mode: "insensitive" } },
    select: { id: true },
  })
  if (existing) throw new Error("Service name already exists.")
  
  const service = await prisma.service.create({
    data: {
      name: parsed.name,
      category: parsed.category || null,
      estimatedTime: parsed.estimatedTime || null,
      price: parsed.price,
    }
  })
  
  revalidatePath('/services')
  return service
}

export async function updateService(id: string, data: ServiceFormValues) {
  const parsed = serviceSchema.parse(data)

  const existing = await prisma.service.findFirst({
    where: {
      name: { equals: parsed.name, mode: "insensitive" },
      id: { not: id },
    },
    select: { id: true },
  })
  if (existing) throw new Error("Service name already exists.")
  
  const service = await prisma.service.update({
    where: { id },
    data: {
      name: parsed.name,
      category: parsed.category || null,
      estimatedTime: parsed.estimatedTime || null,
      price: parsed.price,
    }
  })
  
  revalidatePath('/services')
  return service
}

export async function deleteService(id: string) {
  const jobCardServiceCount = await prisma.jobCardService.count({ where: { serviceId: id } })
  if (jobCardServiceCount > 0) {
    throw new Error("This service cannot be deleted because it is used in job cards.")
  }

  await prisma.service.delete({
    where: { id }
  })
  
  revalidatePath('/services')
  return { success: true }
}
