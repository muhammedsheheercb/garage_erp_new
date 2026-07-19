"use server"

import prisma from "@/lib/prisma"
import { SettingsFormValues } from "./schema"
import { revalidatePath } from "next/cache"
import fs from "fs/promises"
import path from "path"
import { format } from "date-fns"
import { getSession } from "@/lib/session"
import bcrypt from "bcryptjs"

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
  // Execute sequentially to avoid SQLite locking issues (SQLITE_BUSY)
  for (const [key, value] of Object.entries(data)) {
    await prisma.setting.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) }
    })
  }
  
  revalidatePath('/settings')
  return { success: true }
}

export async function createDatabaseBackup() {
  try {
    const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')
    const backupDir = path.join(process.cwd(), 'prisma', 'backups')
    
    // Ensure backups directory exists
    try {
      await fs.access(backupDir)
    } catch {
      await fs.mkdir(backupDir, { recursive: true })
    }
    
    const timestamp = format(new Date(), 'yyyyMMdd_HHmmss')
    const backupPath = path.join(backupDir, `dev_backup_${timestamp}.db`)
    
    await fs.copyFile(dbPath, backupPath)
    
    return { success: true, message: `Database backed up successfully as dev_backup_${timestamp}.db` }
  } catch (error: any) {
    throw new Error(`Backup failed: ${error.message}`)
  }
}

export async function listBackups() {
  try {
    const backupDir = path.join(process.cwd(), 'prisma', 'backups')
    
    try {
      await fs.access(backupDir)
    } catch {
      return []
    }
    
    const files = await fs.readdir(backupDir)
    return files
      .filter(file => file.endsWith('.db'))
      .sort()
      .reverse() // Newest first
  } catch (error: any) {
    return []
  }
}

export async function restoreDatabase(filename: string) {
  try {
    const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')
    const backupPath = path.join(process.cwd(), 'prisma', 'backups', filename)
    
    // Check if backup exists
    await fs.access(backupPath)
    
    // Make a safety backup of current state before restoring
    const timestamp = format(new Date(), 'yyyyMMdd_HHmmss')
    const safetyBackupPath = path.join(process.cwd(), 'prisma', 'backups', `safety_before_restore_${timestamp}.db`)
    await fs.copyFile(dbPath, safetyBackupPath)
    
    // Replace current db with backup
    await fs.copyFile(backupPath, dbPath)
    
    return { success: true, message: "Database restored successfully. Please restart the application." }
  } catch (error: any) {
    throw new Error(`Restore failed: ${error.message}`)
  }
}

export async function updateAdminCredentials(currentPassword: string, newEmail: string, newPassword?: string) {
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
  const updateData: any = {
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
