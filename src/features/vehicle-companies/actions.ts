"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { companyCreateSchema, companySchema, modelSchema, type CompanyCreateFormValues, type CompanyFormValues, type ModelFormValues } from "./schema"

const refreshVehicleData = () => {
  revalidatePath("/vehicle-companies")
  revalidatePath("/vehicles")
}

export async function getVehicleCompanies() {
  return prisma.vehicleCompany.findMany({
    include: { models: { orderBy: { name: "asc" } } },
    orderBy: { name: "asc" },
  })
}

export async function createVehicleCompany(data: CompanyCreateFormValues) {
  const parsed = companyCreateSchema.parse(data)
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
  const parsed = companySchema.parse(data)
  const company = await prisma.vehicleCompany.update({ where: { id }, data: parsed })
  refreshVehicleData()
  return company
}

export async function deleteVehicleCompany(id: string) {
  await prisma.vehicleCompany.delete({ where: { id } })
  refreshVehicleData()
  return { success: true }
}

export async function createVehicleModel(data: ModelFormValues) {
  const parsed = modelSchema.parse(data)
  const model = await prisma.vehicleModel.create({ data: parsed })
  refreshVehicleData()
  return model
}

export async function updateVehicleModel(id: string, data: ModelFormValues) {
  const parsed = modelSchema.parse(data)
  const model = await prisma.vehicleModel.update({ where: { id }, data: parsed })
  refreshVehicleData()
  return model
}

export async function deleteVehicleModel(id: string) {
  await prisma.vehicleModel.delete({ where: { id } })
  refreshVehicleData()
  return { success: true }
}
