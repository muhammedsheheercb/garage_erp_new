"use server"

import { signOut } from "@/lib/auth"

export async function forceLogOut() {
  await signOut({ redirect: false })
}
