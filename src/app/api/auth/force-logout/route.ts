import { NextResponse } from "next/server"

export async function POST() {
  const response = NextResponse.json({ success: true })
  
  // Clear all possible NextAuth cookies
  const cookiesToClear = [
    "next-auth.session-token",
    "__Secure-next-auth.session-token",
    "next-auth.csrf-token",
    "__Host-next-auth.csrf-token",
    "authjs.session-token",
    "__Secure-authjs.session-token",
    "authjs.csrf-token",
    "__Host-authjs.csrf-token",
  ]
  
  cookiesToClear.forEach((name) => {
    response.cookies.set({
      name,
      value: "",
      expires: new Date(0),
      path: "/",
    })
  })
  
  return response
}
