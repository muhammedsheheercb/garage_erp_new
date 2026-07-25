import { decrypt } from "@/lib/session"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { pathToPermission } from "@/lib/permissions"

export async function proxy(request: NextRequest) {
  const sessionCookie = request.cookies.get("garage_session")
  let session = null
  
  if (sessionCookie && sessionCookie.value) {
    const decrypted = decrypt(sessionCookie.value)
    if (decrypted) {
      try {
        const data = JSON.parse(decrypted)
        if (data.role && Array.isArray(data.permissions) && Date.now() - data.createdAt <= 1000 * 60 * 60 * 24) {
          session = data
        }
      } catch (error) {
        session = null
      }
    }
  }
  
  const isAuthPage = request.nextUrl.pathname.startsWith('/login')
  
  if (isAuthPage) {
    if (session) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return null
  }

  if (!session) {
    let from = request.nextUrl.pathname;
    if (request.nextUrl.search) {
      from += request.nextUrl.search;
    }
    return NextResponse.redirect(
      new URL(`/login?from=${encodeURIComponent(from)}`, request.url)
    );
  }

  if (session.role === "EMPLOYEE" && request.nextUrl.pathname.startsWith("/settings")) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  const requiredPermission = pathToPermission(request.nextUrl.pathname)
  // The dashboard route (/) has no module key. Employees can always reach it;
  // actual module pages still require their View permission.
  if (session.role === "EMPLOYEE" && requiredPermission && !session.permissions.includes(requiredPermission)) {
    return NextResponse.redirect(new URL("/", request.url))
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (NextAuth API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
}
