"use server"

import prisma from "@/lib/prisma"
import { JobCardFormValues, jobCardSchema } from "./schema"
import { revalidatePath } from "next/cache"
import { requirePagePermission } from "@/lib/authorization"

export async function getJobCards(
  page = 1, 
  search = "", 
  fromDate?: string, 
  toDate?: string,
  expectedFromDate?: string,
  expectedToDate?: string
) {
  await requirePagePermission("jobcards")
  const limit = 5;
  const skip = (page - 1) * limit;

  const where: any = {
    OR: [
      { complaint: { contains: search, mode: "insensitive" } },
      { customer: { name: { contains: search, mode: "insensitive" } } },
      { vehicle: { plateNumber: { contains: search, mode: "insensitive" } } },
    ]
  };

  if (fromDate || toDate) {
    where.createdAt = {};
    if (fromDate) where.createdAt.gte = new Date(fromDate);
    if (toDate) where.createdAt.lte = new Date(toDate);
  }

  if (expectedFromDate || expectedToDate) {
    where.expectedFinishDate = {};
    if (expectedFromDate) where.expectedFinishDate.gte = new Date(expectedFromDate);
    if (expectedToDate) where.expectedFinishDate.lte = new Date(expectedToDate);
  }

  const [data, total] = await Promise.all([
    prisma.jobCard.findMany({
      where,
      skip,
      take: limit,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        vehicle: { select: { id: true, plateNumber: true, brand: true, model: true } },
        mechanic: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.jobCard.count({ where })
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

export async function getJobCardById(id: string) {
  await requirePagePermission("jobcards")
  return prisma.jobCard.findUnique({
    where: { id },
    include: {
      customer: true,
      vehicle: true,
      mechanic: true,
      services: {
        include: { service: true }
      },
      parts: {
        include: { batch: { include: { inventory: true } } }
      }
    }
  })
}

// Fetch lists for dropdowns
export async function getDropdownData() {
  await requirePagePermission("jobcards")
  const [customers, vehicles, mechanics] = await Promise.all([
    prisma.customer.findMany({ select: { id: true, name: true, phone: true }, orderBy: { name: 'asc' } }),
    prisma.vehicle.findMany({
      select: {
        id: true,
        plateNumber: true,
        brand: true,
        model: true,
        year: true,
        fuelType: true,
        customerId: true,
        customer: { select: { name: true, phone: true } },
      },
      orderBy: { plateNumber: 'asc' },
    }),
    prisma.mechanic.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } })
  ])
  return { customers, vehicles, mechanics }
}

export async function getVehicleHistory(vehicleId: string, excludeJobCardId?: string) {
  await requirePagePermission("jobcards")
  return prisma.jobCard.findMany({
    where: {
      vehicleId,
      ...(excludeJobCardId ? { id: { not: excludeJobCardId } } : {}),
    },
    include: {
      mechanic: { select: { name: true } },
      services: { include: { service: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  })
}

export async function getServicesList(search = "") {
  await requirePagePermission("jobcards")
  return prisma.service.findMany({
    where: {
      name: { contains: search, mode: "insensitive" }
    },
    take: 20
  })
}

export async function getInventoryList(search = "", excludeJobCardId?: string) {
  await requirePagePermission("jobcards")
  const batches = await prisma.inventoryBatch.findMany({
    where: {
      quantity: { gt: 0 },
      inventory: {
        OR: [
          { itemName: { contains: search, mode: "insensitive" } },
          { partNumber: { contains: search, mode: "insensitive" } }
        ]
      }
    },
    include: {
      inventory: true,
      jobCardParts: {
        where: {
          jobCard: {
            status: { notIn: ["COMPLETED", "CANCELLED"] },
            ...(excludeJobCardId ? { id: { not: excludeJobCardId } } : {})
          }
        }
      }
    },
    take: 20
  })

  return batches.map(batch => {
    const reservedQuantity = batch.jobCardParts.reduce((sum, part) => sum + part.quantity, 0);
    return {
      ...batch,
      reservedQuantity,
      availableQuantity: Math.max(0, batch.quantity - reservedQuantity),
      jobCardParts: undefined // remove relation array from response
    }
  })
}

export async function createJobCard(data: JobCardFormValues) {
  await requirePagePermission("jobcards")
  const parsed = jobCardSchema.parse(data)
  
  const jobCard = await prisma.jobCard.create({
    data: {
      customerId: parsed.customerId,
      vehicleId: parsed.vehicleId,
      mechanicId: parsed.mechanicId,
      status: "PENDING",
      complaint: parsed.complaint,
      workDone: parsed.workDone || null,
      notes: parsed.notes || null,
      expectedFinishDate: parsed.expectedFinishDate ? new Date(parsed.expectedFinishDate) : null,
      serviceTotal: parsed.serviceTotal,
      partsTotal: parsed.partsTotal,
      discount: parsed.discount,
      tax: parsed.tax,
      grandTotal: parsed.grandTotal,
      advancePaid: parsed.advancePaid,
      
      services: {
        create: parsed.services.map(s => ({
          serviceId: s.serviceId,
          quantity: s.quantity,
          price: s.price
        }))
      },
      parts: {
        create: parsed.parts.map(p => ({
          batchId: p.batchId,
          quantity: p.quantity,
          price: p.price
        }))
      }
    }
  })
  
  revalidatePath('/jobcards')
  revalidatePath('/vehicles')
  revalidatePath('/inventory')
  revalidatePath('/purchases')
  return jobCard
}

export async function updateJobCard(id: string, data: JobCardFormValues) {
  await requirePagePermission("jobcards")
  const parsed = jobCardSchema.parse(data)
  
  // Update inventory stock ONLY if status changes to COMPLETED
  const existingJobCard = await prisma.jobCard.findUnique({
    where: { id },
    select: { status: true }
  })
  
  if (existingJobCard?.status !== "COMPLETED" && parsed.status === "COMPLETED") {
    // Deduct stock
    for (const part of parsed.parts) {
      await prisma.inventoryBatch.update({
        where: { id: part.batchId },
        data: { quantity: { decrement: part.quantity } }
      })
    }
  }
  
  // First, delete existing services and parts
  await prisma.$transaction([
    prisma.jobCardService.deleteMany({ where: { jobCardId: id } }),
    prisma.jobCardPart.deleteMany({ where: { jobCardId: id } }),
    prisma.jobCard.update({
      where: { id },
      data: {
        customerId: parsed.customerId,
        vehicleId: parsed.vehicleId,
        mechanicId: parsed.mechanicId,
        status: parsed.status,
        complaint: parsed.complaint,
        workDone: parsed.workDone || null,
        notes: parsed.notes || null,
        expectedFinishDate: parsed.expectedFinishDate ? new Date(parsed.expectedFinishDate) : null,
        serviceTotal: parsed.serviceTotal,
        partsTotal: parsed.partsTotal,
        discount: parsed.discount,
        tax: parsed.tax,
        grandTotal: parsed.grandTotal,
        advancePaid: parsed.advancePaid,
        
        services: {
          create: parsed.services.map(s => ({
            serviceId: s.serviceId,
            quantity: s.quantity,
            price: s.price
          }))
        },
        parts: {
          create: parsed.parts.map(p => ({
            batchId: p.batchId,
            quantity: p.quantity,
            price: p.price
          }))
        }
      }
    })
  ])
  
  revalidatePath('/jobcards')
  revalidatePath('/vehicles')
  revalidatePath('/inventory')
  revalidatePath('/purchases')
  return { success: true }
}

export async function deleteJobCard(id: string) {
  await requirePagePermission("jobcards")
  await prisma.$transaction([
    prisma.jobCardService.deleteMany({ where: { jobCardId: id } }),
    prisma.jobCardPart.deleteMany({ where: { jobCardId: id } }),
    prisma.jobCard.delete({ where: { id } })
  ])
  
  revalidatePath('/jobcards')
  revalidatePath('/vehicles')
  revalidatePath('/inventory')
  revalidatePath('/purchases')
  return { success: true }
}
