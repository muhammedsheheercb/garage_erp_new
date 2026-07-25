"use server"

import prisma from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { createSession, clearSession } from "@/lib/session"
import { pagesWithViewPermission, parseModulePermissions } from "@/lib/permissions"
import { Prisma } from "@prisma/client"

export async function loginAction(identifier: string, password: string) {
  if (!identifier || !password) {
    return { success: false, error: "Username and password are required" }
  }
  
  try {
    const admin = await prisma.admin.findUnique({
      where: { email: identifier.trim().toLowerCase() }
    })
    if (admin && await bcrypt.compare(password, admin.password)) {
      await createSession(admin.id, admin.email, "ADMIN")
      return { success: true }
    }

    const [employee] = await prisma.$queryRaw<{ id: string; username: string | null; password: string; permissions: string; isActive: boolean }[]>(Prisma.sql`SELECT "id", "username", "password", "permissions", "isActive" FROM "Employee" WHERE "username" = ${identifier.trim().toLowerCase()} LIMIT 1`)
    if (employee?.isActive && await bcrypt.compare(password, employee.password)) {
      await createSession(employee.id, employee.username ?? "Employee", "EMPLOYEE", pagesWithViewPermission(parseModulePermissions(employee.permissions)))
      return { success: true }
    }

    return { success: false, error: "Invalid email or password" }
  } catch (error) {
    console.error("Login action error:", error)
    return { success: false, error: "An unexpected error occurred. Please try again." }
  }
}

export async function logoutAction() {
  await clearSession()
}
