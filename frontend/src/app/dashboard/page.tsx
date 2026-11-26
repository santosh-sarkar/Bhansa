'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { getPrimaryRole, getDashboardRoute } from '@/lib/roleUtils'

export default function DashboardRedirect() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const primaryRole = getPrimaryRole(user)
  const dashboardRoute = getDashboardRoute(primaryRole)

  useEffect(() => {
    router.push(dashboardRoute)
  }, [dashboardRoute, router])

  return null
}