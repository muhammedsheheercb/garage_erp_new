"use server"

import prisma from "@/lib/prisma"
import { VehicleFormValues, vehicleSchema } from "./schema"
import { revalidatePath } from "next/cache"

export async function getVehicles(page = 1, search = "") {
  const limit = 10;
  const skip = (page - 1) * limit;

  const where = {
    OR: [
      { plateNumber: { contains: search } },
      { brand: { contains: search } },
      { model: { contains: search } },
      { customer: { name: { contains: search } } },
    ]
  };

  const [data, total] = await Promise.all([
    prisma.vehicle.findMany({
      where,
      skip,
      take: limit,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        jobCards: { 
          select: { id: true, status: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 3
        }
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.vehicle.count({ where })
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

// Keep it simple: fetch all customers for the select dropdown
export async function getCustomersForDropdown() {
  return prisma.customer.findMany({
    select: { id: true, name: true, phone: true },
    orderBy: { name: 'asc' }
  })
}

export async function createVehicle(data: VehicleFormValues) {
  const parsed = vehicleSchema.parse(data)
  
  const vehicle = await prisma.vehicle.create({
    data: {
      plateNumber: parsed.plateNumber,
      brand: parsed.brand,
      model: parsed.model,
      fuelType: parsed.fuelType,
      year: parsed.year,
      customerId: parsed.customerId,
    }
  })
  
  revalidatePath('/vehicles')
  return vehicle
}

export async function updateVehicle(id: string, data: VehicleFormValues) {
  const parsed = vehicleSchema.parse(data)
  
  const vehicle = await prisma.vehicle.update({
    where: { id },
    data: {
      plateNumber: parsed.plateNumber,
      brand: parsed.brand,
      model: parsed.model,
      fuelType: parsed.fuelType,
      year: parsed.year,
      customerId: parsed.customerId,
    }
  })
  
  revalidatePath('/vehicles')
  return vehicle
}

export async function deleteVehicle(id: string) {
  const jobCardCount = await prisma.jobCard.count({ where: { vehicleId: id } })
  if (jobCardCount > 0) {
    throw new Error("This vehicle cannot be deleted because it has job card history.")
  }

  await prisma.vehicle.delete({
    where: { id }
  })
  
  revalidatePath('/vehicles')
  return { success: true }
}
