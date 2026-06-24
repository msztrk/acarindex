import { describe, expect, it } from 'vitest'
import {
  canAccessAdminPanel,
  canAssignSuperAdmin,
  canManageUsers,
  hasPermission,
  PERMISSION_MATRIX,
} from '@/lib/auth/roles'

describe('role authorization', () => {
  it('USER cannot access admin', () => {
    expect(canAccessAdminPanel(['USER'])).toBe(false)
  })

  it('EDITOR can access admin', () => {
    expect(canAccessAdminPanel(['EDITOR'])).toBe(true)
  })

  it('only ADMIN+ can manage users', () => {
    expect(canManageUsers(['MODERATOR'])).toBe(false)
    expect(canManageUsers(['ADMIN'])).toBe(true)
  })

  it('only SUPER_ADMIN can assign super admin', () => {
    expect(canAssignSuperAdmin(['ADMIN'])).toBe(false)
    expect(canAssignSuperAdmin(['SUPER_ADMIN'])).toBe(true)
  })

  it('permission matrix keys resolve', () => {
    expect(hasPermission(['MODERATOR'], 'data_quality.read')).toBe(true)
    expect(hasPermission(['EDITOR'], 'data_quality.read')).toBe(false)
    expect(PERMISSION_MATRIX['admin.panel.access']).toContain('EDITOR')
  })
})

describe('feature flags', () => {
  it('auth disabled by default', async () => {
    const prev = process.env.ENABLE_USER_AUTH
    delete process.env.ENABLE_USER_AUTH
    delete process.env.NEXT_PUBLIC_ENABLE_USER_AUTH
    const { isUserAuthEnabled } = await import('@/lib/features/user-auth')
    expect(isUserAuthEnabled()).toBe(false)
    process.env.ENABLE_USER_AUTH = prev
  })
})
