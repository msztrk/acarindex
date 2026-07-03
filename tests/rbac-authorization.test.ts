import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  isApprovedMembershipStatus,
  journalRoleSatisfies,
  institutionRoleSatisfies,
  hasAdminPermission,
  canEditJournal,
  canManageJournalMembers,
  requireJournalAccess,
  requireInstitutionAccess,
  ForbiddenError,
} from '@/lib/auth/authorization'
import { ROLE_ADMIN_PERMISSION_BACKFILL } from '@/lib/auth/admin-permissions'
import { requiresChangeRequest, isLowRiskArticleField } from '@/lib/auth/change-policy'
import { canAccessAdminPanel, hasPermission, DEPRECATED_GLOBAL_EDITOR_ROLE } from '@/lib/auth/roles'
import { isForbiddenError } from '@/lib/auth/forbidden'

const mockPrisma = vi.hoisted(() => ({
  userRole: { findUnique: vi.fn(), findMany: vi.fn() },
  adminPermission: { findMany: vi.fn() },
  journalMembership: { findUnique: vi.fn(), findMany: vi.fn() },
  institutionMembership: { findUnique: vi.fn(), findMany: vi.fn() },
  auditLog: { create: vi.fn() },
}))

vi.mock('@/lib/db/prisma', () => ({ prisma: mockPrisma }))

describe('RBAC membership status', () => {
  it('only approved membership grants access', () => {
    expect(isApprovedMembershipStatus('approved')).toBe(true)
    expect(isApprovedMembershipStatus('pending')).toBe(false)
    expect(isApprovedMembershipStatus('suspended')).toBe(false)
    expect(isApprovedMembershipStatus('revoked')).toBe(false)
    expect(isApprovedMembershipStatus('rejected')).toBe(false)
  })
})

describe('journal role hierarchy', () => {
  it('journal_owner satisfies editor requirement', () => {
    expect(journalRoleSatisfies('journal_owner', 'journal_editor')).toBe(true)
    expect(journalRoleSatisfies('journal_owner', 'journal_owner')).toBe(true)
  })

  it('journal_editor does not satisfy owner requirement', () => {
    expect(journalRoleSatisfies('journal_editor', 'journal_owner')).toBe(false)
    expect(journalRoleSatisfies('journal_editor', 'journal_editor')).toBe(true)
  })
})

describe('institution role hierarchy', () => {
  it('institution_manager can view and manage', () => {
    expect(institutionRoleSatisfies('institution_manager', 'institution_viewer')).toBe(true)
    expect(institutionRoleSatisfies('institution_manager', 'institution_manager')).toBe(true)
  })

  it('institution_viewer cannot manage', () => {
    expect(institutionRoleSatisfies('institution_viewer', 'institution_manager')).toBe(false)
    expect(institutionRoleSatisfies('institution_viewer', 'institution_viewer')).toBe(true)
  })
})

describe('global roles and EDITOR deprecation', () => {
  it('USER cannot access admin panel via legacy roles', () => {
    expect(canAccessAdminPanel(['USER'])).toBe(false)
  })

  it('USER does not receive admin permissions in backfill map', () => {
    expect(ROLE_ADMIN_PERMISSION_BACKFILL.USER).toBeUndefined()
  })

  it('EDITOR is deprecated and only gets legacy_admin_access in backfill', () => {
    expect(DEPRECATED_GLOBAL_EDITOR_ROLE).toBe('EDITOR')
    expect(ROLE_ADMIN_PERMISSION_BACKFILL.EDITOR).toEqual(['legacy_admin_access'])
  })

  it('SUPER_ADMIN backfill includes all permissions', () => {
    expect(ROLE_ADMIN_PERMISSION_BACKFILL.SUPER_ADMIN).toContain('manage_users')
    expect(ROLE_ADMIN_PERMISSION_BACKFILL.SUPER_ADMIN).toContain('manage_system_settings')
  })

  it('legacy EDITOR can access admin via role matrix but not data_quality', () => {
    expect(canAccessAdminPanel(['EDITOR'])).toBe(true)
    expect(hasPermission(['EDITOR'], 'data_quality.read')).toBe(false)
  })
})

describe('hasAdminPermission with DB source of truth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.adminPermission.findMany.mockResolvedValue([])
    mockPrisma.userRole.findMany.mockResolvedValue([])
  })

  it('USER cannot get admin permission from DB or legacy', async () => {
    mockPrisma.userRole.findMany.mockResolvedValue([{ roleId: 'USER' }])
    expect(await hasAdminPermission('u1', 'manage_users')).toBe(false)
  })

  it('returns true when active DB permission exists', async () => {
    mockPrisma.adminPermission.findMany.mockResolvedValue([{ permission: 'manage_users' }])
    expect(await hasAdminPermission('u1', 'manage_users')).toBe(true)
  })

  it('revoked permission in DB falls back to legacy only', async () => {
    mockPrisma.adminPermission.findMany.mockResolvedValue([])
    mockPrisma.userRole.findMany.mockResolvedValue([{ roleId: 'ADMIN' }])
    expect(await hasAdminPermission('u1', 'manage_users', ['ADMIN'])).toBe(true)
  })

  it('permission revoked in DB and no legacy role denies access', async () => {
    mockPrisma.adminPermission.findMany.mockResolvedValue([])
    mockPrisma.userRole.findMany.mockResolvedValue([{ roleId: 'USER' }])
    expect(await hasAdminPermission('u1', 'manage_users', ['USER'])).toBe(false)
  })
})

describe('journal access helpers', () => {
  beforeEach(() => vi.clearAllMocks())

  it('approved journal_editor can edit own journal', async () => {
    mockPrisma.journalMembership.findUnique.mockResolvedValue({
      id: 'm1',
      userId: 'u1',
      journalId: BigInt(10),
      role: 'journal_editor',
      status: 'approved',
    })
    expect(await canEditJournal('u1', BigInt(10))).toBe(true)
  })

  it('journal editor cannot edit another journal', async () => {
    mockPrisma.journalMembership.findUnique.mockResolvedValue(null)
    expect(await canEditJournal('u1', BigInt(99))).toBe(false)
  })

  it('suspended membership does not grant edit access', async () => {
    mockPrisma.journalMembership.findUnique.mockResolvedValue({
      id: 'm1',
      userId: 'u1',
      journalId: BigInt(10),
      role: 'journal_editor',
      status: 'suspended',
    })
    expect(await canEditJournal('u1', BigInt(10))).toBe(false)
  })

  it('revoked membership does not grant edit access', async () => {
    mockPrisma.journalMembership.findUnique.mockResolvedValue({
      id: 'm1',
      userId: 'u1',
      journalId: BigInt(10),
      role: 'journal_editor',
      status: 'revoked',
    })
    await expect(requireJournalAccess('u1', BigInt(10))).rejects.toThrow(ForbiddenError)
  })

  it('journal owner can manage members', async () => {
    mockPrisma.journalMembership.findUnique.mockResolvedValue({
      id: 'm1',
      userId: 'u1',
      journalId: BigInt(10),
      role: 'journal_owner',
      status: 'approved',
    })
    expect(await canManageJournalMembers('u1', BigInt(10))).toBe(true)
  })

  it('journal editor cannot manage members', async () => {
    mockPrisma.journalMembership.findUnique.mockResolvedValue({
      id: 'm1',
      userId: 'u1',
      journalId: BigInt(10),
      role: 'journal_editor',
      status: 'approved',
    })
    expect(await canManageJournalMembers('u1', BigInt(10))).toBe(false)
  })
})

describe('institution access helpers', () => {
  beforeEach(() => vi.clearAllMocks())

  it('institution manager can manage', async () => {
    mockPrisma.institutionMembership.findUnique.mockResolvedValue({
      id: 'm1',
      userId: 'u1',
      institutionId: BigInt(5),
      role: 'institution_manager',
      status: 'approved',
    })
    expect(await requireInstitutionAccess('u1', BigInt(5), 'institution_manager')).toBeTruthy()
  })

  it('institution viewer cannot manage', async () => {
    mockPrisma.institutionMembership.findUnique.mockResolvedValue({
      id: 'm1',
      userId: 'u1',
      institutionId: BigInt(5),
      role: 'institution_viewer',
      status: 'approved',
    })
    await expect(requireInstitutionAccess('u1', BigInt(5), 'institution_manager')).rejects.toThrow(
      ForbiddenError,
    )
  })

  it('institution manager does not auto-grant journal edit', async () => {
    mockPrisma.journalMembership.findUnique.mockResolvedValue(null)
    expect(await canEditJournal('u1', BigInt(10))).toBe(false)
  })
})

describe('403 forbidden error', () => {
  it('ForbiddenError identifies unauthorized access', () => {
    const err = new ForbiddenError()
    expect(isForbiddenError(err)).toBe(true)
    expect(err.status).toBe(403)
  })
})

describe('change policy constants', () => {
  it('low risk article fields are direct-edit candidates', () => {
    expect(isLowRiskArticleField('title_en')).toBe(true)
    expect(isLowRiskArticleField('doi')).toBe(false)
  })

  it('critical changes require change request', () => {
    expect(requiresChangeRequest('article.doi_change')).toBe(true)
    expect(requiresChangeRequest('title_en')).toBe(false)
  })
})

describe('audit log extended fields', () => {
  it('logAudit accepts new nullable fields', async () => {
    const { logAudit } = await import('@/lib/auth/audit')
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'a1' })
    await logAudit({
      actorId: 'u1',
      action: 'test.action',
      entityType: 'article',
      entityId: '123',
      oldValues: { title: 'A' },
      newValues: { title: 'B' },
      userAgent: 'test',
      requestId: 'req-1',
    })
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entityType: 'article',
          entityId: '123',
          requestId: 'req-1',
        }),
      }),
    )
  })
})

describe('multi-scope membership', () => {
  it('user can hold different journal roles (logic-level)', () => {
    expect(journalRoleSatisfies('journal_owner', 'journal_editor')).toBe(true)
    expect(journalRoleSatisfies('journal_editor', 'journal_owner')).toBe(false)
  })

  it('institution manager and journal editor roles are independent', async () => {
    mockPrisma.journalMembership.findUnique.mockResolvedValue({
      id: 'j1',
      userId: 'u1',
      journalId: BigInt(1),
      role: 'journal_editor',
      status: 'approved',
    })
    mockPrisma.institutionMembership.findUnique.mockResolvedValue({
      id: 'i1',
      userId: 'u1',
      institutionId: BigInt(2),
      role: 'institution_manager',
      status: 'approved',
    })
    expect(await canEditJournal('u1', BigInt(1))).toBe(true)
    expect(await requireInstitutionAccess('u1', BigInt(2), 'institution_manager')).toBeTruthy()
  })
})
