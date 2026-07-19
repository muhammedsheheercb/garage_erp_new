import { cookies } from "next/headers"
import crypto from "crypto"

const SESSION_COOKIE_NAME = "garage_session"
const SESSION_SECRET = process.env.AUTH_SECRET || "default_super_secure_garage_erp_key_123456"

// AES-256-GCM configuration
const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12

function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const key = crypto.scryptSync(SESSION_SECRET, "salt", 32)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  
  let encrypted = cipher.update(text, "utf8", "hex")
  encrypted += cipher.final("hex")
  
  const authTag = cipher.getAuthTag().toString("hex")
  
  // Return format: iv:encryptedData:authTag
  return `${iv.toString("hex")}:${encrypted}:${authTag}`
}

export function decrypt(encryptedText: string): string | null {
  try {
    const parts = encryptedText.split(":")
    if (parts.length !== 3) return null
    
    const iv = Buffer.from(parts[0], "hex")
    const encrypted = parts[1]
    const authTag = Buffer.from(parts[2], "hex")
    
    const key = crypto.scryptSync(SESSION_SECRET, "salt", 32)
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)
    
    let decrypted = decipher.update(encrypted, "hex", "utf8")
    decrypted += decipher.final("utf8")
    
    return decrypted
  } catch (error) {
    return null
  }
}

export interface SessionData {
  userId: string
  email: string
  createdAt: number
}

export async function createSession(userId: string, email: string) {
  const sessionData: SessionData = {
    userId,
    email,
    createdAt: Date.now()
  }
  
  const encrypted = encrypt(JSON.stringify(sessionData))
  const cookieStore = await cookies()
  
  cookieStore.set(SESSION_COOKIE_NAME, encrypted, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  })
}

export async function getSession(): Promise<SessionData | null> {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)
    
    if (!sessionCookie || !sessionCookie.value) {
      return null
    }
    
    const decrypted = decrypt(sessionCookie.value)
    if (!decrypted) {
      return null
    }
    
    const data: SessionData = JSON.parse(decrypted)
    
    // Check if session has expired (7 days)
    if (Date.now() - data.createdAt > 1000 * 60 * 60 * 24 * 7) {
      return null
    }
    
    return data
  } catch (error) {
    return null
  }
}

export async function clearSession() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
}

export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession()
  return session !== null
}
