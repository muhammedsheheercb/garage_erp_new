"use server"

import { signOut } from "@/lib/auth"
import { redirect } from "next/navigation"

export async function logOutAction() {
  await signOut({ redirect: false })
  redirect("/login")
}
