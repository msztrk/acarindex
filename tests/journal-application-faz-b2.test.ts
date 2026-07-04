import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  APPLICATION_DECLARATION_VERSIONS,
  buildDeclarationAcceptanceRecord,
} from '@/lib/journal-applications/declarations'
import {
  evaluateCatalogJournalDuplicate,
  evaluatePendingApplicationDuplicate,
  mergeDuplicateFlags,
  type DuplicatePrecheckInput,
} from '@/lib/journal-applications/duplicate-precheck'
import {
  computeYearsPublished,
  currentPublicationYear,
  validateFirstPublicationYear,
  validatePublicationSchedule,
} from '@/lib/journal-applications/publication-schedule'
import { validateJournalApplicationForSubmit } from '@/lib/journal-applications/validate-for-submit'
import { validateIssn, validateIssnCheckDigit, validateIssnPair } from '@/lib/validation/issn'
import { normalizeExternalUrl } from '@/lib/validation/url'

vi.mock('@/lib/journal-applications/run-duplicate-precheck', () => ({
  runJournalDuplicatePrecheck: vi.fn(),
}))

import { runJournalDuplicatePrecheck } from '@/lib/journal-applications/run-duplicate-precheck'

const mockRunDuplicatePrecheck = vi.mocked(runJournalDuplicatePrecheck)

function completeDeclarations() {
  const at = new Date('2026-07-04T12:00:00Z')
  return buildDeclarationAcceptanceRecord({
    criteriaAcceptedAt: at,
    standardsAcceptedAt: at,
    privacyNoticeAcceptedAt: at,
    imageRightsAcceptedAt: at,
    informationAccuracyConfirmedAt: at,
  })
}

function baseSubmitInput() {
  return {
    nameTr: 'Örnek Dergi',
    publisherInstitutionId: BigInt(1),
    pIssn: '0317-8471',
    firstPublicationYear: 2020,
    publicationFrequency: 'continuous' as const,
    publicationMonths: [],
    keywords: ['Open Access', 'Peer Review', 'Academic'],
    subjectAreas: [{ categoryId: BigInt(1), level: 'primary' as const }],
    declarationAcceptance: completeDeclarations(),
  }
}

function noDuplicatePrecheck() {
  return {
    flags: [],
    hasExact: false,
    hasStrongOrWeak: false,
    canSubmit: true,
    requiresContinueReason: false,
  }
}

describe('journal-application faz b2 issn', () => {
  it('rejects invalid check digit', () => {
    expect(validateIssn('1234-5678').ok).toBe(false)
  })

  it('accepts valid issn with X check digit', () => {
    expect(validateIssnCheckDigit('1574017X')).toBe(true)
    expect(validateIssn('1574-017X').ok).toBe(true)
  })

  it('rejects identical P/E pair and requires at least one', () => {
    expect(validateIssnPair(null, null).ok).toBe(false)
    expect(validateIssnPair('0317-8471', '0317-8471').ok).toBe(false)
    expect(validateIssnPair('0317-8471', null).ok).toBe(true)
  })
})

describe('journal-application faz b2 url', () => {
  it('rejects ftp protocol', () => {
    expect(normalizeExternalUrl('ftp://example.com/journal').ok).toBe(false)
  })

  it('rejects credentials in url', () => {
    expect(normalizeExternalUrl('https://user:pass@example.com/journal').ok).toBe(false)
  })

  it('accepts https url', () => {
    const result = normalizeExternalUrl('https://example.com/journal/')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.normalized).toBe('https://example.com/journal')
    }
  })
})

describe('journal-application faz b2 publication year', () => {
  const nowYear = 2026

  it('rejects year before 1800 and after current year', () => {
    expect(validateFirstPublicationYear(1799, nowYear).ok).toBe(false)
    expect(validateFirstPublicationYear(nowYear + 1, nowYear).ok).toBe(false)
  })

  it('accepts valid year and computes years published', () => {
    const result = validateFirstPublicationYear(2020, nowYear)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(computeYearsPublished(result.year, nowYear)).toBe(7)
    }
  })
})

describe('journal-application faz b2 publication schedule', () => {
  it('requires four months for quarterly frequency', () => {
    const ok = validatePublicationSchedule('quarterly', [1, 4, 7, 10])
    expect(ok.ok).toBe(true)

    const missing = validatePublicationSchedule('quarterly', [1, 4, 7])
    expect(missing.ok).toBe(false)
  })

  it('allows empty months for continuous frequency', () => {
    expect(validatePublicationSchedule('continuous', []).ok).toBe(true)
  })

  it('rejects wrong month count for monthly frequency', () => {
    expect(validatePublicationSchedule('monthly', [1, 2, 3]).ok).toBe(false)
    expect(validatePublicationSchedule('monthly', Array.from({ length: 12 }, (_, i) => i + 1)).ok).toBe(
      true,
    )
  })
})

describe('journal-application faz b2 duplicate evaluators', () => {
  const baseInput: DuplicatePrecheckInput = {
    nameTr: 'Test Dergi',
    pIssnNormalized: '03178471',
    eIssnNormalized: null,
    proposedInstitutionName: 'Test Üniversitesi',
    websiteDomain: 'example.com',
    platformUrlKey: 'dergipark.org.tr/test',
  }

  it('blocks exact issn match with canSubmit false', () => {
    const flags = evaluateCatalogJournalDuplicate(baseInput, {
      id: BigInt(99),
      titleTr: 'Başka Dergi',
      titleEn: null,
      issn: '0317-8471',
      eissn: null,
      publisher: 'Other',
      legacyLink: null,
      slug: 'baska-dergi',
    }, null)

    const summary = mergeDuplicateFlags(flags)
    expect(summary.hasExact).toBe(true)
    expect(summary.canSubmit).toBe(false)
  })

  it('requires continue reason for strong or weak matches without exact duplicate', () => {
    const flags = evaluateCatalogJournalDuplicate(
      {
        ...baseInput,
        pIssnNormalized: null,
        nameTr: 'Academic Journal of Science',
      },
      {
        id: BigInt(100),
        titleTr: 'Academic Journal of Science and Research',
        titleEn: null,
        issn: null,
        eissn: null,
        publisher: 'Test Üniversitesi',
        legacyLink: 'https://example.com/journal',
        slug: 'academic-journal',
      },
      null,
    )

    const summary = mergeDuplicateFlags(flags)
    expect(summary.hasExact).toBe(false)
    expect(summary.hasStrongOrWeak).toBe(true)
    expect(summary.canSubmit).toBe(true)
    expect(summary.requiresContinueReason).toBe(true)
  })

  it('blocks pending application exact issn match', () => {
    const flags = evaluatePendingApplicationDuplicate(baseInput, {
      id: 'app-1',
      contentApplicationId: 'content-1',
      nameTr: 'Pending',
      nameEn: null,
      pIssnNormalized: '03178471',
      eIssnNormalized: null,
      publisherInstitutionId: null,
      proposedInstitutionName: null,
      publishingPlatform: null,
      websiteUrl: null,
      officialJournalUrl: null,
      platformProfileUrl: null,
    }, null)

    const summary = mergeDuplicateFlags(flags)
    expect(summary.canSubmit).toBe(false)
  })
})

describe('journal-application faz b2 validate-for-submit', () => {
  beforeEach(() => {
    mockRunDuplicatePrecheck.mockReset()
    mockRunDuplicatePrecheck.mockResolvedValue(noDuplicatePrecheck())
  })

  it('returns normalized payload when all checks pass', async () => {
    const result = await validateJournalApplicationForSubmit(baseSubmitInput())
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.normalized.nameTr).toBe('Örnek Dergi')
      expect(result.normalized.pIssnNormalized).toBe('03178471')
      expect(result.normalized.declarationAcceptance.criteriaVersion).toBe(
        APPLICATION_DECLARATION_VERSIONS.criteria,
      )
    }
  })

  it('blocks submit on exact duplicate without continue reason path', async () => {
    mockRunDuplicatePrecheck.mockResolvedValue({
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

    const result = await validateJournalApplicationForSubmit(baseSubmitInput())
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some((e) => e.field === 'duplicate')).toBe(true)
    }
  })

  it('requires duplicateContinueReason for strong or weak matches', async () => {
    mockRunDuplicatePrecheck.mockResolvedValue({
      flags: [
        {
          matchLevel: 'weak',
          canContinue: true,
          source: 'catalog_journal',
          reason: 'Benzer ad',
          matchedField: 'name',
        },
      ],
      hasExact: false,
      hasStrongOrWeak: true,
      canSubmit: true,
      requiresContinueReason: true,
    })

    const blocked = await validateJournalApplicationForSubmit(baseSubmitInput())
    expect(blocked.ok).toBe(false)
    if (!blocked.ok) {
      expect(blocked.errors.some((e) => e.field === 'duplicateContinueReason')).toBe(true)
    }

    const allowed = await validateJournalApplicationForSubmit({
      ...baseSubmitInput(),
      duplicateContinueReason: 'Farklı yayın kapsamı',
    })
    expect(allowed.ok).toBe(true)
  })

  it('rejects invalid url fields before duplicate precheck', async () => {
    const result = await validateJournalApplicationForSubmit({
      ...baseSubmitInput(),
      websiteUrl: 'ftp://bad.example.com',
    })

    expect(result.ok).toBe(false)
    expect(mockRunDuplicatePrecheck).not.toHaveBeenCalled()
    if (!result.ok) {
      expect(result.errors.some((e) => e.field === 'websiteUrl')).toBe(true)
    }
  })
})

describe('journal-application faz b2 current year helper', () => {
  it('uses current calendar year', () => {
    expect(currentPublicationYear()).toBe(new Date().getFullYear())
  })
})
