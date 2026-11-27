'use client'

import { useAuth } from '@/features/auth/controllers/useAuth'
import { ReactNode, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { routes } from '@/config/routes'
import { SocketProvider, connectSocket, disconnectSocket, connectGuestSocket } from '@/lib/socket'
import { tokenStore } from '@/lib/tokenStore'

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, refreshAuth } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const wasAuthenticated = useRef(false)

  // Manage socket connection based on auth state transitions
  useEffect(() => {
    if (isAuthenticated) {
      connectSocket()
      wasAuthenticated.current = true
    } else if (wasAuthenticated.current) {
      // Only disconnect if we were previously authenticated (avoid tearing down guest connection)
      disconnectSocket()
      wasAuthenticated.current = false
    } else {
      // Guest - ensure guest socket is connected for session rooms
      connectGuestSocket()
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
    const hasToken = !!tokenStore.accessToken
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