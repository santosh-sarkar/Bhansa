export interface ApiError {
  code: string;
  message: string;
  status: number;
  details?: Record<string, string[]>;
}

export interface ApiResponse<T> {
  data: T;
  error?: never;
}

export interface ApiErrorResponse {
  data?: never;
  error: ApiError;
}

export type ApiResult<T> = ApiResponse<T> | ApiErrorResponse;

interface RequestOptions extends RequestInit {
  outletId?: string;
  params?: Record<string, string | number | boolean | undefined>;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

function buildUrl(endpoint: string, params?: Record<string, string | number | boolean | undefined>): string {
  const url = new URL(API_BASE_URL + endpoint);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });
  }
  return url.toString();
}

function getAuthHeaders(): HeadersInit {
  // Cookies are automatically sent with credentials: 'include'
  return {};
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<ApiResult<T>> {
  const { outletId, params, headers, ...fetchOptions } = options;

  const requestHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
    ...(outletId ? { 'X-Outlet-Id': outletId } : {}),
    ...headers,
  };

  try {
    const response = await fetch(buildUrl(endpoint, params), {
      ...fetchOptions,
      headers: requestHeaders,
      credentials: 'include',
    });

    const contentType = response.headers.get('content-type');
    const isJson = contentType?.includes('application/json');
    const body = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      const error: ApiError = {
        code: isJson ? body?.error?.code ?? 'UNKNOWN_ERROR' : 'UNKNOWN_ERROR',
        message: isJson ? body?.error?.message ?? 'An unexpected error occurred' : 'An unexpected error occurred',
        status: response.status,
        details: isJson ? body?.error?.details : undefined,
      };
      return { error };
    }

    if (response.status === 204) {
      return { data: undefined as unknown as T };
    }

    return { data: body as T };
  } catch (err) {
    if (err instanceof TypeError && err.message.includes('fetch')) {
      return {
        error: {
          code: 'NETWORK_ERROR',
          message: 'Unable to connect to the server. Please check your connection.',
          status: 0,
        },
      };
    }
    return {
      error: {
        code: 'UNKNOWN_ERROR',
        message: err instanceof Error ? err.message : 'An unexpected error occurred',
        status: 0,
      },
    };
  }
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
};
