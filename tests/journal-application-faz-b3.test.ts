import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  validateWizardStep,
  WIZARD_STEP_TITLES,
  type WizardFormState,
} from '@/lib/journal-applications/step-validation'
import {
  buildDeclarationAcceptanceRecord,
} from '@/lib/journal-applications/declarations'
import { parseSubjectAreasFromApi, parsePublisherInstitutionId } from '@/lib/journal-applications/serialize'

vi.mock('@/lib/journal-applications/run-duplicate-precheck', () => ({
  runJournalDuplicatePrecheck: vi.fn(),
}))

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    contentApplication: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    journalApplication: {
      create: vi.fn(),
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
    applicationPrivateContact: {
      upsert: vi.fn(),
    },
    $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn({
      contentApplication: { create: vi.fn(), update: vi.fn() },
      journalApplication: { create: vi.fn(), update: vi.fn() },
      journalApplicationSubjectArea: { deleteMany: vi.fn(), createMany: vi.fn() },
      applicationDeclarationAcceptance: { upsert: vi.fn() },
      applicationPrivateContact: { upsert: vi.fn() },
    })),
  },
}))

vi.mock('@/lib/applications/events', () => ({
  recordApplicationEvent: vi.fn(),
}))

import { runJournalDuplicatePrecheck } from '@/lib/journal-applications/run-duplicate-precheck'
import { validateJournalApplicationForSubmit } from '@/lib/journal-applications/validate-for-submit'
import { submitJournalApplication } from '@/lib/journal-applications/service'
import { prisma } from '@/lib/db/prisma'

const mockPrecheck = vi.mocked(runJournalDuplicatePrecheck)

function baseWizardForm(): WizardFormState {
  const at = new Date('2026-07-04T12:00:00Z')
  return {
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
    subjectAreas: [{ categoryId: BigInt(1), level: 'primary' }],
    declarationAcceptance: buildDeclarationAcceptanceRecord({
      criteriaAcceptedAt: at,
      standardsAcceptedAt: at,
      privacyNoticeAcceptedAt: at,
      imageRightsAcceptedAt: at,
      informationAccuracyConfirmedAt: at,
    }),
    privateContact: {
      contactName: 'İletişim',
      contactEmail: 'contact@example.com',
    },
    duplicateContinueReason: null,
  }
}

describe('journal-application faz b3 wizard steps', () => {
  it('defines 10 step titles', () => {
    expect(Object.keys(WIZARD_STEP_TITLES)).toHaveLength(10)
  })

  it('soft-validates step 1 requires Turkish name', () => {
    const form = baseWizardForm()
    form.nameTr = ''
    const issues = validateWizardStep(1, form)
    expect(issues.some((i) => i.field === 'nameTr')).toBe(true)
  })

  it('soft-validates step 7 requires contact fields', () => {
    const form = baseWizardForm()
    form.privateContact = { contactName: '', contactEmail: '' }
    const issues = validateWizardStep(7, form)
    expect(issues.length).toBeGreaterThan(0)
  })
})

describe('journal-application faz b3 serialize helpers', () => {
  it('parses subject areas from api strings', () => {
    const areas = parseSubjectAreasFromApi([
      { categoryId: '42', level: 'primary' },
    ])
    expect(areas[0].categoryId).toBe(BigInt(42))
  })

  it('parses publisher institution id', () => {
    expect(parsePublisherInstitutionId('99')?.toString()).toBe('99')
    expect(parsePublisherInstitutionId(null)).toBeNull()
  })
})

describe('journal-application faz b3 submit blocked on exact duplicate', () => {
  beforeEach(() => {
    mockPrecheck.mockReset()
    mockPrecheck.mockResolvedValue({
      flags: [
        {
          matchLevel: 'exact',
          canContinue: false,
          source: 'catalog_journal',
          reason: 'P-ISSN eşleşmesi',
          matchedField: 'p_issn',
        },
      ],
      hasExact: true,
      hasStrongOrWeak: false,
      canSubmit: false,
      requiresContinueReason: false,
    })
  })

  it('validate-for-submit blocks exact duplicate', async () => {
    const form = baseWizardForm()
    const result = await validateJournalApplicationForSubmit({
      ...form,
      excludeJournalApplicationId: 'ja-1',
      excludeContentApplicationId: 'ca-1',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some((e) => e.field === 'duplicate')).toBe(true)
    }
  })
})

describe('journal-application faz b3 service submit integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrecheck.mockResolvedValue({
      flags: [],
      hasExact: false,
      hasStrongOrWeak: false,
      canSubmit: true,
      requiresContinueReason: false,
    })
  })

  it('returns validation errors when submitJournalApplication fails validation', async () => {
    vi.mocked(prisma.contentApplication.findFirst).mockResolvedValue({
      id: 'ca-1',
      userId: 'user-1',
      kind: 'new_journal',
      status: 'draft',
      title: 'Test',
      journalApplication: {
        id: 'ja-1',
        contentApplicationId: 'ca-1',
        nameTr: '',
        nameEn: null,
        abbreviation: null,
        publisherInstitutionId: null,
        proposedInstitutionName: null,
        journalType: null,
        publishingPlatform: null,
        websiteUrl: null,
        pIssn: null,
        eIssn: null,
        firstPublicationYear: null,
        publicationFrequency: null,
        publicationMonths: [],
        correspondenceAddress: null,
        editorName: null,
        editorTitle: null,
        editorEmail: null,
        editorOrcid: null,
        editorProfileUrl: null,
        officialJournalUrl: null,
        editorialBoardUrl: null,
        latestIssueUrl: null,
        platformProfileUrl: null,
        publisherPageUrl: null,
        keywords: [],
        duplicateFlags: null,
        duplicateContinueReason: null,
        subjectAreas: [],
        declarationAcceptance: null,
        publisherInstitution: null,
      },
      privateContact: null,
      attachments: [],
    } as never)

    const result = await submitJournalApplication('ca-1', 'user-1')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThan(0)
    }
  })
})
