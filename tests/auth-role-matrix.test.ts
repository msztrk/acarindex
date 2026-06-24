import { describe, expect, it } from 'vitest'
import { validatePasswordStrength } from '@/lib/auth/password'

describe('change password policy', () => {
  it('rejects weak new passwords', () => {
    expect(validatePasswordStrength('short')).toMatch(/12 karakter/)
  })

  it('accepts policy-compliant passwords', () => {
    expect(validatePasswordStrength('SecurePass2026X')).toBeNull()
  })
})

describe('role matrix expectations', () => {
  it('USER cannot access admin panel', async () => {
    const { canAccessAdminPanel } = await import('@/lib/auth/roles')
    expect(canAccessAdminPanel(['USER'])).toBe(false)
  })

  it('EDITOR can access admin but not user management', async () => {
    const { canAccessAdminPanel, canManageUsers, hasPermission } = await import('@/lib/auth/roles')
    expect(canAccessAdminPanel(['EDITOR'])).toBe(true)
    expect(canManageUsers(['EDITOR'])).toBe(false)
    expect(hasPermission(['EDITOR'], 'catalog.articles.read')).toBe(true)
    expect(hasPermission(['EDITOR'], 'data_quality.read')).toBe(false)
  })

  it('MODERATOR has data quality access', async () => {
    const { hasPermission } = await import('@/lib/auth/roles')
    expect(hasPermission(['MODERATOR'], 'data_quality.read')).toBe(true)
    expect(hasPermission(['MODERATOR'], 'users.read')).toBe(false)
  })

  it('ADMIN can manage users but not SUPER_ADMIN role', async () => {
    const { canManageUsers, canManageRole } = await import('@/lib/auth/roles')
    expect(canManageUsers(['ADMIN'])).toBe(true)
    expect(canManageRole(['ADMIN'], 'SUPER_ADMIN')).toBe(false)
  })

  it('SUPER_ADMIN has full module access flags', async () => {
    const { hasPermission, canManageRole } = await import('@/lib/auth/roles')
    expect(hasPermission(['SUPER_ADMIN'], 'users.read')).toBe(true)
    expect(hasPermission(['SUPER_ADMIN'], 'audit.read')).toBe(true)
    expect(canManageRole(['SUPER_ADMIN'], 'SUPER_ADMIN')).toBe(true)
  })
})
