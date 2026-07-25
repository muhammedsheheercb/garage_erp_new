"use server"

import prisma from "@/lib/prisma"
import { VehicleFormValues, vehicleSchema } from "./schema"
import { revalidatePath } from "next/cache"
import { requirePagePermission } from "@/lib/authorization"

export async function getVehicles(page = 1, search = "", fromDate?: string, toDate?: string) {
  await requirePagePermission("vehicles", "view")
  const limit = 10;
  const skip = (page - 1) * limit;

  const where: any = {
    OR: [
      { plateNumber: { contains: search } },
      { brand: { contains: search } },
      { model: { contains: search } },
      { customer: { name: { contains: search } } },
    ]
  };

  if (fromDate || toDate) {
    where.createdAt = {};
    if (fromDate) where.createdAt.gte = new Date(fromDate);
    if (toDate) where.createdAt.lte = new Date(toDate);
  }

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
  await requirePagePermission("vehicles", "view")
  return prisma.customer.findMany({
    select: { id: true, name: true, phone: true },
    orderBy: { name: 'asc' }
  })
}

export async function getVehicleCatalog() {
  await requirePagePermission("vehicles", "view")
  const companies = await prisma.vehicleCompany.findMany({
    include: { models: { select: { name: true }, orderBy: { name: "asc" } } },
    orderBy: { name: "asc" },
  })
  return companies.reduce<Record<string, string[]>>((catalog, company) => {
    catalog[company.name] = company.models.map((model) => model.name)
    return catalog
  }, {})
}

export async function createVehicle(data: VehicleFormValues) {
  await requirePagePermission("vehicles", "create")
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
  await requirePagePermission("vehicles", "edit")
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
  await requirePagePermission("vehicles", "delete")
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
