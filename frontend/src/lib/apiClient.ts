export interface ApiError {
  code: string
  message: string
  status: number
  details?: Record<string, string[]>
}

// Backend wraps responses in this envelope
export interface SuccessEnvelope<T> {
  success: true
  data: T
}

// Import auth store for auto outletId resolution
import { useAuthStore } from '@/store/authStore'

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface ApiResponse<T> {
  data: T
  /** Present when the backend responds via sendPaginated(). */
  pagination?: PaginationMeta
  error?: never
}

export interface ApiErrorResponse {
  data?: never
  error: ApiError
}

export type ApiResult<T> = ApiResponse<T> | ApiErrorResponse

interface RequestOptions extends RequestInit {
  outletId?: string
  params?: Record<string, string | number | boolean | undefined>
  skipAuth?: boolean
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'

let isRefreshing = false
let refreshPromise: Promise<string | null> | null = null

function buildUrl(
  endpoint: string,
  params?: Record<string, string | number | boolean | undefined>
): string {
  const url = new URL(API_BASE_URL + endpoint)
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value))
      }
    })
  }
  return url.toString()
}

async function getAccessToken(): Promise<string | null> {
  const { tokenStore } = await import('./tokenStore')
  return tokenStore.accessToken
}

async function refreshAccessToken(): Promise<string | null> {
  // Prevent multiple simultaneous refresh attempts
  if (isRefreshing) {
    return refreshPromise!
  }

  isRefreshing = true
  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      })

      if (!response.ok) {
        return null
      }

      const contentType = response.headers.get('content-type')
      const isJson = contentType?.includes('application/json')
      const body = isJson ? await response.json() : await response.text()

      const accessToken = isJson && body?.data?.accessToken
      if (accessToken) {
        const { tokenStore } = await import('./tokenStore')
        tokenStore.setTokens({ accessToken })
        return accessToken
      }
      return null
    } catch {
      return null
    } finally {
      isRefreshing = false
      refreshPromise = null
    }
  })()

  return refreshPromise
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<ApiResult<T>> {
  const { outletId: explicitOutletId, params, skipAuth, headers, ...fetchOptions } = options

  // Auto-include outletId from auth store if not explicitly provided
  const storeOutletId = useAuthStore.getState().getCurrentOutletId()
  const outletId = explicitOutletId ?? storeOutletId

  const accessToken = skipAuth ? null : await getAccessToken()

  const requestHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    ...(outletId ? { 'X-Outlet-Id': outletId } : {}),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...headers,
  }

  try {
    const response = await fetch(buildUrl(endpoint, params), {
      ...fetchOptions,
      headers: requestHeaders,
      credentials: 'include',
    })

    // Handle 401 - try to refresh token and retry once
    if (response.status === 401 && !skipAuth) {
      const newToken = await refreshAccessToken()
      if (newToken) {
        // Retry with new token
        const retryHeaders = {
          ...requestHeaders,
          Authorization: `Bearer ${newToken}`,
        }
        const retryResponse = await fetch(buildUrl(endpoint, params), {
          ...fetchOptions,
          headers: retryHeaders,
          credentials: 'include',
        })
        return handleResponse<T>(retryResponse)
      }
      // Refresh failed - clear tokens and return error
      const { tokenStore } = await import('./tokenStore')
      tokenStore.clear()
      return {
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Session expired. Please log in again.',
          status: 401,
        },
      }
    }

    return handleResponse<T>(response)
  } catch (err) {
    if (err instanceof TypeError && err.message.includes('fetch')) {
      return {
        error: {
          code: 'NETWORK_ERROR',
          message: 'Unable to connect to the server. Please check your connection.',
          status: 0,
        },
      }
    }
    return {
      error: {
        code: 'UNKNOWN_ERROR',
        message: err instanceof Error ? err.message : 'An unexpected error occurred',
        status: 0,
      },
    }
  }
}

async function handleResponse<T>(response: Response): Promise<ApiResult<T>> {
  const contentType = response.headers.get('content-type')
  const isJson = contentType?.includes('application/json')
  const body = isJson ? await response.json() : await response.text()

  if (!response.ok) {
    const error: ApiError = {
      code: isJson ? body?.error?.code ?? 'UNKNOWN_ERROR' : 'UNKNOWN_ERROR',
      message: isJson ? body?.error?.message ?? 'An unexpected error occurred' : 'An unexpected error occurred',
      status: response.status,
      details: isJson ? body?.error?.details : undefined,
    }
    return { error }
  }

  if (response.status === 204) {
    return { data: undefined as unknown as T }
  }

  // Unwrap SuccessEnvelope if present
  const isEnvelope = isJson && body && typeof body === 'object' && 'success' in body && body.success === true
  const unwrappedBody = isEnvelope ? (body as SuccessEnvelope<T>).data : body
  const pagination = isEnvelope
    ? (body as { pagination?: PaginationMeta }).pagination
    : undefined

  return { data: unwrappedBody as T, pagination }
}

export const api = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    apiClient<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, data?: unknown, options?: RequestOptions) =>
    apiClient<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),

  patch: <T>(endpoint: string, data?: unknown, options?: RequestOptions) =>
    apiClient<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: <T>(endpoint: string, data?: unknown, options?: RequestOptions) =>
    apiClient<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T>(endpoint: string, options?: RequestOptions) =>
    apiClient<T>(endpoint, { ...options, method: 'DELETE' }),
}