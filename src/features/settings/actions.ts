"use server"

import type { Prisma } from "@prisma/client"
import { requireAdmin } from "@/lib/authorization"
import prisma from "@/lib/prisma"
import { SettingsFormValues, settingsSchema } from "./schema"
import { revalidatePath } from "next/cache"
import { availableBackups, snapshotDatabase, restoreSnapshot, deleteSnapshot } from "./database-backup"
import { getSession } from "@/lib/session"
import bcrypt from "bcryptjs"
import { isBackupAdmin } from './backup-auth'

export async function getSettings() {
  const settings = await prisma.setting.findMany()
  
  const formattedSettings = settings.reduce((acc: Record<string, string>, curr: { key: string; value: string }) => {
    acc[curr.key] = curr.value
    return acc
  }, {} as Record<string, string>)
  
  return {
    garageName: formattedSettings.garageName || "Garage ERP",
    ownerName: formattedSettings.ownerName || "Owner",
    phone: formattedSettings.phone || "",
    email: formattedSettings.email || "",
    address: formattedSettings.address || "",
    gstNumber: formattedSettings.gstNumber || "",
    invoicePrefix: formattedSettings.invoicePrefix || "INV",
  } as SettingsFormValues
}

export async function updateSettings(data: SettingsFormValues) {
  await requireAdmin()
  const parsed = settingsSchema.parse(data)
  for (const [key, value] of Object.entries(parsed)) {
    await prisma.setting.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) }
    })
  }
  
  revalidatePath('/settings')
  return { success: true }
}

async function requireBackupAdmin() {
  if (!await isBackupAdmin()) {
    throw new Error("Administrator access required")
  }
}

export async function createDatabaseBackup() {
  await requireBackupAdmin()
  const filename = await snapshotDatabase(prisma)
  return { success: true, filename, message: `Database backed up successfully as ${filename}` }
}

export async function listBackups() {
  await requireBackupAdmin()
  return availableBackups()
}

export async function deleteDatabaseBackup(filename: string) {
  await requireBackupAdmin()
  await deleteSnapshot(filename)
  return { success: true }
}

export async function restoreDatabase(filename: string) {
  await requireBackupAdmin()
  const safety = await restoreSnapshot(prisma, filename)
  revalidatePath('/', 'layout')
  return { success: true, message: `Database restored successfully. Safety backup: ${safety}` }
}

export async function updateAdminCredentials(currentPassword: string, newEmail: string, newPassword?: string) {
  await requireAdmin()
  const session = await getSession()
  
  if (!session || !session.email) {
    throw new Error("Unauthorized")
  }
  
  // Find current admin
  const admin = await prisma.admin.findUnique({
    where: { email: session.email }
  })
  
  if (!admin) {
    throw new Error("Admin not found")
  }
  
  // Verify current password
  const isValid = await bcrypt.compare(currentPassword, admin.password)
  
  if (!isValid) {
    throw new Error("Current password is incorrect")
  }
  
  // Prepare update data
  const updateData: Prisma.AdminUpdateInput = {
    email: newEmail
  }
  
  // Only update password if a new one is provided
  if (newPassword && newPassword.trim() !== "") {
    if (newPassword.length < 6) {
      throw new Error("New password must be at least 6 characters long")
    }
    updateData.password = await bcrypt.hash(newPassword, 10)
  }
  
  // Check if new email is already taken by another admin
  if (newEmail !== admin.email) {
    const existingAdmin = await prisma.admin.findUnique({
      where: { email: newEmail }
    })
    
    if (existingAdmin) {
      throw new Error("Email is already in use")
    }
  }
  
  await prisma.admin.update({
    where: { id: admin.id },
    data: updateData
  })
  
  return { success: true, message: "Account credentials updated successfully" }
}

export async function getTaxSettings() {
  return prisma.taxSetting.findMany({
    orderBy: { createdAt: 'desc' }
  })
}

export async function getActiveTaxSetting() {
  return prisma.taxSetting.findFirst({
    where: { isActive: true }
  })
}

export async function createTaxSetting(name: string, percentage: number, isActive = false) {
  await requireAdmin()
  if (isActive) {
    // Deactivate all others first
    await prisma.taxSetting.updateMany({
      data: { isActive: false }
    })
  }
  
  const taxSetting = await prisma.taxSetting.create({
    data: { name, percentage, isActive }
  })
  
  revalidatePath('/settings')
  return taxSetting
}

export async function updateTaxSetting(id: string, name: string, percentage: number) {
  await requireAdmin()
  const taxSetting = await prisma.taxSetting.update({
    where: { id },
    data: { name, percentage }
  })
  
  revalidatePath('/settings')
  return taxSetting
}

export async function activateTaxSetting(id: string) {
  await requireAdmin()
  await prisma.$transaction([
    prisma.taxSetting.updateMany({
      data: { isActive: false }
    }),
    prisma.taxSetting.update({
      where: { id },
      data: { isActive: true }
    })
  ])
  
  revalidatePath('/settings')
  return { success: true }
}

export async function deleteTaxSetting(id: string) {
  await requireAdmin()
  await prisma.taxSetting.delete({
    where: { id }
  })
  
  revalidatePath('/settings')
  return { success: true }
}
