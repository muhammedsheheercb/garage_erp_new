"use server"

import type { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"
import { requirePagePermission } from "@/lib/authorization"
import { revalidatePath } from "next/cache"
import { companyCreateSchema, companySchema, modelSchema, type CompanyCreateFormValues, type CompanyFormValues, type ModelFormValues } from "./schema"

const refreshVehicleData = () => {
  revalidatePath("/vehicle-companies")
  revalidatePath("/vehicles")
}

export async function getVehicleCompanies(fromDateStr?: string, toDateStr?: string, search = "") {
  await requirePagePermission("vehicle-companies", "view")
  const where: Prisma.VehicleCompanyWhereInput = {};
  if (fromDateStr || toDateStr) {
    where.createdAt = {};
    if (fromDateStr) where.createdAt.gte = new Date(fromDateStr);
    if (toDateStr) where.createdAt.lte = new Date(toDateStr);
  }
  if (search.trim()) where.name = { contains: search.trim(), mode: "insensitive" };

  return prisma.vehicleCompany.findMany({
    where,
    include: { models: { orderBy: { name: "asc" } } },
    orderBy: { name: "asc" },
  })
}

export async function createVehicleCompany(data: CompanyCreateFormValues) {
  await requirePagePermission("vehicle-companies", "create")
  const parsed = companyCreateSchema.parse(data)
  const existing = await prisma.vehicleCompany.findFirst({
    where: { name: { equals: parsed.name, mode: "insensitive" } },
    select: { id: true },
  })
  if (existing) return { success: false as const, message: "Vehicle company name already exists." }

  const company = await prisma.vehicleCompany.create({
    data: {
      name: parsed.name,
      models: { create: { name: parsed.modelName } },
    },
  })
  refreshVehicleData()
  return company
}

export async function updateVehicleCompany(id: string, data: CompanyFormValues) {
  await requirePagePermission("vehicle-companies", "edit")
  const parsed = companySchema.parse(data)
  const existing = await prisma.vehicleCompany.findFirst({
    where: {
      name: { equals: parsed.name, mode: "insensitive" },
      id: { not: id },
    },
    select: { id: true },
  })
  if (existing) return { success: false as const, message: "Vehicle company name already exists." }

  const company = await prisma.vehicleCompany.update({ where: { id }, data: parsed })
  refreshVehicleData()
  return company
}

export async function deleteVehicleCompany(id: string) {
  await requirePagePermission("vehicle-companies", "delete")
  await prisma.vehicleCompany.delete({ where: { id } })
  refreshVehicleData()
  return { success: true }
}

export async function createVehicleModel(data: ModelFormValues) {
  await requirePagePermission("vehicle-companies", "create")
  const parsed = modelSchema.parse(data)
  const existing = await prisma.vehicleModel.findFirst({
    where: {
      companyId: parsed.companyId,
      name: { equals: parsed.name, mode: "insensitive" },
    },
    select: { id: true },
  })
  if (existing) return { success: false as const, message: "Vehicle model already exists for this company." }

  const model = await prisma.vehicleModel.create({ data: parsed })
  refreshVehicleData()
  return model
}

export async function updateVehicleModel(id: string, data: ModelFormValues) {
  await requirePagePermission("vehicle-companies", "edit")
  const parsed = modelSchema.parse(data)
  const existing = await prisma.vehicleModel.findFirst({
    where: {
      companyId: parsed.companyId,
      name: { equals: parsed.name, mode: "insensitive" },
      id: { not: id },
    },
    select: { id: true },
  })
  if (existing) return { success: false as const, message: "Vehicle model already exists for this company." }
  const model = await prisma.vehicleModel.update({ where: { id }, data: parsed })
  refreshVehicleData()
  return model
}

export async function deleteVehicleModel(id: string) {
  await requirePagePermission("vehicle-companies", "delete")
  await prisma.vehicleModel.delete({ where: { id } })
  refreshVehicleData()
  return { success: true }
}
