import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const publicPaths = ['/login', '/register', '/verify-email', '/forgot-password', '/reset-password', '/accept-invite']
const publicPrefixes = ['/m/', '/api/', '/_next/', '/static/', '/favicon.ico', '/og-image.png']

function isPublicPath(pathname: string): boolean {
  if (publicPaths.includes(pathname)) return true
  return publicPrefixes.some((prefix) => pathname.startsWith(prefix))
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  const hasAccessToken = request.cookies.has('access_token')

  if (!hasAccessToken) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|og-image.png).*)',
  ],
}