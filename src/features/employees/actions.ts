"use server"

import bcrypt from "bcryptjs"
import prisma from "@/lib/prisma"
import { requireAdmin } from "@/lib/authorization"
import { isPagePermission, PERMISSION_ACTIONS, type ModulePermissions } from "@/lib/permissions"
import { Prisma } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const employeeBaseSchema = z.object({
  username: z.string().trim().toLowerCase().min(2, "Username must be at least 2 characters").max(50).regex(/^[a-z0-9._-]+$/, "Username cannot contain spaces; use only letters, numbers, dots, hyphens, or underscores"),
  permissions: z.record(z.string(), z.array(z.enum(PERMISSION_ACTIONS))).refine((value) => Object.keys(value).every(isPagePermission), "Invalid module permission").refine((value) => Object.values(value).some((actions) => actions.length > 0), "Select at least one permission"),
})

const createEmployeeSchema = employeeBaseSchema.extend({
  password: z.string().min(6, "Password must be at least 6 characters").max(128),
})

const updateEmployeeSchema = employeeBaseSchema.extend({
  password: z.string().max(128).optional(),
})

export type EmployeeInput = {
  username: string
  password: string
  permissions: ModulePermissions
}

type EmployeeRow = { id: string; username: string | null; permissions: string; isActive: boolean; createdAt: Date }

export async function getEmployees() {
  await requireAdmin()
  return prisma.$queryRaw<EmployeeRow[]>(Prisma.sql`SELECT "id", "username", "permissions", "isActive", "createdAt" FROM "Employee" ORDER BY "createdAt" DESC`)
}

export async function createEmployee(data: EmployeeInput) {
  await requireAdmin()
  const parsed = createEmployeeSchema.parse(data)
  const [employee] = await prisma.$queryRaw<{ id: string; username: string; isActive: boolean }[]>(Prisma.sql`
    INSERT INTO "Employee" ("id", "name", "username", "email", "password", "permissions", "isActive", "createdAt", "updatedAt")
    VALUES (gen_random_uuid()::text, ${parsed.username}, ${parsed.username}, 'employee@garage.com', ${await bcrypt.hash(parsed.password, 12)}, ${JSON.stringify(parsed.permissions)}, true, NOW(), NOW())
    RETURNING "id", "username", "isActive"
  `)
  revalidatePath("/employees")
  return employee
}

export async function updateEmployee(id: string, data: EmployeeInput) {
  await requireAdmin()
  const parsed = updateEmployeeSchema.parse(data)
  const passwordSql = parsed.password ? Prisma.sql`, "password" = ${await bcrypt.hash(parsed.password, 12)}` : Prisma.empty
  await prisma.$executeRaw(Prisma.sql`UPDATE "Employee" SET "name" = ${parsed.username}, "username" = ${parsed.username}, "permissions" = ${JSON.stringify(parsed.permissions)}${passwordSql}, "updatedAt" = NOW() WHERE "id" = ${id}`)
  revalidatePath("/employees")
}

export async function setEmployeeActive(id: string, isActive: boolean) {
  await requireAdmin()
  await prisma.$executeRaw(Prisma.sql`UPDATE "Employee" SET "isActive" = ${isActive}, "updatedAt" = NOW() WHERE "id" = ${id}`)
  revalidatePath("/employees")
}

export async function deleteEmployee(id: string) {
  await requireAdmin()
  await prisma.$executeRaw(Prisma.sql`DELETE FROM "Employee" WHERE "id" = ${id}`)
  revalidatePath("/employees")
}
