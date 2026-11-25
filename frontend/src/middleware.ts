import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const publicPaths = ['/login', '/register', '/verify-email', '/forgot-password', '/reset-password', '/accept-invite']
const publicPrefixes = ['/m/', '/api/', '/_next/', '/static/', '/favicon.ico', '/og-image.png']

function isPublicPath(pathname: string): boolean {
  if (publicPaths.includes(pathname)) return true
  return publicPrefixes.some((prefix) => pathname.startsWith(prefix))
}

async function validateSession(request: NextRequest): Promise<boolean> {
  const accessToken = request.cookies.get('access_token')?.value
  const refreshToken = request.cookies.get('refresh_token')?.value
  if (!accessToken) return false

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'
    
    // Forward cookies to backend (backend uses cookie-based auth)
    const cookieHeader = [
      accessToken ? `access_token=${accessToken}` : null,
      refreshToken ? `refresh_token=${refreshToken}` : null,
    ].filter(Boolean).join('; ')

    const response = await fetch(`${apiUrl}/auth/me`, {
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader,
      },
      // Don't block middleware on slow auth check - timeout after 2s
      signal: AbortSignal.timeout(2000),
    })
    return response.ok
  } catch {
    // On network error or timeout, allow through (client-side will handle)
    return true
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  const isValidSession = await validateSession(request)

  if (!isValidSession) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    const response = NextResponse.redirect(loginUrl)
    // Clear invalid cookies
    response.cookies.delete('access_token')
    response.cookies.delete('refresh_token')
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|og-image.png).*)',
  ],
}