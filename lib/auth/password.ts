import bcrypt from 'bcryptjs'
import { BCRYPT_ROUNDS } from '@/lib/auth/config'

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function validatePasswordStrength(password: string): string | null {
  if (password.length < 12) {
    return 'Parola en az 12 karakter olmalıdır.'
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Parola büyük harf, küçük harf ve rakam içermelidir.'
  }
  return null
}
