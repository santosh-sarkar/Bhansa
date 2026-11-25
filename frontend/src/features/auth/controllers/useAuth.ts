'use client'

import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { fetchAuthMe, mapAuthMeToUser } from '../services/auth.api'

export function useAuth() {
  const { user, isAuthenticated, isLoading, error, setUser, setLoading, setError, logout } =
    useAuthStore()
  const queryClient = useQueryClient()

  const { data, isLoading: queryLoading, error: queryError, refetch } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchAuthMe,
    retry: false,
    staleTime: 1000 * 60 * 10, // 10 minutes
  })

  useEffect(() => {
    if (data) {
      const mappedUser = mapAuthMeToUser(data)
      setUser(mappedUser)
    }
  }, [data, setUser])

  useEffect(() => {
    setLoading(queryLoading)
  }, [queryLoading, setLoading])

  useEffect(() => {
    if (queryError) {
      setError(queryError instanceof Error ? queryError.message : 'Authentication failed')
      setUser(null)
    }
  }, [queryError, setError, setUser])

  const refreshAuth = () => refetch()

  const login = () => {
    queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
  }

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      // Ignore logout errors
    } finally {
      logout()
      queryClient.clear()
      window.location.href = '/login'
    }
  }

  return {
    user,
    isAuthenticated,
    isLoading: isLoading || queryLoading,
    error,
    refreshAuth,
    login,
    logout: handleLogout,
  }
}

import { api } from '@/lib/apiClient'