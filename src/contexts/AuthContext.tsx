import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react'
import { toast } from 'sonner'
import { authApi } from '../lib/api'
import { onForcedLogout, LOGOUT_MESSAGES, reasonFromErrorCode, type AuthLogoutReason } from '../lib/authEvents'
import { sanitizeCustomerPayload } from '../lib/customerSegment'
import {
  saveAccessSession,
  getAccessToken,
  isTokenExpired,
  clearAccessSession,
  clearLegacyAuthStorage,
} from '../lib/cookies'

export interface AuthUser {
  /**
   * Opaque account UUID (`AppUser.publicId`). The backend stopped exposing the
   * sequential `users` key, so this is a string and must never be used for
   * arithmetic or ordering.
   */
  id: string
  /**
   * Id of the row in `customers`. Different from `id` (which identifies the
   * account) and required by every customer-scoped endpoint: orders, vehicles,
   * appointments, loyalty. Absent for staff accounts, which have no CRM row.
   */
  customerId?: number
  firstName: string
  lastName: string
  email: string
  phone?: string
  role: string
  avatarUrl?: string
  address?: string
  city?: string
  preferredLanguage: string
  preferredTheme: string
  branchId?: number
  branchName?: string
  twoFactorEnabled: boolean
  emailVerified: boolean
  /**
   * Extra permissions granted on top of `role` (backend `Permission` enum
   * names, e.g. `CUSTOMER_VIEW`). The backend accepts a request when the role
   * *or* one of these matches, so the admin navigation has to look at them too
   * — otherwise a granted permission would be authorised but unreachable.
   */
  permissions?: string[]
}

export const ADMIN_ROLES = [
  'SUPER_ADMIN', 'BRANCH_ADMIN', 'MANAGER', 'RECEPTIONIST',
  'MECHANIC', 'CAR_WASH_EMPLOYEE', 'STOCK_MANAGER', 'ACCOUNTANT', 'FLEET_MANAGER',
]

interface AuthContextType {
  user: AuthUser | null
  isAuthenticated: boolean
  isAdmin: boolean
  isSuperAdmin: boolean
  token: string | null
  hasRole: (...roles: string[]) => boolean
  /** True when the account holds at least one of the given extra permissions. */
  hasPermission: (...permissions: string[]) => boolean
  login: (email: string, password: string) => Promise<AuthUser>
  register: (data: object) => Promise<AuthUser>
  logout: () => Promise<void>
  /**
   * Persists profile changes and refreshes the local user. The backend also
   * mirrors name/phone/address/city into the customer's CRM row.
   */
  updateProfile: (data: object) => Promise<AuthUser>
  /** Changes the password and closes every current session on success. */
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  /**
   * Validates the session against the server (refreshing if needed) and
   * disconnects if it is dead. Call this on navigation.
   */
  validateSession: () => Promise<boolean>
  loading: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

/** How often to check token expiry (every 10 seconds) */
const EXPIRY_CHECK_INTERVAL_MS = 10_000

/**
 * How often to ask the server whether the session is still alive while the tab
 * is open and visible.
 *
 * A lock performed by an admin is invisible to the client: the access token
 * stays cryptographically valid until it expires (15 min). Route changes and
 * tab focus already trigger a check, but a user sitting idle on one page would
 * otherwise keep their session for up to the full token lifetime. This
 * heartbeat closes that window to ~15 s.
 */
const SESSION_HEARTBEAT_MS = 15_000

/** Don't re-ping /auth/me more than once per this window (navigation bursts) */
const VALIDATION_THROTTLE_MS = 5_000

/** localStorage key used only to broadcast logout across tabs */
const LOGOUT_BROADCAST_KEY = 'ba_logout_broadcast'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const expiryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const refreshingRef = useRef(false)
  const lastValidatedRef = useRef(0)
  const validatingRef = useRef<Promise<boolean> | null>(null)
  const hadSessionRef = useRef(false)

  // ── Disconnect: clear cookies, stop watcher & reset state ──────────
  const disconnect = useCallback((reason?: AuthLogoutReason) => {
    if (expiryTimerRef.current) {
      clearInterval(expiryTimerRef.current)
      expiryTimerRef.current = null
    }
    lastValidatedRef.current = 0
    const hadSession = hadSessionRef.current
    hadSessionRef.current = false
    clearAccessSession()
    setUser(null)
    if (hadSession && reason) toast.error(LOGOUT_MESSAGES[reason])
  }, [])

  // ── Expiry check: refresh if possible, otherwise auto-logout ───────
  const checkExpiry = useCallback(async () => {
    if (!isTokenExpired()) return
    if (refreshingRef.current) return

    refreshingRef.current = true
    try {
      const { data } = await authApi.refresh()
      const { accessToken, expiresIn, user: profile } = data.data
      saveAccessSession(accessToken, expiresIn)
      if (profile) setUser(profile as AuthUser)
    } catch (err: any) {
      // The refresh token is rejected when it expired, was rotated away, or the
      // account was locked/deactivated by an admin.
      disconnect(reasonFromErrorCode(err?.response?.data?.message) ?? 'refresh-failed')
    } finally {
      refreshingRef.current = false
    }
  }, [disconnect])

  /**
   * Server-side session validation. Used on navigation so an admin-initiated
   * lock (which the client cannot detect on its own) disconnects on the next
   * click instead of lingering until the access token expires.
   */
  const validateSession = useCallback(async (): Promise<boolean> => {
    if (!getAccessToken()) return false
    if (validatingRef.current) return validatingRef.current

    const now = Date.now()
    if (now - lastValidatedRef.current < VALIDATION_THROTTLE_MS && !isTokenExpired()) {
      return true
    }

    const run = (async () => {
      await checkExpiry()
      if (!getAccessToken()) return false
      try {
        const { data } = await authApi.me()
        const profile = data?.data
        if (profile) {
          setUser(profile as AuthUser)
        }
        lastValidatedRef.current = Date.now()
        return true
      } catch (err: any) {
        const status = err?.response?.status
        const reason = reasonFromErrorCode(err?.response?.data?.message)
        // Network hiccups must not log anybody out — only real auth failures do.
        if (reason || status === 401) {
          disconnect(reason ?? 'unauthorized')
          return false
        }
        return true
      } finally {
        validatingRef.current = null
      }
    })()

    validatingRef.current = run
    return run
  }, [checkExpiry, disconnect])

  // ── Expiry watcher: interval + tab focus / visibility ──────────────
  const startExpiryWatcher = useCallback(() => {
    if (expiryTimerRef.current) clearInterval(expiryTimerRef.current)
    expiryTimerRef.current = setInterval(checkExpiry, EXPIRY_CHECK_INTERVAL_MS)
  }, [checkExpiry])

  const stopExpiryWatcher = useCallback(() => {
    if (expiryTimerRef.current) {
      clearInterval(expiryTimerRef.current)
      expiryTimerRef.current = null
    }
  }, [])

  // ── Init: restore through the server-only HttpOnly refresh cookie ──
  useEffect(() => {
    // Never upgrade JavaScript-readable legacy credentials into the new
    // session. Delete them, including ba_user (role/permissions), immediately.
    clearLegacyAuthStorage()

    authApi.refresh()
      .then(({ data }) => {
        const { accessToken, expiresIn, user: profile } = data.data
        saveAccessSession(accessToken, expiresIn)
        setUser(profile as AuthUser)
        hadSessionRef.current = true
        startExpiryWatcher()
      })
      .catch(() => clearAccessSession())
      .finally(() => setLoading(false))

    return () => stopExpiryWatcher()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Forced logout from the API layers (401 / locked / refresh failed) ─
  useEffect(() => onForcedLogout((reason) => disconnect(reason)), [disconnect])

  // ── Re-check expiry when the tab regains focus / becomes visible ────
  // The interval is throttled or paused in background tabs, so a session can
  // expire while the tab is hidden. Checking on focus catches that instantly.
  useEffect(() => {
    if (!user) return

    const onVisible = () => {
      if (document.visibilityState === 'visible') void validateSession()
    }
    window.addEventListener('focus', onVisible)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', onVisible)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [user, validateSession])

  // ── Session heartbeat ───────────────────────────────────────────────
  // Detects server-side revocation (admin locked or deactivated the account)
  // even when the user never navigates and never leaves the tab. Without this
  // an idle page keeps a locked user "logged in" until the access token expires.
  useEffect(() => {
    if (!user) return

    const beat = () => {
      // Skip while hidden: the visibilitychange listener above re-validates as
      // soon as the tab comes back, so polling in the background is wasted work.
      if (document.visibilityState !== 'visible') return
      void validateSession()
    }
    const timer = setInterval(beat, SESSION_HEARTBEAT_MS)
    return () => clearInterval(timer)
  }, [user, validateSession])

  // ── Cross-tab sync: logging out in one tab logs out the others ──────
  useEffect(() => {
    if (!user) return
    const onStorage = (e: StorageEvent) => {
      if (e.key === LOGOUT_BROADCAST_KEY) disconnect()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [user, disconnect])

  // ── Login ──────────────────────────────────────────────────────────
  const login = async (email: string, password: string) => {
    const { data } = await authApi.login({ email, password })
    const { accessToken, expiresIn, user: profile } = data.data
    saveAccessSession(accessToken, expiresIn)
    setUser(profile)
    hadSessionRef.current = true
    lastValidatedRef.current = Date.now()
    startExpiryWatcher()
    return profile as AuthUser
  }

  // ── Register ───────────────────────────────────────────────────────
  const register = async (formData: object) => {
    const safePayload = sanitizeCustomerPayload(formData as Record<string, any>)
    const { data } = await authApi.register(safePayload)
    const { accessToken, expiresIn, user: profile } = data.data
    saveAccessSession(accessToken, expiresIn)
    setUser(profile)
    hadSessionRef.current = true
    lastValidatedRef.current = Date.now()
    startExpiryWatcher()
    return profile as AuthUser
  }

  // ── Profile update ─────────────────────────────────────────────────
  const updateProfile = async (formData: object): Promise<AuthUser> => {
    const { data } = await authApi.updateProfile(formData)
    const profile = (data?.data ?? data) as AuthUser
    setUser(profile)
    lastValidatedRef.current = Date.now()
    return profile
  }

  const changePassword = async (currentPassword: string, newPassword: string) => {
    await authApi.changePassword({ currentPassword, newPassword })
    stopExpiryWatcher()
    disconnect()
    try { localStorage.setItem(LOGOUT_BROADCAST_KEY, String(Date.now())) } catch { /* ignore */ }
  }

  // ── Logout ─────────────────────────────────────────────────────────
  const logout = async () => {
    try { await authApi.logout() } catch { /* ignore */ }
    stopExpiryWatcher()
    disconnect()
    // Tell other open tabs to drop their session too
    try { localStorage.setItem(LOGOUT_BROADCAST_KEY, String(Date.now())) } catch { /* ignore */ }
  }

  const hasRole = (...roles: string[]) => !!user && roles.includes(user.role)

  const hasPermission = (...permissions: string[]) =>
    !!user?.permissions?.length && permissions.some(p => user.permissions!.includes(p))

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isAdmin: !!user && ADMIN_ROLES.includes(user.role),
      isSuperAdmin: !!user && user.role === 'SUPER_ADMIN',
      token: getAccessToken(),
      hasRole,
      hasPermission,
      login,
      register,
      logout,
      updateProfile,
      changePassword,
      validateSession,
      loading,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
