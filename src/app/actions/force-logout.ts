"use server"

import { cookies } from "next/headers"

export async function forceLogOut() {
  const cookieStore = await cookies()
  
  const cookieNames = [
    "next-auth.session-token",
    "__Secure-next-auth.session-token",
    "next-auth.csrf-token",
    "__Host-next-auth.csrf-token",
    "authjs.session-token",
    "__Secure-authjs.session-token",
    "authjs.csrf-token",
    "__Host-authjs.csrf-token",
    "next-auth.callback-url",
    "authjs.callback-url"
  ]
  
  for (const name of cookieNames) {
    cookieStore.delete(name)
  }
}
