import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  createChangeRequest,
  listChangeRequestsForUser,
  reviewChangeRequest,
} from '@/lib/change-requests/service'
import {
  submitMembershipApplication,
  listMembershipApplicationsForUser,
  reviewMembershipApplication,
} from '@/lib/membership-applications/service'
import { ForbiddenError } from '@/lib/auth/forbidden'

const mockPrisma = vi.hoisted(() => ({
  changeRequest: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  membershipApplication: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  journalMembership: { upsert: vi.fn() },
  institutionMembership: { upsert: vi.fn() },
  $transaction: vi.fn(),
  auditLog: { create: vi.fn() },
}))

vi.mock('@/lib/db/prisma', () => ({ prisma: mockPrisma }))

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-1' })
})

describe('change request service', () => {
  it('creates pending change request for critical type', async () => {
    mockPrisma.changeRequest.create.mockResolvedValue({
      id: 'cr-1',
      changeType: 'article.doi_change',
      status: 'pending',
    })

    const row = await createChangeRequest({
      entityType: 'article',
      entityId: '99',
      requestedBy: 'user-1',
      changeType: 'article.doi_change',
      newData: { doi: '10.1234/new' },
    })

    expect(row.id).toBe('cr-1')
    expect(mockPrisma.changeRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'pending', changeType: 'article.doi_change' }),
      }),
    )
    expect(mockPrisma.auditLog.create).toHaveBeenCalled()
  })

  it('rejects non-critical change types', async () => {
    await expect(
      createChangeRequest({
        entityType: 'article',
        entityId: '1',
        requestedBy: 'user-1',
        changeType: 'title_en',
      }),
    ).rejects.toThrow(/not marked as critical/)
  })

  it('lists change requests for user', async () => {
    mockPrisma.changeRequest.findMany.mockResolvedValue([{ id: 'cr-1' }])
    const rows = await listChangeRequestsForUser('user-1')
    expect(rows).toHaveLength(1)
  })

  it('reviews pending change request', async () => {
    mockPrisma.changeRequest.findUnique.mockResolvedValue({
      id: 'cr-1',
      status: 'pending',
      entityType: 'journal',
      entityId: '5',
    })
    mockPrisma.changeRequest.update.mockResolvedValue({ id: 'cr-1', status: 'approved' })

    const row = await reviewChangeRequest({
      id: 'cr-1',
      reviewerId: 'admin-1',
      status: 'approved',
    })
    expect(row.status).toBe('approved')
  })

  it('blocks review of non-pending request', async () => {
    mockPrisma.changeRequest.findUnique.mockResolvedValue({
      id: 'cr-1',
      status: 'approved',
    })
    await expect(
      reviewChangeRequest({ id: 'cr-1', reviewerId: 'admin-1', status: 'rejected' }),
    ).rejects.toBeInstanceOf(ForbiddenError)
  })
})

describe('membership application service', () => {
  it('submits journal editor application', async () => {
    mockPrisma.membershipApplication.findFirst.mockResolvedValue(null)
    mockPrisma.membershipApplication.create.mockResolvedValue({
      id: 'app-1',
      type: 'journal_editor',
      status: 'pending',
    })

    const row = await submitMembershipApplication({
      userId: 'user-1',
      type: 'journal_editor',
      journalId: 42n,
    })
    expect(row.id).toBe('app-1')
  })

  it('rejects duplicate pending application', async () => {
    mockPrisma.membershipApplication.findFirst.mockResolvedValue({ id: 'existing' })
    await expect(
      submitMembershipApplication({
        userId: 'user-1',
        type: 'journal_editor',
        journalId: 42n,
      }),
    ).rejects.toThrow(/pending application/)
  })

  it('requires institution id for institution manager type', async () => {
    await expect(
      submitMembershipApplication({
        userId: 'user-1',
        type: 'institution_manager',
      }),
    ).rejects.toThrow(/institution_id required/)
  })

  it('lists applications for user', async () => {
    mockPrisma.membershipApplication.findMany.mockResolvedValue([{ id: 'app-1' }])
    const rows = await listMembershipApplicationsForUser('user-1')
    expect(rows).toHaveLength(1)
  })

  it('approves journal application and creates membership', async () => {
    mockPrisma.membershipApplication.findUnique.mockResolvedValue({
      id: 'app-1',
      status: 'pending',
      type: 'journal_editor',
      userId: 'user-1',
      journalId: 42n,
      institutionId: null,
    })
    mockPrisma.$transaction.mockImplementation(async (fn) =>
      fn({
        membershipApplication: {
          update: vi.fn().mockResolvedValue({ id: 'app-1', status: 'approved' }),
        },
        journalMembership: {
          upsert: vi.fn().mockResolvedValue({ id: 'jm-1' }),
        },
        institutionMembership: { upsert: vi.fn() },
      }),
    )

    const row = await reviewMembershipApplication({
      id: 'app-1',
      reviewerId: 'admin-1',
      status: 'approved',
    })
    expect(row.status).toBe('approved')
    expect(mockPrisma.auditLog.create).toHaveBeenCalled()
  })
})
