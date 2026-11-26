'use client'

const ACCESS_TOKEN_KEY = 'bansa_access_token'

export interface TokenPair {
  accessToken: string
  refreshToken: string
}

class TokenStore {
  private _accessToken: string | null = null
  private _initialized = false

  init(): void {
    if (this._initialized) return
    this._initialized = true
    if (typeof window !== 'undefined') {
      this._accessToken = localStorage.getItem(ACCESS_TOKEN_KEY)
    }
  }

  get accessToken(): string | null {
    this.init()
    return this._accessToken
  }

  setTokens({ accessToken }: { accessToken: string; refreshToken?: string }): void {
    this._accessToken = accessToken
    if (typeof window !== 'undefined') {
      localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
    }
  }

  clear(): void {
    this._accessToken = null
    if (typeof window !== 'undefined') {
      localStorage.removeItem(ACCESS_TOKEN_KEY)
    }
  }
}

export const tokenStore = new TokenStore()