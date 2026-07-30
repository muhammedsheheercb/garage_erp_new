"use server"

import prisma from "@/lib/prisma"
import { MechanicFormValues, mechanicSchema } from "./schema"
import { revalidatePath } from "next/cache"

export async function getMechanics(page = 1, search = "", fromDate?: string, toDate?: string) {
  const limit = 5;
  const skip = (page - 1) * limit;

  const where: any = {
    OR: [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
    ]
  };

  if (fromDate || toDate) {
    where.createdAt = {};
    if (fromDate) where.createdAt.gte = new Date(fromDate);
    if (toDate) where.createdAt.lte = new Date(toDate);
  }

  const [data, total] = await Promise.all([
    prisma.mechanic.findMany({
      where,
      skip,
      take: limit,
      include: {
        jobCards: {
          select: { 
            id: true, 
            status: true, 
            expectedFinishDate: true,
            complaint: true,
            workDone: true,
            vehicle: { select: { plateNumber: true, brand: true } },
            customer: { select: { name: true } }
          },
          where: { status: { not: 'COMPLETED' } } // only fetch active assigned jobs
        }
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.mechanic.count({ where })
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

export async function createMechanic(data: MechanicFormValues) {
  const parsed = mechanicSchema.parse(data)
  
  const existingName = await prisma.mechanic.findFirst({
    where: { name: { equals: parsed.name, mode: 'insensitive' } }
  })
  if (existingName) {
    return { success: false as const, message: "This mechanic name is already used." }
  }

  if (parsed.phone) {
    const existingPhone = await prisma.mechanic.findFirst({
      where: { phone: parsed.phone }
    })
    if (existingPhone) {
      return { success: false as const, message: "This mobile number is already used by another mechanic." }
    }
  }

  const mechanic = await prisma.mechanic.create({
    data: {
      name: parsed.name,
      email: parsed.email || null,
      phone: parsed.phone || null,
    }
  })
  
  revalidatePath('/mechanics')
  return mechanic
}

export async function updateMechanic(id: string, data: MechanicFormValues) {
  const parsed = mechanicSchema.parse(data)
  
  const existingName = await prisma.mechanic.findFirst({
    where: { 
      name: { equals: parsed.name, mode: 'insensitive' },
      id: { not: id }
    }
  })
  if (existingName) {
    return { success: false as const, message: "This mechanic name is already used." }
  }

  if (parsed.phone) {
    const existingPhone = await prisma.mechanic.findFirst({
      where: { 
        phone: parsed.phone,
        id: { not: id }
      }
    })
    if (existingPhone) {
      return { success: false as const, message: "This mobile number is already used by another mechanic." }
    }
  }

  const mechanic = await prisma.mechanic.update({
    where: { id },
    data: {
      name: parsed.name,
      email: parsed.email || null,
      phone: parsed.phone || null,
    }
  })
  
  revalidatePath('/mechanics')
  return mechanic
}

export async function deleteMechanic(id: string) {
  const jobCardCount = await prisma.jobCard.count({ where: { mechanicId: id } })
  if (jobCardCount > 0) {
    throw new Error("This mechanic cannot be deleted because they are assigned to job cards.")
  }

  await prisma.mechanic.delete({
    where: { id }
  })
  
  revalidatePath('/mechanics')
  return { success: true }
}
