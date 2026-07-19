import { NextResponse } from "next/server"

const cookiesToClear = [
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
  "next-auth.csrf-token",
  "__Host-next-auth.csrf-token",
  "next-auth.callback-url",
  "__Secure-next-auth.callback-url",
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "authjs.csrf-token",
  "__Host-authjs.csrf-token",
  "authjs.callback-url",
  "__Secure-authjs.callback-url",
]

export async function GET(request: Request) {
  const url = new URL(request.url)
  // Create a redirect response to /login
  const response = NextResponse.redirect(new URL("/login", url.origin))
  
  // Clear all cookies
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

export async function POST() {
  const response = NextResponse.json({ success: true })
  
  // Clear all cookies
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
