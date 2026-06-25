import { createHash, randomBytes } from 'node:crypto'

export const SESSION_COOKIE = 'acarindex_session'
export const CSRF_COOKIE = 'acarindex_csrf'
export const CSRF_HEADER = 'x-csrf-token'

export const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000 // 14 gün
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000 // 1 saat
export const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000 // 24 saat

export const LOGIN_MAX_ATTEMPTS = 5
export const LOGIN_WINDOW_MS = 15 * 60 * 1000 // 15 dk

export const VERIFY_RESEND_MAX = 3
export const VERIFY_RESEND_WINDOW_MS = 60 * 60 * 1000 // 1 saat

export const FORGOT_PASSWORD_MAX = 5
export const FORGOT_PASSWORD_WINDOW_MS = 60 * 60 * 1000

export const REGISTER_MAX_PER_IP = 10
export const REGISTER_WINDOW_MS = 60 * 60 * 1000

export const TOKEN_ATTEMPT_MAX = 10
export const TOKEN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000

export const DELETION_GRACE_DAYS = 14

export const LEGAL_DOC_TYPES = {
  TERMS: 'terms',
  PRIVACY: 'privacy',
  MARKETING: 'marketing',
} as const

export const BCRYPT_ROUNDS = 12

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function isProductionEnv(): boolean {
  return process.env.NODE_ENV === 'production'
}

export function cookieSecure(): boolean {
  return process.env.AUTH_COOKIE_SECURE === '1' || isProductionEnv()
}
