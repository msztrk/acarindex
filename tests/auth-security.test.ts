import { describe, expect, it } from 'vitest'
import { validatePasswordStrength } from '@/lib/auth/password'
import { parsePagination, MAX_PAGE_SIZE } from '@/lib/admin/pagination'
import { hashToken, generateToken } from '@/lib/auth/config'

describe('password strength', () => {
  it('rejects short passwords', () => {
    expect(validatePasswordStrength('short')).toMatch(/12 karakter/)
  })

  it('accepts strong passwords', () => {
    expect(validatePasswordStrength('AcarBeta2026Xk9m')).toBeNull()
  })
})

describe('pagination limits', () => {
  it('caps page size', () => {
    const { pageSize } = parsePagination({ pageSize: '9999' })
    expect(pageSize).toBe(MAX_PAGE_SIZE)
  })

  it('defaults invalid page to 1', () => {
    const { page } = parsePagination({ page: '-5' })
    expect(page).toBe(1)
  })
})

describe('token hashing', () => {
  it('does not leak raw token in hash', () => {
    const raw = generateToken()
    const hash = hashToken(raw)
    expect(hash).not.toContain(raw)
    expect(hash.length).toBe(64)
  })
})
