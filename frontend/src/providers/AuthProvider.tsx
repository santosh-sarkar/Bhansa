'use client'

import { useAuth } from '@/features/auth/controllers/useAuth'
import { ReactNode, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { routes } from '@/config/routes'
import { SocketProvider, connectSocket, disconnectSocket } from '@/lib/socket'

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, refreshAuth } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  // Manage socket connection based on auth state
  useEffect(() => {
    if (isAuthenticated) {
      connectSocket()
    } else {
      disconnectSocket()
    }
    return () => {
      // Don't disconnect on unmount - let page navigation handle it
      // Socket persists across page navigations
    }
  }, [isAuthenticated])

  // Only refresh auth on explicit navigation, not on every render
  // The initial fetch happens in useAuth's useQuery
  useEffect(() => {
    // Refresh auth when returning to app after login
    if (isAuthenticated) {
      return
    }
    // If we have a token but not authenticated, try to refresh
    const hasToken = document.cookie.includes('access_token=')
    if (hasToken && !isLoading) {
      refreshAuth()
    }
  }, [pathname, isAuthenticated, isLoading, refreshAuth])

  return (
    <SocketProvider>
      {children}
    </SocketProvider>
  )
}