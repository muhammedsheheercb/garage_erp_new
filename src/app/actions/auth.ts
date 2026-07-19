"use server"

import prisma from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { createSession, clearSession } from "@/lib/session"

export async function loginAction(email: string, password: string) {
  if (!email || !password) {
    return { success: false, error: "Email and password are required" }
  }
  
  try {
    const user = await prisma.admin.findUnique({
      where: { email }
    })
    
    if (!user || !user.password) {
      return { success: false, error: "Invalid email or password" }
    }
    
    const isPasswordValid = await bcrypt.compare(password, user.password)
    
    if (!isPasswordValid) {
      return { success: false, error: "Invalid email or password" }
    }
    
    await createSession(user.id, user.email)
    return { success: true }
  } catch (error) {
    console.error("Login action error:", error)
    return { success: false, error: "An unexpected error occurred. Please try again." }
  }
}

export async function logoutAction() {
  await clearSession()
}
