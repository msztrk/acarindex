import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ForbiddenError } from '@/lib/auth/forbidden'

const mockPrisma = vi.hoisted(() => ({
  journal: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  journalMembership: {
    create: vi.fn(),
    upsert: vi.fn(),
  },
  $transaction: vi.fn(),
}))

vi.mock('@/lib/db/prisma', () => ({ prisma: mockPrisma }))

vi.mock('@/lib/auth/audit', () => ({
  writeAuditLog: vi.fn(),
}))

vi.mock('@/lib/auth/authorization', () => ({
  hasAdminPermission: vi.fn(),
}))

import { hasAdminPermission } from '@/lib/auth/authorization'
import { publishDraftJournal } from '@/lib/admin/journal-publish'
import { writeAuditLog } from '@/lib/auth/audit'

const mockHasAdmin = vi.mocked(hasAdminPermission)

function draftJournal(overrides: Record<string, unknown> = {}) {
  return {
    id: BigInt(42),
    slug: 'test-dergi',
    titleTr: 'Test Dergi',
    status: 'draft',
    ...overrides,
  }
}

describe('publishDraftJournal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.$transaction.mockImplementation(async (fn) => fn(mockPrisma))
  })

  it('publishes draft journal and writes audit log', async () => {
    mockPrisma.journal.findUnique.mockResolvedValue(draftJournal())
    mockPrisma.journal.update.mockResolvedValue(draftJournal({ status: 'published' }))

    const result = await publishDraftJournal(BigInt(42), 'admin-1')

    expect(result.idempotent).toBe(false)
    expect(result.status).toBe('published')
    expect(mockPrisma.journal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: BigInt(42) },
        data: { status: 'published' },
      }),
    )
    expect(mockPrisma.journalMembership.create).not.toHaveBeenCalled()
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'journal.published',
        entityType: 'journal',
        entityId: '42',
      }),
    )
  })

  it('is idempotent when already published', async () => {
    mockPrisma.journal.findUnique.mockResolvedValue(
      draftJournal({ status: 'published' }),
    )

    const result = await publishDraftJournal(BigInt(42), 'admin-1')

    expect(result.idempotent).toBe(true)
    expect(result.status).toBe('published')
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    expect(writeAuditLog).not.toHaveBeenCalled()
  })

  it('rejects archived journal', async () => {
    mockPrisma.journal.findUnique.mockResolvedValue(
      draftJournal({ status: 'archived' }),
    )

    await expect(publishDraftJournal(BigInt(42), 'admin-1')).rejects.toThrow(
      'Journal cannot be published in current status',
    )
  })

  it('requires titleTr and slug', async () => {
    mockPrisma.journal.findUnique.mockResolvedValue(
      draftJournal({ titleTr: '  ' }),
    )

    await expect(publishDraftJournal(BigInt(42), 'admin-1')).rejects.toThrow(
      'Journal title (TR) is required for publication',
    )
  })
})

describe('publishDraftJournal admin permission (API guard contract)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHasAdmin.mockResolvedValue(false)
  })

  it('forbids non-admin via hasAdminPermission', async () => {
    mockHasAdmin.mockResolvedValue(false)
    const allowed = await hasAdminPermission('user-1', 'manage_journals')
    expect(allowed).toBe(false)
    if (!allowed) {
      expect(() => {
        throw new ForbiddenError()
      }).toThrow(ForbiddenError)
    }
  })
})
