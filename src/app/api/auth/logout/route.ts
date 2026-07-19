import { clearSession } from "@/lib/session"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  await clearSession()
  const url = new URL(request.url)
  return NextResponse.redirect(new URL("/login", url.origin))
}
