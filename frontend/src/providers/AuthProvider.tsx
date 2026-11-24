'use client'

import { useAuth } from '@/features/auth/controllers/useAuth'
import { ReactNode } from 'react'

export function AuthProvider({ children }: { children: ReactNode }) {
  useAuth()
  return <>{children}</>
}