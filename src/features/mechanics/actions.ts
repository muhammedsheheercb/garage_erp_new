"use server"

import prisma from "@/lib/prisma"
import { MechanicFormValues, mechanicSchema } from "./schema"
import { revalidatePath } from "next/cache"

export async function getMechanics(page = 1, search = "") {
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
    prisma.mechanic.findMany({
      where,
      skip,
      take: limit,
      include: {
        jobCards: {
          select: { id: true, status: true, vehicle: { select: { plateNumber: true, brand: true } } },
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
  await prisma.mechanic.delete({
    where: { id }
  })
  
  revalidatePath('/mechanics')
  return { success: true }
}
