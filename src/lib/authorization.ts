import prisma from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { canUseModule, parseModulePermissions, type PagePermission, type PermissionAction } from "@/lib/permissions"
import { Prisma } from "@prisma/client"

export async function requireAdmin() {
  const session = await getSession()
  if (!session || session.role !== "ADMIN") throw new Error("Unauthorized")
  return session
}

// Server Actions are public endpoints. Check the current database permission so
// a permission change takes effect immediately, even for an existing session.
export async function requirePagePermission(permission: PagePermission, action: PermissionAction = "view") {
  const session = await getSession()
  if (!session) throw new Error("Unauthorized")
  if (session.role === "ADMIN") return session

  const [employee] = await prisma.$queryRaw<{ isActive: boolean; permissions: string }[]>(Prisma.sql`SELECT "isActive", "permissions" FROM "Employee" WHERE "id" = ${session.userId} LIMIT 1`)
  if (!employee?.isActive) throw new Error("Unauthorized")
  if (!canUseModule(parseModulePermissions(employee.permissions), permission, action)) {
    throw new Error("Forbidden")
  }
  return session
}

export async function getCreatorName(): Promise<string> {
  const session = await getSession()
  if (!session) return "Admin"
  if (session.role === "ADMIN") {
    const admin = await prisma.admin.findUnique({ where: { id: session.userId } })
    return admin?.name || "Admin"
  } else {
    const [employee] = await prisma.$queryRaw<{ name: string }[]>(Prisma.sql`SELECT "name" FROM "Employee" WHERE "id" = ${session.userId} LIMIT 1`)
    return employee?.name || "Employee"
  }
}
