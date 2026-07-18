"use server"

import prisma from "@/lib/prisma"
import { ServiceFormValues, serviceSchema } from "./schema"
import { revalidatePath } from "next/cache"

export async function getServices(page = 1, search = "") {
  const limit = 10;
  const skip = (page - 1) * limit;

  const where = {
    OR: [
      { name: { contains: search } },
      { category: { contains: search } },
    ]
  };

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
  await prisma.service.delete({
    where: { id }
  })
  
  revalidatePath('/services')
  return { success: true }
}
