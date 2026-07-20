"use server"

import prisma from "@/lib/prisma"
import { JobCardFormValues, jobCardSchema } from "./schema"
import { revalidatePath } from "next/cache"

export async function getJobCards(page = 1, search = "") {
  const limit = 10;
  const skip = (page - 1) * limit;

  const where = {
    OR: [
      { complaint: { contains: search } },
      { customer: { name: { contains: search } } },
      { vehicle: { plateNumber: { contains: search } } },
    ]
  };

  const [data, total] = await Promise.all([
    prisma.jobCard.findMany({
      where,
      skip,
      take: limit,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        vehicle: { select: { id: true, plateNumber: true, brand: true, model: true } },
        mechanic: { select: { id: true, name: true } },
        services: { include: { service: true } },
        parts: { include: { batch: { include: { inventory: true } } } }
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
  const [customers, vehicles, mechanics] = await Promise.all([
    prisma.customer.findMany({ select: { id: true, name: true, phone: true }, orderBy: { name: 'asc' } }),
    prisma.vehicle.findMany({ select: { id: true, plateNumber: true, brand: true, customerId: true }, orderBy: { plateNumber: 'asc' } }),
    prisma.mechanic.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } })
  ])
  return { customers, vehicles, mechanics }
}

export async function getServicesList(search = "") {
  return prisma.service.findMany({
    where: {
      name: { contains: search }
    },
    take: 20
  })
}

export async function getInventoryList(search = "") {
  return prisma.inventoryBatch.findMany({
    where: {
      quantity: { gt: 0 },
      inventory: {
        OR: [
          { itemName: { contains: search } },
          { partNumber: { contains: search } }
        ]
      }
    },
    include: {
      inventory: true
    },
    take: 20
  })
}

export async function createJobCard(data: JobCardFormValues) {
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
      serviceTotal: parsed.serviceTotal,
      partsTotal: parsed.partsTotal,
      discount: parsed.discount,
      tax: parsed.tax,
      grandTotal: parsed.grandTotal,
      
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
  return jobCard
}

export async function updateJobCard(id: string, data: JobCardFormValues) {
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
        serviceTotal: parsed.serviceTotal,
        partsTotal: parsed.partsTotal,
        discount: parsed.discount,
        tax: parsed.tax,
        grandTotal: parsed.grandTotal,
        
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
  return { success: true }
}

export async function deleteJobCard(id: string) {
  await prisma.$transaction([
    prisma.jobCardService.deleteMany({ where: { jobCardId: id } }),
    prisma.jobCardPart.deleteMany({ where: { jobCardId: id } }),
    prisma.jobCard.delete({ where: { id } })
  ])
  
  revalidatePath('/jobcards')
  return { success: true }
}
