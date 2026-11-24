import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiClient, api } from './apiClient'

describe('apiClient', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('should be defined', () => {
    expect(apiClient).toBeDefined()
    expect(api.get).toBeDefined()
    expect(api.post).toBeDefined()
    expect(api.patch).toBeDefined()
    expect(api.put).toBeDefined()
    expect(api.delete).toBeDefined()
  })

  it('should have correct types for ApiError', () => {
    const error = {
      code: 'TEST_ERROR',
      message: 'Test error message',
      status: 400,
      details: { field: ['error'] },
    }
    expect(error.code).toBe('TEST_ERROR')
    expect(error.status).toBe(400)
  })
})