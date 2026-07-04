import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ForbiddenError } from '@/lib/auth/forbidden'

const mockPrisma = vi.hoisted(() => ({
  contentApplication: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  journalApplication: {
    update: vi.fn(),
    findUnique: vi.fn(),
  },
  journal: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  journalMembership: {
    create: vi.fn(),
    upsert: vi.fn(),
  },
  applicationAttachment: {
    findFirst: vi.fn(),
  },
  applicationReview: {
    create: vi.fn(),
  },
  applicationEvent: {
    create: vi.fn(),
  },
  notificationOutbox: {
    create: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
}))

vi.mock('@/lib/db/prisma', () => ({ prisma: mockPrisma }))

vi.mock('@/lib/auth/authorization', () => ({
  hasAdminPermission: vi.fn(),
}))

vi.mock('@/lib/journal-applications/run-duplicate-precheck', () => ({
  runJournalDuplicatePrecheck: vi.fn(),
}))

vi.mock('@/lib/journal-applications/generate-slug', () => ({
  generateUniqueJournalSlug: vi.fn().mockResolvedValue('test-dergi'),
}))

vi.mock('@/lib/auth/audit', () => ({
  writeAuditLog: vi.fn(),
  logAudit: vi.fn(),
}))

import { hasAdminPermission } from '@/lib/auth/authorization'
import { runJournalDuplicatePrecheck } from '@/lib/journal-applications/run-duplicate-precheck'
import { approveJournalApplication } from '@/lib/journal-applications/approve'
import { reviewJournalApplication } from '@/lib/journal-applications/admin-service'
import { getAttachmentDownloadUrl } from '@/lib/applications/attachments'
import { writeAuditLog } from '@/lib/auth/audit'

const mockPrecheck = vi.mocked(runJournalDuplicatePrecheck)
const mockHasAdmin = vi.mocked(hasAdminPermission)

function baseContent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ca-1',
    kind: 'new_journal',
    status: 'under_review',
    title: 'Test Dergi',
    approvedJournalId: null,
    user: { email: 'applicant@example.com' },
    journalApplication: {
      id: 'ja-1',
      contentApplicationId: 'ca-1',
      nameTr: 'Test Dergi',
      nameEn: null,
      pIssn: '0317-8471',
      eIssn: null,
      pIssnNormalized: '03178471',
      eIssnNormalized: null,
      firstPublicationYear: 2020,
      publishingPlatform: 'dergipark',
      websiteUrl: 'https://example.com/journal',
      platformProfileUrl: null,
      officialJournalUrl: null,
      editorName: 'Editör',
      proposedInstitutionName: null,
      publisherInstitutionId: BigInt(1),
      publisherInstitution: { nameTr: 'Kurum A' },
      subjectAreas: [{ categoryId: BigInt(5), level: 'primary', createdAt: new Date() }],
    },
    ...overrides,
  }
}

describe('journal-application faz b5 admin permission', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.contentApplication.findFirst.mockReset()
    mockPrisma.applicationAttachment.findFirst.mockReset()
    mockHasAdmin.mockResolvedValue(false)
    mockPrisma.applicationAttachment.findFirst.mockResolvedValue({
      id: 'att-1',
      applicationId: 'ca-1',
      storageKey: 'k',
      originalName: 'cover.jpg',
      mimeType: 'image/jpeg',
      application: { userId: 'owner-1' },
    })
  })

  it('forbids admin download without review_content_applications', async () => {
    await expect(
      getAttachmentDownloadUrl({
        applicationId: 'ca-1',
        attachmentId: 'att-1',
        userId: 'admin-no-perm',
      }),
    ).rejects.toBeInstanceOf(ForbiddenError)
  })
})

describe('journal-application faz b5 approve executor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.contentApplication.findFirst.mockReset()
    mockPrecheck.mockResolvedValue({
      flags: [],
      hasExact: false,
      hasStrongOrWeak: false,
      canSubmit: true,
      requiresContinueReason: false,
    })
    mockPrisma.journalApplication.update.mockResolvedValue({})
    mockPrisma.applicationReview.create.mockResolvedValue({ id: 'rev-1' })
    mockPrisma.applicationEvent.create.mockResolvedValue({ id: 'ev-1' })
    mockPrisma.notificationOutbox.create.mockResolvedValue({ id: 'out-1' })
    mockPrisma.contentApplication.update.mockResolvedValue({})
    mockPrisma.journal.create.mockResolvedValue({
      id: BigInt(9001),
      slug: 'test-dergi',
      status: 'draft',
    })
  })

  it('blocks approve on exact duplicate', async () => {
    mockPrisma.contentApplication.findFirst.mockResolvedValue(baseContent())
    mockPrecheck.mockResolvedValue({
      flags: [{ matchLevel: 'exact', canContinue: false, source: 'catalog_journal', reason: 'ISSN', matchedField: 'p_issn' }],
      hasExact: true,
      hasStrongOrWeak: true,
      canSubmit: false,
      requiresContinueReason: false,
    })

    await expect(
      approveJournalApplication({ contentApplicationId: 'ca-1', reviewerId: 'admin-1' }),
    ).rejects.toThrow(/Exact duplicate/)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('creates one draft journal on approve', async () => {
    mockPrisma.contentApplication.findFirst.mockResolvedValue(baseContent())
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) =>
      fn(mockPrisma),
    )

    const result = await approveJournalApplication({
      contentApplicationId: 'ca-1',
      reviewerId: 'admin-1',
    })

    expect(result.idempotent).toBe(false)
    expect(result.journalId).toBe('9001')
    expect(mockPrisma.journal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'draft', titleTr: 'Test Dergi' }),
      }),
    )
    expect(mockPrisma.journalMembership.create).not.toHaveBeenCalled()
    expect(mockPrisma.journalMembership.upsert).not.toHaveBeenCalled()
    expect(mockPrisma.notificationOutbox.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'journal_application.approved' }),
      }),
    )
    expect(mockPrisma.applicationEvent.create).toHaveBeenCalled()
    expect(writeAuditLog).toHaveBeenCalled()
  })

  it('second approve is idempotent', async () => {
    mockPrisma.contentApplication.findFirst.mockResolvedValue(
      baseContent({ status: 'approved', approvedJournalId: BigInt(9001) }),
    )
    mockPrisma.journal.findUnique.mockResolvedValue({ id: BigInt(9001), slug: 'test-dergi' })

    const result = await approveJournalApplication({
      contentApplicationId: 'ca-1',
      reviewerId: 'admin-1',
    })

    expect(result.idempotent).toBe(true)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    expect(mockPrisma.journal.create).not.toHaveBeenCalled()
  })
})

describe('journal-application faz b5 reject and revision', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.contentApplication.findFirst.mockReset()
    mockPrecheck.mockResolvedValue({
      flags: [],
      hasExact: false,
      hasStrongOrWeak: false,
      canSubmit: true,
      requiresContinueReason: false,
    })
    mockPrisma.applicationReview.create.mockResolvedValue({ id: 'rev-1' })
    mockPrisma.applicationEvent.create.mockResolvedValue({ id: 'ev-1' })
    mockPrisma.notificationOutbox.create.mockResolvedValue({ id: 'out-1' })
    mockPrisma.contentApplication.update.mockResolvedValue({})
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) =>
      fn(mockPrisma),
    )
  })

  function mockAdminLoad(status: string) {
    const now = new Date('2026-07-04T12:00:00Z')
    const content = baseContent({
      status,
      submittedAt: now,
      assignedTo: null,
      approvedAt: null,
      createdAt: now,
      updatedAt: now,
    })
    const fullDetail = {
      ...content,
      assignee: null,
      privateContact: null,
      attachments: [],
      revisions: [],
      events: [],
      reviews: [],
      approvedJournal: null,
    }
    mockPrisma.contentApplication.findFirst
      .mockResolvedValueOnce(content)
      .mockResolvedValueOnce({
        id: content.id,
        status: content.status,
        title: content.title,
        user: content.user,
      })
      .mockResolvedValue(fullDetail)
  }

  it('reject updates status and enqueues notification', async () => {
    mockAdminLoad('under_review')

    await reviewJournalApplication({
      contentApplicationId: 'ca-1',
      reviewerId: 'admin-1',
      action: 'reject',
      note: 'Eksik belgeler',
    })

    expect(mockPrisma.contentApplication.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'rejected' }) }),
    )
    expect(mockPrisma.notificationOutbox.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'journal_application.rejected' }),
      }),
    )
  })

  it('request revision requires note', async () => {
    mockAdminLoad('under_review')

    await expect(
      reviewJournalApplication({
        contentApplicationId: 'ca-1',
        reviewerId: 'admin-1',
        action: 'request_revision',
      }),
    ).rejects.toThrow(/note/i)
  })

  it('request revision updates status correctly', async () => {
    mockAdminLoad('precheck')

    await reviewJournalApplication({
      contentApplicationId: 'ca-1',
      reviewerId: 'admin-1',
      action: 'request_revision',
      note: 'ISSN düzeltin',
    })

    expect(mockPrisma.contentApplication.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'revision_requested' }),
      }),
    )
    expect(mockPrisma.notificationOutbox.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'journal_application.revision_requested' }),
      }),
    )
  })
})
