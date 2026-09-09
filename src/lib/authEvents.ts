/**
 * Tiny event bus used to signal a forced logout from non-React code
 * (e.g. the axios response interceptor) to the AuthProvider.
 *
 * This avoids `window.location.href = '/login'` full page reloads and lets
 * React clear its auth state + redirect through the router instead.
 */

export type AuthLogoutReason =
  | 'expired'
  | 'refresh-failed'
  | 'unauthorized'
  | 'account-locked'
  | 'account-disabled'

/** User-facing French message shown by the toast when the session dies. */
export const LOGOUT_MESSAGES: Record<AuthLogoutReason, string> = {
  'expired': 'Votre session a expiré. Veuillez vous reconnecter.',
  'refresh-failed': 'Votre session a expiré. Veuillez vous reconnecter.',
  'unauthorized': 'Votre session n’est plus valide. Veuillez vous reconnecter.',
  'account-locked': 'Votre compte a été verrouillé par un administrateur.',
  'account-disabled': 'Votre compte a été désactivé.',
}

/**
 * Maps the backend's machine-readable code (sent in the `message` field of the
 * error envelope) to a logout reason. Returns `null` when the failure is not a
 * session problem (e.g. a plain role-based 403).
 */
export function reasonFromErrorCode(code: unknown): AuthLogoutReason | null {
  switch (code) {
    case 'ACCOUNT_LOCKED':
      return 'account-locked'
    case 'ACCOUNT_DISABLED':
      return 'account-disabled'
    case 'TOKEN_EXPIRED':
    case 'REFRESH_EXPIRED':
      return 'expired'
    case 'TOKEN_INVALID':
    case 'REFRESH_INVALID':
    case 'NO_SESSION':
      return 'unauthorized'
    default:
      return null
  }
}

const FORCED_LOGOUT_EVENT = 'ba:auth:forced-logout'

/** Notify listeners that the session is no longer valid. */
export function emitForcedLogout(reason: AuthLogoutReason = 'expired'): void {
  window.dispatchEvent(new CustomEvent<AuthLogoutReason>(FORCED_LOGOUT_EVENT, { detail: reason }))
}

/** Subscribe to forced logout events. Returns an unsubscribe function. */
export function onForcedLogout(handler: (reason: AuthLogoutReason) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<AuthLogoutReason>).detail ?? 'expired')
  window.addEventListener(FORCED_LOGOUT_EVENT, listener)
  return () => window.removeEventListener(FORCED_LOGOUT_EVENT, listener)
}
