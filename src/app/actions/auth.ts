"use server"

import { signOut } from "@/lib/auth"

export async function logOut() {
  await signOut({ redirect: false })
}
