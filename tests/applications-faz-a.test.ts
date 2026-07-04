import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  createContentApplicationDraft,
  submitContentApplication,
  updateContentApplicationDraft,
  cancelContentApplication,
} from '@/lib/applications/service'
import {
  listUnifiedUserApplications,
  getPrivateContactForAuthorizedUser,
  upsertPrivateContact,
} from '@/lib/applications/list-unified'
import {
  mapContentStatusToDisplay,
  mapMembershipStatusToDisplay,
} from '@/lib/applications/status-map'
import { ForbiddenError } from '@/lib/auth/forbidden'

const mockPrisma = vi.hoisted(() => ({
  contentApplication: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  applicationRevision: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  applicationEvent: { create: vi.fn() },
  applicationPrivateContact: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  membershipApplication: { findMany: vi.fn() },
  journalApplication: { findUnique: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
  $executeRawUnsafe: vi.fn(),
}))

vi.mock('@/lib/db/prisma', () => ({ prisma: mockPrisma }))

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.auditLog.create.mockResolvedValue({ id: 'a1' })
  mockPrisma.applicationEvent.create.mockResolvedValue({ id: 'e1' })
})

describe('content application draft workflow', () => {
  it('creates draft application', async () => {
    mockPrisma.contentApplication.create.mockResolvedValue({
      id: 'app-1',
      kind: 'new_journal',
      status: 'draft',
    })

    const row = await createContentApplicationDraft({
      userId: 'user-1',
      kind: 'new_journal',
      title: 'Test',
    })

    expect(row.id).toBe('app-1')
    expect(mockPrisma.applicationEvent.create).toHaveBeenCalled()
  })

  it('updates draft when editable', async () => {
    mockPrisma.contentApplication.findFirst.mockResolvedValue({
      id: 'app-1',
      status: 'draft',
      title: 'Old',
    })
    mockPrisma.contentApplication.update.mockResolvedValue({
      id: 'app-1',
      title: 'New',
    })

    const row = await updateContentApplicationDraft({
      applicationId: 'app-1',
      userId: 'user-1',
      title: 'New',
    })
    expect(row.title).toBe('New')
  })

  it('blocks update when submitted', async () => {
    mockPrisma.contentApplication.findFirst.mockResolvedValue({
      id: 'app-1',
      status: 'submitted',
    })
    await expect(
      updateContentApplicationDraft({
        applicationId: 'app-1',
        userId: 'user-1',
        title: 'X',
      }),
    ).rejects.toThrow(/not editable/)
  })

  it('creates revision on submit', async () => {
    mockPrisma.contentApplication.findFirst.mockResolvedValue({
      id: 'app-1',
      userId: 'user-1',
      kind: 'new_journal',
      title: 'T',
      status: 'draft',
      draftPayload: { note: 'n' },
      attachments: [],
      privateContact: null,
    })

    mockPrisma.journalApplication.findUnique.mockResolvedValue(null)

    mockPrisma.$transaction.mockImplementation(async (fn) =>
      fn({
        applicationRevision: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({
            id: 'rev-1',
            revisionNumber: 1,
          }),
        },
        contentApplication: {
          update: vi.fn().mockResolvedValue({ id: 'app-1', status: 'submitted' }),
        },
      }),
    )

    const row = await submitContentApplication({
      applicationId: 'app-1',
      userId: 'user-1',
    })
    expect(row.status).toBe('submitted')
  })

  it('forbids access for wrong owner on cancel', async () => {
    mockPrisma.contentApplication.findFirst.mockResolvedValue(null)
    await expect(
      cancelContentApplication({ applicationId: 'app-1', userId: 'other' }),
    ).rejects.toBeInstanceOf(ForbiddenError)
  })
})

describe('private contact isolation', () => {
  it('allows owner to read private contact', async () => {
    mockPrisma.contentApplication.findUnique.mockResolvedValue({ userId: 'user-1' })
    mockPrisma.applicationPrivateContact.findUnique.mockResolvedValue({
      applicationId: 'app-1',
      workPhone: '+905551234567',
    })

    const row = await getPrivateContactForAuthorizedUser('app-1', 'user-1', false)
    expect(row?.workPhone).toBeTruthy()
  })

  it('forbids other user from private contact', async () => {
    mockPrisma.contentApplication.findUnique.mockResolvedValue({ userId: 'owner' })
    await expect(
      getPrivateContactForAuthorizedUser('app-1', 'other', false),
    ).rejects.toBeInstanceOf(ForbiddenError)
  })

  it('upserts private contact in draft', async () => {
    mockPrisma.contentApplication.findFirst.mockResolvedValue({
      id: 'app-1',
      status: 'draft',
    })
    mockPrisma.applicationPrivateContact.upsert.mockResolvedValue({ applicationId: 'app-1' })

    await upsertPrivateContact({
      applicationId: 'app-1',
      userId: 'user-1',
      data: { workPhone: '+905551234567' },
    })
    expect(mockPrisma.applicationPrivateContact.upsert).toHaveBeenCalled()
  })
})

describe('status mapping DTO', () => {
  it('maps content submitted to in_review display', () => {
    expect(mapContentStatusToDisplay('submitted')).toBe('in_review')
    expect(mapContentStatusToDisplay('draft')).toBe('draft')
  })

  it('maps membership pending to in_review', () => {
    expect(mapMembershipStatusToDisplay('pending')).toBe('in_review')
  })
})

describe('unified list', () => {
  it('merges content and membership applications', async () => {
    mockPrisma.contentApplication.findMany.mockResolvedValue([
      {
        id: 'c1',
        kind: 'new_journal',
        status: 'draft',
        title: 'Dergi',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-02'),
      },
    ])
    mockPrisma.membershipApplication.findMany.mockResolvedValue([
      {
        id: 'm1',
        type: 'journal_editor',
        status: 'pending',
        journalId: BigInt(1),
        institutionId: null,
        journal: { titleTr: 'J', slug: 'j' },
        institution: null,
        createdAt: new Date('2026-01-03'),
        updatedAt: new Date('2026-01-04'),
      },
    ])

    const items = await listUnifiedUserApplications('user-1')
    expect(items).toHaveLength(2)
    expect(items[0].source).toBe('membership_application')
    expect(items[1].source).toBe('content_application')
  })
})
