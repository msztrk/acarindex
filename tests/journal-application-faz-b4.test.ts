import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ForbiddenError } from '@/lib/auth/forbidden'
import {
  AttachmentValidationError,
  validateApplicationFile,
} from '@/lib/applications/storage/file-validation'
import {
  clearMemoryApplicationStorage,
  createMemoryApplicationStorage,
} from '@/lib/applications/storage/memory-provider'
import { resetApplicationStorageForTests } from '@/lib/applications/storage/index'

vi.mock('@/lib/applications/storage/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/applications/storage/index')>()
  const memory = createMemoryApplicationStorage()
  return {
    ...actual,
    getApplicationStorage: () => memory,
  }
})

vi.mock('@/lib/auth/authorization', () => ({
  hasAdminPermission: vi.fn().mockResolvedValue(false),
}))

const mockPrisma = vi.hoisted(() => ({
  contentApplication: {
    findFirst: vi.fn(),
  },
  applicationAttachment: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
  },
  journalApplication: {
    update: vi.fn(),
    findUnique: vi.fn(),
  },
  journalApplicationSubjectArea: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
  applicationDeclarationAcceptance: {
    upsert: vi.fn(),
  },
  applicationRevision: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  applicationEvent: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
}))

vi.mock('@/lib/db/prisma', () => ({ prisma: mockPrisma }))

vi.mock('@/lib/journal-applications/run-duplicate-precheck', () => ({
  runJournalDuplicatePrecheck: vi.fn().mockResolvedValue({
    flags: [],
    hasExact: false,
    hasStrongOrWeak: false,
    canSubmit: true,
    requiresContinueReason: false,
  }),
}))

vi.mock('@/lib/applications/events', () => ({
  recordApplicationEvent: vi.fn(),
}))

import {
  uploadAttachment,
  getAttachmentDownloadUrl,
  commitAttachments,
} from '@/lib/applications/attachments'
import { submitJournalApplication } from '@/lib/journal-applications/service'
import { hasAdminPermission } from '@/lib/auth/authorization'
import { buildDeclarationAcceptanceRecord } from '@/lib/journal-applications/declarations'

function minimalJpeg(): Buffer {
  return Buffer.from([0xff, 0xd8, 0xff, 0xd9])
}

function minimalPdf(): Buffer {
  return Buffer.from('%PDF-1.4\n%%EOF')
}

function fakePdfWithJpegMagic(): Buffer {
  const buf = minimalJpeg()
  return Buffer.concat([buf, Buffer.alloc(100)])
}

describe('journal-application faz b4 file validation', () => {
  it('accepts valid cover JPEG', () => {
    const result = validateApplicationFile({
      kind: 'cover_image',
      buffer: minimalJpeg(),
      mimeType: 'image/jpeg',
      sizeBytes: minimalJpeg().length,
    })
    expect(result.detectedMime).toBe('image/jpeg')
    expect(result.checksumSha256).toMatch(/^[a-f0-9]{64}$/)
  })

  it('rejects invalid magic bytes', () => {
    expect(() =>
      validateApplicationFile({
        kind: 'cover_image',
        buffer: Buffer.from('not-an-image'),
        mimeType: 'image/jpeg',
        sizeBytes: 12,
      }),
    ).toThrow(AttachmentValidationError)
  })

  it('rejects oversized cover file', () => {
    const big = Buffer.alloc(2 * 1024 * 1024 + 1, 0)
    big[0] = 0xff
    big[1] = 0xd8
    big[2] = 0xff
    expect(() =>
      validateApplicationFile({
        kind: 'cover_image',
        buffer: big,
        mimeType: 'image/jpeg',
        sizeBytes: big.length,
      }),
    ).toThrow(/MB/)
  })

  it('rejects PDF mime for cover when magic is jpeg', () => {
    expect(() =>
      validateApplicationFile({
        kind: 'proof_document',
        buffer: minimalJpeg(),
        mimeType: 'application/pdf',
        sizeBytes: minimalJpeg().length,
      }),
    ).toThrow(AttachmentValidationError)
  })
})

describe('journal-application faz b4 attachments service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearMemoryApplicationStorage()
    resetApplicationStorageForTests()
    mockPrisma.contentApplication.findFirst.mockResolvedValue({
      id: 'app-1',
      status: 'draft',
      userId: 'user-1',
    })
  })

  it('uploads valid cover attachment', async () => {
    mockPrisma.applicationAttachment.create.mockImplementation(({ data }) =>
      Promise.resolve({
        id: 'att-1',
        kind: data.kind,
        originalName: data.originalName,
        mimeType: data.mimeType,
        sizeBytes: data.sizeBytes,
        uploadStatus: data.uploadStatus,
        createdAt: new Date('2026-07-04T12:00:00Z'),
      }),
    )

    const row = await uploadAttachment({
      applicationId: 'app-1',
      userId: 'user-1',
      kind: 'cover_image',
      file: {
        buffer: minimalJpeg(),
        originalName: 'cover.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: minimalJpeg().length,
      },
    })

    expect(row.kind).toBe('cover_image')
    expect(row.originalName).toBe('cover.jpg')
    expect(mockPrisma.applicationAttachment.create).toHaveBeenCalled()
  })

  it('forbids cross-user download', async () => {
    mockPrisma.applicationAttachment.findFirst.mockResolvedValue({
      id: 'att-1',
      applicationId: 'app-1',
      storageKey: 'applications/app-1/x.jpg',
      originalName: 'cover.jpg',
      mimeType: 'image/jpeg',
      application: { userId: 'owner-1' },
    })

    await expect(
      getAttachmentDownloadUrl({
        applicationId: 'app-1',
        attachmentId: 'att-1',
        userId: 'other-user',
      }),
    ).rejects.toBeInstanceOf(ForbiddenError)
  })

  it('commitAttachments rejects wrong application binding', async () => {
    mockPrisma.applicationAttachment.findMany.mockResolvedValue([
      { id: 'att-1', applicationId: 'app-1' },
    ])

    await expect(commitAttachments('app-1', ['att-1', 'att-2'])).rejects.toThrow(
      /do not belong/,
    )
  })
})

describe('journal-application faz b4 submit requires cover', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearMemoryApplicationStorage()
    mockPrisma.applicationEvent.create.mockResolvedValue({ id: 'e1' })
    mockPrisma.journalApplication.update.mockResolvedValue({})
    mockPrisma.applicationDeclarationAcceptance.upsert.mockResolvedValue({})
  })

  function mockLoadedJournal() {
    const at = new Date('2026-07-04T12:00:00Z')
    const declaration = buildDeclarationAcceptanceRecord({
      criteriaAcceptedAt: at,
      standardsAcceptedAt: at,
      privacyNoticeAcceptedAt: at,
      imageRightsAcceptedAt: at,
      informationAccuracyConfirmedAt: at,
    })
    return {
      id: 'ca-1',
      userId: 'user-1',
      kind: 'new_journal',
      status: 'draft',
      title: 'Test Dergi',
      submittedAt: null,
      updatedAt: new Date(),
      attachments: [],
      journalApplication: {
        id: 'ja-1',
        contentApplicationId: 'ca-1',
        nameTr: 'Test Dergi',
        nameEn: null,
        abbreviation: null,
        publisherInstitutionId: BigInt(1),
        proposedInstitutionName: null,
        journalType: null,
        publishingPlatform: null,
        websiteUrl: null,
        pIssn: '0317-8471',
        eIssn: null,
        firstPublicationYear: 2020,
        publicationFrequency: 'continuous',
        publicationMonths: [],
        correspondenceAddress: null,
        editorName: 'Editör',
        editorTitle: null,
        editorEmail: 'editor@example.com',
        editorOrcid: null,
        editorProfileUrl: null,
        officialJournalUrl: null,
        editorialBoardUrl: null,
        latestIssueUrl: null,
        platformProfileUrl: null,
        publisherPageUrl: null,
        keywords: ['Open Access', 'Peer Review', 'Academic'],
        duplicateFlags: null,
        duplicateContinueReason: null,
        subjectAreas: [{ categoryId: BigInt(1), level: 'primary', category: { id: BigInt(1), nameTr: 'X', nameEn: null } }],
        declarationAcceptance: {
          ...declaration,
          journalApplicationId: 'ja-1',
        },
        publisherInstitution: { id: BigInt(1), nameTr: 'Kurum' },
      },
      privateContact: {
        contactName: 'İletişim',
        contactEmail: 'contact@example.com',
      },
    }
  }

  it('blocks submit without cover_image', async () => {
    mockPrisma.contentApplication.findFirst.mockResolvedValue(mockLoadedJournal())
    mockPrisma.applicationAttachment.findFirst.mockResolvedValue(null)

    const result = await submitJournalApplication('ca-1', 'user-1')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some((e) => e.field === 'cover_image')).toBe(true)
    }
  })
})
