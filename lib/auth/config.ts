import { createHash, randomBytes } from 'node:crypto'

export const SESSION_COOKIE = 'acarindex_session'
export const CSRF_COOKIE = 'acarindex_csrf'
export const CSRF_HEADER = 'x-csrf-token'

export const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000 // 14 gün
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000 // 1 saat
export const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000 // 24 saat

export const LOGIN_MAX_ATTEMPTS = 5
export const LOGIN_WINDOW_MS = 15 * 60 * 1000 // 15 dk

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
