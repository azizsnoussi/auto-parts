/**
 * Access-token memory store.
 *
 * The long-lived refresh credential is an HttpOnly cookie issued by the API,
 * so JavaScript cannot read it. The access token deliberately lives only in
 * memory. Most importantly, no profile, role or permission is persisted in a
 * cookie or localStorage; identity is always hydrated from an authenticated
 * server response.
 */
let accessToken: string | null = null
let accessTokenExpiresAt = 0

const LEGACY_COOKIE_KEYS = [
  'ba_access_token',
  'ba_refresh_token',
  'ba_user',
  'ba_token_expiry',
]

const LEGACY_STORAGE_KEYS = [...LEGACY_COOKIE_KEYS, 'adminToken']

export function saveAccessSession(token: string, expiresIn = 900): void {
  accessToken = token
  accessTokenExpiresAt = Date.now() + Math.max(0, expiresIn) * 1000
}

export function getAccessToken(): string | null {
  return accessToken
}

export function isTokenExpired(): boolean {
  return !accessToken || Date.now() >= accessTokenExpiresAt
}

export function clearAccessSession(): void {
  accessToken = null
  accessTokenExpiresAt = 0
}

/** Remove data written by older releases. Never migrates insecure credentials. */
export function clearLegacyAuthStorage(): void {
  for (const name of LEGACY_COOKIE_KEYS) {
    document.cookie = `${encodeURIComponent(name)}=; path=/; max-age=0; SameSite=Strict`
    // Older deployments may have scoped the same cookie to /api.
    document.cookie = `${encodeURIComponent(name)}=; path=/api; max-age=0; SameSite=Strict`
  }
  try {
    for (const key of LEGACY_STORAGE_KEYS) localStorage.removeItem(key)
  } catch {
    // Storage can be unavailable in hardened/private browser contexts.
  }
}
